const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');

const root=__dirname;
const api=path.join(root,'gpu-service','api');
const pythonCandidates=process.platform==='win32'
 ? [path.join(api,'.teacher-venv','Scripts','python.exe'),path.join(api,'.venv','Scripts','python.exe')]
 : [path.join(api,'.teacher-venv','bin','python'),path.join(api,'.venv','bin','python')];
const python=pythonCandidates.find(fs.existsSync);
const results=[];

function run(name,command,args,cwd=root,timeout=120000){
 process.stdout.write(`\n[TEST] ${name}\n`);
 const started=Date.now();
 const result=spawnSync(command,args,{cwd,encoding:'utf8',timeout,windowsHide:true});
 if(result.stdout)process.stdout.write(result.stdout);
 if(result.stderr)process.stderr.write(result.stderr);
 const elapsed=((Date.now()-started)/1000).toFixed(1);
 if(result.error){
  const detail=result.error.code==='ETIMEDOUT'?`timed out after ${timeout/1000}s`:result.error.message;
  throw new Error(`${name} ${detail}`);
 }
 if(result.status!==0)throw new Error(`${name} failed with exit code ${result.status}`);
 results.push({name,elapsed});
 process.stdout.write(`[PASS] ${name} (${elapsed}s)\n`);
}

async function health(){
 process.stdout.write('\n[TEST] Live Eve service health\n');
 const started=Date.now();
 let response;
 try{response=await fetch('http://127.0.0.1:8787/health',{signal:AbortSignal.timeout(5000)});}
 catch(error){throw new Error(`Live Eve service is unavailable at http://127.0.0.1:8787. Start "Start Eve Teacher.cmd" first. ${error.message}`);}
 if(!response.ok)throw new Error(`Live Eve health check returned HTTP ${response.status}`);
 const body=await response.json();
 if(body.teacher_ready!==true)throw new Error('Eve is running but OpenAI teaching is not configured. Check gpu-service/api/.env.');
 if(!body.teacher_version)throw new Error('Eve did not report a teacher version. Restart the teacher service before testing.');
 const elapsed=((Date.now()-started)/1000).toFixed(1);
 results.push({name:'Live Eve service health',elapsed});
 process.stdout.write(`[PASS] Live Eve service health — ${body.teacher_version} (${elapsed}s)\n`);
}

(async()=>{
 if(!python)throw new Error(`Python environment not found. Expected one of: ${pythonCandidates.join(', ')}`);

 for(const file of ['app.js','curriculum.js','experience.js','gpu-client.js'])
  run(`JavaScript syntax: ${file}`,process.execPath,['--check',file]);
 run('Python syntax',python,['-m','py_compile','main.py','test_teacher.py'],api);
 run('Course structure and all lesson rendering',process.execPath,['test-course.cjs']);
 run('Eve reply contract unit tests',python,['test_teacher.py'],api);
 run('Complete learner browser journey',process.execPath,['test-experience.cjs']);
 run('Typed name onboarding and saved-state failures',process.execPath,['test-typed-name.cjs']);
 run('Three agent templates and saved-project compatibility',process.execPath,['test-three-presets.cjs']);
 run('Navigation and button states with mocked Eve',process.execPath,['test-next-navigation.cjs']);
 run('Day 1 recap and Day 2 connection with mocked Eve',process.execPath,['test-lesson-transition.cjs']);
 run('Interactive Day 2 token journey with mocked Eve',process.execPath,['test-day2-journey.cjs']);
 run('Eve alignment on every activity with mocked Eve',process.execPath,['test-eve-all-days.cjs']);
 run('End-to-end Eve learner journey across Days 1–7',process.execPath,['test-eve-learner-journey.cjs']);

 await health();
 // Keep live work sequential. Parallel OpenAI requests made this check less reliable
 // and do not resemble one learner using Eve.
 run('Live Eve responses, speech and command transcription',python,['test_teacher.py','--live','--http'],api,180000);
 run('Navigation and button states with live Eve',process.execPath,['test-next-navigation.cjs','--live'],root,180000);
 run('Day 1 recap and Day 2 connection with live Eve',process.execPath,['test-lesson-transition.cjs','--live'],root,180000);
 run('Interactive Day 2 token journey with live Eve',process.execPath,['test-day2-journey.cjs','--live'],root,180000);
 run('Eve alignment and answered-question isolation on every day with live Eve',process.execPath,['test-eve-all-days.cjs','--live'],root,240000);

 const total=results.reduce((sum,item)=>sum+Number(item.elapsed),0).toFixed(1);
 process.stdout.write(`\nALL ${results.length} TEST GROUPS PASSED (${total}s)\n`);
 for(const item of results)process.stdout.write(`  ✓ ${item.name}\n`);
})().catch(error=>{
 process.stderr.write(`\nCOMPREHENSIVE TEST FAILED\n${error.message}\n`);
 process.exit(1);
});
