"""Export non-secret teaching rules for the online Worker; never export env values."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'gpu-service'/'api'))
import main
body=main.TeacherRequest(lesson='__lesson__',lesson_summary='__lesson_summary__',activity='__activity__',learner_message='export',has_greeted=True,turn_kind='conversation',learner_name='__learner_name__',preset_title='__preset_title__',preset_purpose='__preset_purpose__',current_question='__current_question__',question_context='__question_context__',answer_guidance='__answer_guidance__',previous_takeaway='__previous_takeaway__',lesson_connection='__lesson_connection__',opening_action='__opening_action__')
prompt=main.teacher_instructions(body).replace('TURN: conversation','TURN: __turn_kind__')
prompt=prompt.replace('The learner has already been welcomed. Do not say Hi, Hello, Hey, Welcome, Welcome back, Nice to meet you, or introduce yourself again. Begin directly with the explanation, acknowledgment or next action. This applies to mission changes, retries, resume and setup changes.','__greeting_rule__')
print(prompt)
