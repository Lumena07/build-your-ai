const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');

const lessonPattern={
 1:/AI|pattern|program/i,2:/token/i,3:/example|question|answer/i,
 4:/behavio|rule|focused|creative|temperature/i,5:/agent|configuration|save|version|example/i,
 6:/tool|calculator|knowledge|notes|task/i,7:/test|question|answer/i,
};
function similarity(a,b){
 const words=text=>new Set(text.toLowerCase().match(/[a-z]{4,}/g)||[]),left=words(a),right=words(b);
 const shared=[...left].filter(word=>right.has(word)).length,total=new Set([...left,...right]).size;
 return total?shared/total:0;
}

(async()=>{
 const live=process.argv.includes('--live'),browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1360,height:900}}),requests=[],replies=[],errors=[];let failNext=false;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://127.0.0.1:8999/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1)||'index.html';
   if(!['index.html','app.js','curriculum.js','experience.js','gpu-client.js','runtime-config.js','styles.css'].includes(name))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(name),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  await page.route('http://127.0.0.1:8787/v1/teacher/**',async route=>{
   if(!route.request().url().endsWith('/respond'))return route.fulfill({json:{audio_base64:''}});
   const body=route.request().postDataJSON();requests.push(body);
   if(failNext&&!live){failNext=false;return route.fulfill({status:503,json:{detail:'Temporary test failure'}});}
   let reply;
   if(live){
    const response=await fetch('http://127.0.0.1:8787/v1/teacher/respond',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    reply=await response.json();if(!response.ok)return route.fulfill({status:response.status,json:reply});
   }else{
    const text={
     'What is AI?':'AI learns patterns but not every program uses AI. Answer the one question shown.',
     Tokens:'Tokens are pieces of text. Predict the split and reveal the token pieces.',
     Examples:'An answer example pairs a useful question with its ideal answer. Work on the visible example.',
     Behaviour:'Behaviour rules describe how the assistant should answer. Try the visible control.',
     'Agent configuration':'An agent configuration brings together its job, instructions, examples and reference information. Save and compare the agent configuration.',
     Tools:'A tool performs a specific job such as calculation. Choose from the visible tools.',
     Launch:'Test the assistant with the one visible question and check its answer.',
    }[body.lesson]||'Continue with the current activity.';
    reply={text,assessment:body.turn_kind==='answer'?'correct':'none'};
   }
   replies.push({body,reply});return route.fulfill({json:reply});
  });
  await page.goto('http://127.0.0.1:8999');
  await page.evaluate(()=>{
   const p=project();Object.assign(p,{preset:'business',name:'BusinessHelper',purpose:'Help a small business plan prices and daily work.',languages:'English',samples:['My item costs 80 and I sell it for 100. What is my profit?','Explain delivery costs simply.'],examples:[{input:'What is profit?',output:'Profit is income minus costs.'},{input:'How do I price an item?',output:'Add costs, then choose a sustainable margin.'},{input:'What should I record?',output:'Record income and every business expense.'}],behavior:'Use simple words and two short sentences.',evaluation:['Explain cash flow simply.','How can I track stock?'],model:{name:'BusinessHelper-1',version:1,base:'Open model · 4B',createdAt:new Date().toISOString(),examples:3},tools:{calculator:true,knowledge:false,notes:false,tasks:false},completed:['intro','lab1','lab2','lab3','lab4','lab5','lab6']});
   Object.assign(p.guidance,{learnerName:'Anna',day1Step:1,day2Step:1,activityIndex:{lab3:0,lab4:0,lab5:0,lab6:0},launchTests:{}});
   voiceSession.enabled=false;courseResuming=false;speakTurn=async()=>{};save();
  });
  async function openDay(day){
   const before=requests.length,beforeReply=replies.length;
   await page.evaluate(day=>{voiceSession.enabled=true;evePageVisit='';go(`lab${day}`);},day);
   for(let i=0;i<400&&requests.length===before;i++)await new Promise(resolve=>setTimeout(resolve,25));
   assert.ok(requests.length>before,`Day ${day} did not request Eve guidance`);
   for(let i=0;i<2400&&replies.length===beforeReply;i++)await new Promise(resolve=>setTimeout(resolve,25));
   assert.ok(replies.length>beforeReply,`Day ${day} did not receive Eve guidance`);
   const item=replies.at(-1);assert.equal(item.body.lesson,{1:'What is AI?',2:'Tokens',3:'Examples',4:'Behaviour',5:'Agent configuration',6:'Tools',7:'Launch'}[day]);
   assert.match(item.reply.text,lessonPattern[day],`Eve's Day ${day} reply did not match its topic: ${item.reply.text}`);
   assert.deepEqual(item.body.recent_turns,[],`Day ${day} automatic guidance reused an answered question`);
   assert.ok(item.body.previous_takeaway,`Day ${day} received no previous lesson takeaway`);
   assert.ok(item.body.lesson_connection,`Day ${day} received no course connection`);
   assert.ok(item.body.opening_action,`Day ${day} received no first action`);
   return item;
  }
  for(let day=1;day<=7;day++){
   const item=await openDay(day);
   const pageText=await page.locator('main').innerText();
   assert.match(pageText,lessonPattern[day]);
   assert.doesNotMatch(item.reply.text,/visible activity|current page|lesson summary/i);
   if(day===3||day===5)assert.doesNotMatch(item.reply.text,/LoRA|GPU|adapter|train your model|start.{0,20}training/i,'Eve must teach agent configuration, not a training workflow');
  }

  if(!live){
   // A failed lesson handoff retains the same goal and handoff when Try again is used.
   await page.evaluate(()=>{cancelVoice();store.page='lab6';voiceSession.enabled=true;evePageVisit='';});
   const before=requests.length;failNext=true;await page.evaluate(()=>go('lab7'));
   const retry=page.locator('#eve-retry').getByRole('button',{name:'Try again',exact:true});await retry.waitFor();
   const failed=requests.at(-1);await retry.click();
   for(let i=0;i<400&&requests.length<before+2;i++)await new Promise(resolve=>setTimeout(resolve,25));
   const retried=requests.at(-1);
   assert.equal(retried.previous_takeaway,failed.previous_takeaway);
   assert.equal(retried.lesson_connection,failed.lesson_connection);
   assert.equal(retried.opening_action,failed.opening_action);
  }

  if(!live){
   const checks={
    3:[['Add an answer example','Your approved examples'],['Your approved examples','Knowledge library'],['Knowledge library','Add an answer example']],
    4:[['Focused or creative?','Write the behaviour rules'],['Write the behaviour rules','Questions to test it with'],['Questions to test it with','Focused or creative?']],
    5:[['Approved examples','What goes into your agent?'],['Compare agent answers','Save BusinessHelper']],
    6:[['Calculator','Tool trace preview'],['Tool trace preview','Knowledge search']],
   };
   for(const [day,activities] of Object.entries(checks)){
    await page.evaluate(day=>{const p=project();p.guidance.activityIndex[`lab${day}`]=0;evePageVisit='';go(`lab${day}`);},Number(day));
    for(let index=0;index<activities.length;index++){
     if(index){const before=replies.length;await page.getByRole('button',{name:'Next activity',exact:true}).click();for(let i=0;i<400&&replies.length===before;i++)await new Promise(resolve=>setTimeout(resolve,25));}
     const payload=await page.evaluate(day=>evePayload(Number(day),'Teach this visible activity.','guidance'),day);
     assert.match(payload.activity,new RegExp(activities[index][0].replace(/[?]/g,'\\?'),'i'),`Day ${day} activity ${index+1} was missing`);
     assert.doesNotMatch(payload.activity,new RegExp(activities[index][1].replace(/[?]/g,'\\?'),'i'),`Day ${day} included a hidden activity`);
     assert.deepEqual(payload.recent_turns,[]);
    }
   }
  }

  // An answered Day 3 question must not be replayed when Day 4 begins.
  const nonLinearBefore=replies.length;
  await page.evaluate(()=>{project().guidance.activityIndex.lab3=0;evePageVisit='';go('lab3');});
  for(let i=0;i<400&&!replies.at(-1)?.body?.lesson?.includes('Examples');i++)await new Promise(resolve=>setTimeout(resolve,25));
  const nonLinear=replies.slice(nonLinearBefore).findLast(item=>item.body.lesson==='Examples');
  assert.ok(nonLinear,'Non-linear Day 7 to Day 3 opening returned no guidance');
  assert.equal(nonLinear.body.previous_takeaway,'','A non-linear lesson choice received a false Day 2 recap');
  assert.equal(nonLinear.body.lesson_connection,'','A non-linear lesson choice received a false course handoff');
  assert.equal(nonLinear.body.opening_action,'','A non-linear lesson choice received a false previous-day action');
  const beforeQuestion=replies.length;
  await page.evaluate(()=>runVoice(3,'Why does an answer example need an answer?',true));
  for(let i=0;i<800&&replies.length===beforeQuestion;i++)await new Promise(resolve=>setTimeout(resolve,25));
  const answered=replies.at(-1).reply.text;
  const day4=await openDay(4);
  assert.ok(similarity(answered,day4.reply.text)<0.65,`Day 4 repeated the answered Day 3 question: ${day4.reply.text}`);
  assert.equal(day4.body.recent_turns.length,0);
  assert.deepEqual(errors,[]);
  console.log(`Eve alignment across Days 1–7, visible activities, and answered-question isolation passed (${live?'live Eve on every day':'mocked Eve on every activity'}).`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
