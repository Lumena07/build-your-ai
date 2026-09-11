const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
 const live=process.argv.includes('--live');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();const errors=[];let request,reply;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://127.0.0.1:8999/**',async route=>{
   const name=new URL(route.request().url()).pathname.slice(1)||'index.html';
   if(name==='teacher/v1/teacher/respond'){
    request=route.request().postDataJSON();
    if(live){
     const response=await fetch('http://127.0.0.1:8787/v1/teacher/respond',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)});
     reply=await response.json();return route.fulfill({status:response.status,json:reply});
    }
    reply={text:'Yesterday you learned that AI uses patterns and your request to form an answer. Today we look inside that process: the model works with text pieces called tokens. Predict where your preset question might split, then reveal the pieces.',assessment:'none'};
    return route.fulfill({json:reply});
   }
   if(!['index.html','app.js','curriculum.js','experience.js','gpu-client.js','runtime-config.js','styles.css'].includes(name))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(name),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://127.0.0.1:8999');
  await page.evaluate(()=>{
   const p=project();p.guidance.learnerName='Anna';p.preset='business';p.languages='English';p.completed=['intro','lab1'];
   window.BUILD_AI_CONFIG.apiBaseUrl='http://127.0.0.1:8999/teacher';
   voiceSession.enabled=true;courseResuming=false;playLiveEve=async()=>{};evePageVisit='';
   store.page='lab1';complete('lab1');go('lab2');
  });
  await page.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('Become a token detective'));
  for(let attempt=0;attempt<1200&&!reply;attempt++)await new Promise(resolve=>setTimeout(resolve,25));
  assert.ok(request,'Day 2 did not request Eve’s transition introduction');
  assert.equal(request.lesson,'Tokens');
  assert.equal(request.turn_kind,'guidance');
  assert.match(request.previous_takeaway,/AI learns patterns from examples/);
  assert.match(request.lesson_connection,/Day 1 showed a text answer/);
  assert.match(request.opening_action,/Connect Day 1/);
  assert.match(request.learner_message,/moved from Day 1 to Day 2/);
  assert.ok(reply?.text,'Eve returned no Day 2 transition');
  const spoken=reply.text.toLowerCase();
  assert.match(spoken,/token/);
  assert.match(spoken,/predict|reveal/,'Eve did not invite the first visible Day 2 action');
  assert.doesNotMatch(spoken,/(click|select|inspect).{0,24}colou?red|click.{0,24}(token|piece)/,'Eve jumped ahead to hidden token pieces');
  assert.ok(['pattern','example','request','answer','yesterday','day 1'].some(word=>spoken.includes(word)),'Eve did not recap Day 1');
  assert.ok((reply.text.match(/\?/g)||[]).length<=1,'Eve asked more than one question');
  assert.doesNotMatch(spoken,/visible activity|current page|lesson summary|part 1 of 4/);
  assert.deepEqual(errors,[]);
  console.log(`Day 1 recap and connection to Day 2 tokens passed (${live?'live Eve':'mocked Eve'}).`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
