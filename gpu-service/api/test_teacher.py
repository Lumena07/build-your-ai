"""Offline reply-contract checks; use --live for a small synthetic teaching evaluation."""
import asyncio
import base64
import json
import sys
import unittest
from unittest.mock import patch
import httpx

import main


def payload(text, assessment='none'):
    return {'output_text': json.dumps({'text': text, 'assessment': assessment})}


def question(message='Introduce the active question.', kind='guidance'):
    return main.TeacherRequest(
        lesson='What is AI?', lesson_summary='AI can recognise patterns and generate useful content.',
        activity='Teach only this question. Wait for an attempt before explaining the answer.',
        learner_message=message, learner_name='Anna', preset_title='Business helper',
        current_question='Does every computer program use AI?',
        answer_guidance='No. Some programs simply follow fixed rules. Accept a simple no.',
        turn_kind=kind,
    )


class TeacherContractTests(unittest.TestCase):
    def test_accepts_clear_feedback(self):
        self.assertEqual(main.read_teacher_reply(payload('Yes. An ordinary alarm follows a time you set.', 'correct'), 'answer')['assessment'], 'correct')

    def test_rejects_metadata_and_multiple_questions(self):
        for text in ['Visible activity: a question about AI.', 'You are on PART 1 OF 4.',
                     'I see no previous answers.', 'What is AI? What can it do?',
                     '# Lesson summary', 'word ' * 66]:
            self.assertIsNone(main.read_teacher_reply(payload(text), 'guidance'), text)

    def test_rejects_missing_or_wrong_assessment(self):
        for raw in ['plain text', '{}', 'null', '[]']:
            self.assertIsNone(main.read_teacher_reply({'output_text': raw}, 'answer'))
        self.assertIsNone(main.read_teacher_reply(payload('Yes.'), 'answer'))
        self.assertIsNone(main.read_teacher_reply(payload('Hello.', 'correct'), 'guidance'))
        self.assertIsNone(main.read_teacher_reply(payload('Yes. Would you like another example?', 'correct'), 'answer'))

    def test_provider_message_extraction(self):
        value={'output':[{'type':'reasoning','summary':[]},{'type':'message','content':[{'type':'output_text','text':json.dumps({'text':'Does every computer program use AI?','assessment':'none'})}]}]}
        self.assertIsNotNone(main.read_teacher_reply(value, 'guidance'))

    def test_regenerates_before_returning_metadata(self):
        calls=[]
        class Response:
            status_code=200
            def json(self):
                return payload('Visible activity: two questions.') if len(calls)==1 else payload('Does every computer program use AI?')
        class Client:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def post(self, *args, **kwargs): calls.append(kwargs['json'].copy());return Response()
        with patch.object(main, 'require_openai'), patch.object(main.httpx, 'AsyncClient', Client):
            body=question();body.current_question='Where do a text assistant’s answers come from?'
            reply=asyncio.run(main.teacher_respond(body))
        self.assertEqual(len(calls), 2)
        self.assertEqual(reply['text'], 'Does every computer program use AI?')
        self.assertIn('PRIVATE TEACHING EVENT', calls[0]['input'])

    def test_never_returns_second_invalid_reply(self):
        class Response:
            status_code=200
            def json(self): return payload('Visible activity: two questions.')
        class Client:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def post(self, *args, **kwargs): return Response()
        with patch.object(main, 'require_openai'), patch.object(main.httpx, 'AsyncClient', Client):
            body=question();body.current_question='Where do a text assistant’s answers come from?'
            with self.assertRaises(main.HTTPException): asyncio.run(main.teacher_respond(body))

    def test_simple_polarity_is_deterministic(self):
        with patch.object(main, 'require_openai'):
            for answer, expected in [('No', 'correct'), ('No!', 'correct'), ('Yes.', 'not_yet')]:
                self.assertEqual(asyncio.run(main.teacher_respond(question(answer, 'answer')))['assessment'], expected)


async def live():
    cases=[
        ('welcome', question(), 'none'),
        ('short correct answer', question('No', 'answer'), 'correct'),
        ('incorrect answer', question('Yes, every program uses AI.', 'answer'), 'not_yet'),
        ('needs help', question('I do not understand. Can you help me?', 'answer'), 'unclear'),
        ('name instead of answer', question('My name is Anna.', 'answer'), 'unclear'),
        ('correct explanation', question('No, an alarm just follows the time I set.', 'answer'), 'correct'),
    ]
    prediction=question('It could say my profit is 20 before other expenses.', 'answer')
    prediction.current_question='Predict the reply your text assistant could give to this request.'
    prediction.question_context='My item costs 80 and I sell it for 100. What is my profit?'
    prediction.answer_guidance='Accept any plausible useful response or description of how the assistant could help. A profit of 20 before other expenses is correct. Accept equivalent wording.'
    cases.append(('profit prediction', prediction, 'correct'))
    source=question('It uses patterns learned during training and the question I provide.', 'answer')
    source.current_question='Where do a text assistant’s answers come from?'
    source.answer_guidance='Learned patterns from training examples and the current request. It does not automatically search the internet.'
    cases.append(('where answers come from', source, 'correct'))
    transition=main.TeacherRequest(
        lesson='Tokens',
        lesson_summary='Before AI can work with a sentence, it breaks the sentence into small pieces called tokens.',
        activity='The learner can inspect coloured token pieces in a sample sentence.',
        learner_message='The learner moved from Day 1 to Day 2. Give a brief recap and connect it to tokens.',
        learner_name='Anna', preset_title='Business helper', turn_kind='guidance',
        previous_takeaway='AI learns patterns from examples. A request guides its answer, but it can still be wrong.',
        lesson_connection='Day 1 showed a text answer. Now look at the small pieces of text a model works with.',
    )
    cases.append(('day 1 to day 2 transition', transition, 'none'))
    async def check(label, body, expected):
        if '--http' in sys.argv:
            reply=None
            for attempt in range(2):
                async with httpx.AsyncClient(timeout=100) as client:
                    response=await client.post('http://127.0.0.1:8787/v1/teacher/respond', json=body.model_dump())
                if response.status_code<500:
                    response.raise_for_status();reply=response.json();break
                if attempt==0:
                    await asyncio.sleep(.5)
                else:
                    response.raise_for_status()
        else:
            reply=await main.teacher_respond(body)
        print(json.dumps({'case':label, **reply}, ensure_ascii=True), flush=True)
        assert reply['assessment']==expected, (label, reply)
        if label=='welcome':
            assert 'profit' not in reply['text'].lower()
            assert '20' not in reply['text']
            assert not any(phrase in reply['text'].lower() for phrase in ('phones recognise', 'photo app', 'find faces', 'writing assistant', 'ordinary alarm'))
        if label=='day 1 to day 2 transition':
            words=reply['text'].lower()
            assert 'token' in words
            assert any(word in words for word in ('pattern', 'example', 'request', 'answer', 'yesterday', 'day 1'))
            assert reply['text'].count('?')<=1
        return reply
    # Model one learner session and avoid artificial request bursts.
    results=[]
    for case in cases:
        results.append(await check(*case))
    if '--http' in sys.argv:
        async with httpx.AsyncClient(timeout=60) as client:
            response=await client.post('http://127.0.0.1:8787/v1/teacher/speech', json={'text':results[0]['text']})
            response.raise_for_status();audio=response.json()
            command_audio=await client.post('http://127.0.0.1:8787/v1/teacher/speech', json={'text':'Next.'})
            command_audio.raise_for_status()
            recording=base64.b64decode(command_audio.json()['audio_base64'])
            transcription=await client.post(
                'http://127.0.0.1:8787/v1/teacher/transcribe',
                data={'language':'en'}, files={'audio':('next.mp3',recording,'audio/mpeg')},
            )
            transcription.raise_for_status()
            assert transcription.json()['text'].strip().lower().rstrip('.!?')=='next', transcription.json()
            print(f"Live command transcription: {transcription.json()['text']}", flush=True)
    else:
        audio=await main.teacher_speech(main.TeacherSpeechRequest(text=results[0]['text']))
    assert len(audio['audio_base64'])>1000 and audio['mime_type']=='audio/mpeg'
    print(f'{len(cases)} live teaching cases and speech generation passed.', flush=True)


if __name__=='__main__':
    if '--live' in sys.argv: asyncio.run(live())
    else: unittest.main()
