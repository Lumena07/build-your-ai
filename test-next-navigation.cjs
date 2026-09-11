const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();const errors=[];let calls=0,fail=false,requestBodies=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:8999/**',async route=>{
   const name=new URL(route.request().url()).pathname.slice(1)||'index.html';
   if(name==='teacher/v1/teacher/respond'){
    calls++;
    if(fail)return route.fulfill({status:503,json:{detail:'Test unavailable'}});
    const body=route.request().postDataJSON();
    requestBodies.push(body);
    if(process.argv.includes('--live')){
     const response=await fetch('http://127.0.0.1:8787/v1/teacher/respond',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
     return route.fulfill({status:response.status,json:await response.json()});
    }
    return route.fulfill({json:{text:body.learner_message==='Yes'?'Not quite. Some programs follow fixed rules.':'Yes. An alarm follows the time you set.',assessment:body.learner_message==='Yes'?'not_yet':'correct'}});
   }
   if(!['index.html','app.js','curriculum.js','experience.js','gpu-client.js','runtime-config.js','styles.css'].includes(name))return route.fulfill({status:404,body:''});
   await route.fulfill({body:fs.readFileSync(name),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://127.0.0.1:8999');
  async function reset(saved){
   await page.evaluate(saved=>{
    const p=project();p.guidance.learnerName='Anna';p.preset='business';p.languages='English';
    p.guidance.day1Step=1;p.guidance.day1Predict=false;p.guidance.drafts={};p.guidance.day1Answers=saved?{ai:saved}:{};
    window.BUILD_AI_CONFIG.apiBaseUrl='http://127.0.0.1:8999/teacher';
    voiceSession.enabled=false;courseResuming=false;store.page='lab1';save();render();
   },saved);
  }
  // Saved replies from the earlier release have feedback but no verified result.
  await reset({answer:'No',feedback:'Yes. An ordinary alarm follows fixed rules.'});
  assert.equal(await page.locator('#day1-next').isDisabled(),true);
  assert.match(await page.locator('#day1-next-rule').innerText(),/unlocks after Eve marks your answer correct/);
  await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
  await page.waitForFunction(()=>!document.getElementById('day1-next').disabled);
  assert.equal(await page.locator('#day1-next').isEnabled(),true);
  // A blank answer shows the requirement and keeps Next locked.
  await reset();
  assert.match(await page.locator('.field small').innerText(),/To continue, answer correctly/);
  assert.match(await page.locator('#day1-next-rule').innerText(),/unlocks after Eve marks your answer correct/);
  assert.equal(await page.locator('#day1-check').isDisabled(),true);
  assert.equal(await page.locator('#day1-check').evaluate(el=>getComputedStyle(el).cursor),'not-allowed');
  assert.equal(calls,1);
  assert.equal(await page.locator('#day1-next').isDisabled(),true);
  // While Eve is checking, the answer and both action buttons cannot be pressed again.
  await page.locator('#day1-answer-ai').fill('No');
  await page.evaluate(()=>{
   window.originalTeacherReply=window.BuildAICloud.teacherReply;
   window.BuildAICloud.teacherReply=()=>new Promise(resolve=>{window.finishPendingCheck=()=>resolve({text:'Yes. An alarm follows the time you set.',assessment:'correct'});});
  });
  await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
  await page.getByRole('button',{name:'Checking…',exact:true}).waitFor();
  assert.equal(await page.locator('#day1-check').isDisabled(),true);
  assert.equal(await page.locator('#day1-next').isDisabled(),true);
  assert.equal(await page.locator('#day1-answer-ai').isEditable(),false);
  await page.evaluate(()=>{window.finishPendingCheck();window.BuildAICloud.teacherReply=window.originalTeacherReply;});
  await page.waitForFunction(()=>!document.getElementById('day1-next').disabled);
  // A correct answer unlocks Next and then moves to the prediction.
  assert.equal(await page.locator('#day1-next').isEnabled(),true);
  assert.equal(await page.locator('#day1-check').isDisabled(),true);
  assert.equal(await page.locator('#day1-check').innerText(),'Answer checked');
  assert.match(await page.locator('#day1-next-rule').innerText(),/Correct answer received/);
  // Next disables immediately after one press, preventing duplicate navigation.
  await page.evaluate(()=>{window.originalStartPrediction=startDay1Prediction;startDay1Prediction=()=>{window.navigationStarted=true;};});
  await page.getByRole('button',{name:'Next: make a prediction',exact:true}).click();
  assert.equal(await page.locator('#day1-next').isDisabled(),true);
  assert.equal(await page.locator('#day1-next').innerText(),'Opening…');
  assert.equal(await page.locator('#day1-answer-ai').isEditable(),false);
  assert.equal(await page.evaluate(()=>window.navigationStarted),true);
  await page.evaluate(()=>{startDay1Prediction=window.originalStartPrediction;});
  await reset({answer:'No',feedback:'Yes. Correct.',assessment:'correct'});
  await page.getByRole('button',{name:'Next: make a prediction',exact:true}).click();
  await page.locator('#day1-answer-predict').waitFor({timeout:10000});
  // A wrong answer receives feedback but keeps Next locked until retry succeeds.
  await reset();await page.locator('#day1-answer-ai').fill('Yes');
  await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
  await page.getByText(/Eve: Not quite/).waitFor({timeout:10000});
  assert.match(await page.locator('#day1-next-rule').innerText(),/unlocks after Eve marks your answer correct/);
  assert.equal(await page.locator('#day1-answer-predict').count(),0);
  assert.equal(await page.locator('#day1-next').isDisabled(),true);
  assert.equal(await page.locator('#day1-check').isDisabled(),true);
  assert.equal(await page.locator('#day1-check').innerText(),'Edit your answer to try again');
  // Saying Next after an incorrect answer preserves it and explains the rule.
  await page.evaluate(async()=>{voiceSession.enabled=true;const speak=playLiveEve;playLiveEve=async()=>{};await runVoice(1,'Next',true);playLiveEve=speak;voiceSession.enabled=false;});
  assert.equal(await page.locator('#day1-answer-ai').inputValue(),'Yes');
  assert.match(await page.locator('#day1-feedback').innerText(),/answer this question correctly/);
  assert.equal(await page.locator('#day1-next').isDisabled(),true);
  // An offline check retains the corrected text and keeps Next locked for retry.
  await page.locator('#day1-answer-ai').fill('No');fail=true;
  assert.equal(await page.locator('#day1-check').isEnabled(),true);
  assert.equal(await page.locator('#day1-check').innerText(),'Check with Eve');
  await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
  await page.getByText(/Eve could not check/).waitFor();
  assert.equal(await page.locator('#day1-answer-ai').inputValue(),'No');
  assert.equal(await page.locator('#day1-next').isDisabled(),true);fail=false;
  await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
  await page.waitForFunction(()=>!document.getElementById('day1-next').disabled);
  assert.equal(await page.locator('#day1-next').isEnabled(),true);
  // Saying Next after a correct answer advances; the only request introduces the new question.
  const voiceBefore=calls;
  await page.evaluate(async()=>{voiceSession.enabled=true;const speak=playLiveEve;playLiveEve=async()=>{};await runVoice(1,'Next',true);playLiveEve=speak;voiceSession.enabled=false;});
  await page.locator('#day1-answer-predict').waitFor({timeout:10000});
  assert.equal(calls,voiceBefore+1);
  assert.equal(requestBodies.at(-1).turn_kind,'guidance');
  // The observed "Ici" transcription also advances checked work.
  await reset({answer:'No',feedback:'Yes. Correct.',assessment:'correct'});fail=true;
  const before=calls;
  await page.evaluate(async()=>{voiceSession.enabled=true;const speak=playLiveEve;playLiveEve=async()=>{};await runVoice(1,'Ici.',true);playLiveEve=speak;voiceSession.enabled=false;});
  await page.locator('#day1-answer-predict').waitFor();
  assert.equal(calls,before+1);
  assert.equal(requestBodies.at(-1).turn_kind,'guidance');
  assert.deepEqual(errors,[]);
  console.log(`Correct-answer gate: locked state, feedback, retry, click Next, voice Next and observed Ici transcription passed (${process.argv.includes('--live')?'live teacher':'mocked teacher'}).`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
