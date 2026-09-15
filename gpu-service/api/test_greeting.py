import asyncio
import json
import unittest
from unittest.mock import patch
import httpx
import main

class GreetingTests(unittest.TestCase):
    def body(self, greeted):
        return main.TeacherRequest(lesson='Mission Briefing',lesson_summary='Choose an agent.',learner_message='Continue the current setup action.',learner_name='Emma',has_greeted=greeted,turn_kind='guidance')
    def test_prompt_preserves_first_welcome_and_continuity(self):
        self.assertIn('first Mission Briefing reply', main.teacher_instructions(self.body(False)))
        self.assertIn('already been welcomed', main.teacher_instructions(self.body(True)))
    def test_repeated_greeting_is_regenerated_without_losing_teaching(self):
        calls=[]
        async def post(client,url,**kwargs):
            calls.append(kwargs['json']['input'])
            text='Hi Emma. Choose your agent.' if len(calls)==1 else 'Choose the agent whose job fits your goal.'
            return httpx.Response(200,json={'output_text':json.dumps({'text':text,'assessment':'none'})})
        with patch.object(main,'require_openai'),patch.object(httpx.AsyncClient,'post',post):
            result=asyncio.run(main.teacher_respond(self.body(True)))
        self.assertEqual(len(calls),2)
        self.assertEqual(result['text'],'Choose the agent whose job fits your goal.')
        self.assertNotIn('first exchange',calls[0])
    def test_first_welcome_is_allowed(self):
        async def post(client,url,**kwargs):
            return httpx.Response(200,json={'output_text':json.dumps({'text':'Hi Emma. My name is Eve. Choose your agent.','assessment':'none'})})
        with patch.object(main,'require_openai'),patch.object(httpx.AsyncClient,'post',post):
            self.assertTrue(asyncio.run(main.teacher_respond(self.body(False)))['text'].startswith('Hi'))
    def test_invalid_repeat_cannot_be_spoken(self):
        async def post(client,url,**kwargs):
            return httpx.Response(200,json={'output_text':json.dumps({'text':'Hello Emma. Choose your agent.','assessment':'none'})})
        with patch.object(main,'require_openai'),patch.object(httpx.AsyncClient,'post',post):
            with self.assertRaises(main.HTTPException):asyncio.run(main.teacher_respond(self.body(True)))
if __name__=='__main__':unittest.main()
