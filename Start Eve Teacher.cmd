@echo off
cd /d "%~dp0gpu-service\api"
echo Starting Eve's private teacher service...
echo Keep this window open while learners talk to Eve.
".teacher-venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8787
pause
