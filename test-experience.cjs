const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:8999/**',async route=>{
  const name=new URL(route.request().url()).pathname.slice(1)||'index.html';
  if(!['index.html','app.js','curriculum.js','experience.js','gpu-client.js','runtime-config.js','styles.css'].includes(name))return route.fulfill({status:404,body:''});
  await route.fulfill({body:fs.readFileSync(name),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
 });
 await page.goto('http://127.0.0.1:8999');
 await page.evaluate(()=>{project().guidance.learnerName='Emma';project().preset='business';project().name='My business AI';project().purpose=presets[2].purpose;project().samples=[...presets[2].samples];save();render();});
 // One visible activity; picking a preset reveals setup.
 assert.equal(await page.locator('main > .card:visible:not(#eve-debug)').count(),2); // learning goal plus preset card
 await page.getByRole('button',{name:/Business helper Help/}).click();
 await page.locator('#name').fill('Business assistant');
 await page.getByRole('button',{name:'Save my blueprint →'}).click();
 assert.match(await page.locator('main').innerText(),/Artificial intelligence/);
 // Day 1 must not inherit Start here instructions or legacy confused replies.
 const context=await page.evaluate(async()=>{
  const p=project();
  p.guidance.eveHistory.push({day:1,role:'eve',text:'Legacy incorrect welcome'});
  saveEveTurn(0,'eve','Choose a starting idea before Day 1');
  saveEveTurn(1,'learner','Can AI be wrong?');
  voiceSession.enabled=true;evePageVisit='';evePreviousPage='intro';let captured;
  window.BuildAICloud.teacherReply=async payload=>{captured=payload;throw Error('Test request captured');};
  await maybeWelcomeEve();cancelVoice();voiceSession.enabled=false;
  return captured;
 });
 assert.match(context.activity,/^CURRENT PAGE: Day 1/);
 assert.match(context.learner_message,/moved from Start here to Day 1/);
 assert.doesNotMatch(context.learner_message,/This is Start here, before Day 1/);
 assert.equal(context.learner_name,'Emma');
 assert.equal(context.preset_title,'Business helper');
 assert.match(context.previous_takeaway,/ready-made starting idea/);
 assert.match(context.lesson_connection,/discover what AI actually is/);
 assert.match(context.opening_action,/everyday AI tasks/);
 assert.deepEqual(context.available_presets,[]);
 assert.deepEqual(context.preset_examples,[]);
 assert.equal(context.current_question,'Does every computer program use AI?');
 assert.equal(context.turn_kind,'guidance');
 assert.doesNotMatch(context.activity,/profit|Predict first|Visible activity:/i);
 assert.equal(await page.locator('#eve-debug').count(),0);
 assert.deepEqual(context.recent_turns,[]);
 const conversationContext=await page.evaluate(()=>evePayload(1,'Please answer my follow-up.','conversation'));
 assert.deepEqual(conversationContext.recent_turns,[{role:'learner',text:'Can AI be wrong?'}]);
 const setupContext=await page.evaluate(()=>evePayload(0,'Help me choose'));
 assert.match(setupContext.activity,/^CURRENT PAGE: Start here/);
 assert.equal(setupContext.available_presets.length,6);
 // Written questions appear individually and require feedback before continuing.
 assert.equal(await page.locator('textarea[id^="day1-answer-"]').count(),1);
 assert.equal(await page.getByRole('button',{name:'See a sample answer'}).count(),0);
 assert.equal(await page.locator('#day1-next').isDisabled(),true);
 await page.evaluate(()=>{window.BuildAICloud.teacherReply=async payload=>{
  window.lastWrittenCheck=payload;
  return {text:payload.learner_message==='Yes'?'Not quite. An ordinary alarm follows a set time.':'Yes. That is a useful explanation.',assessment:payload.learner_message==='Yes'?'not_yet':'correct'};
 };});
 await page.locator('#day1-answer-ai').fill('Yes');
 await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
 await page.getByText('Eve: Not quite. An ordinary alarm follows a set time.',{exact:true}).waitFor();
 assert.equal(await page.locator('#day1-next').isDisabled(),true);
 await page.locator('#day1-answer-ai').fill('No');
 assert.equal(await page.locator('#day1-next').isDisabled(),true);
 await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
 await page.getByText('Eve: Yes. That is a useful explanation.',{exact:true}).waitFor();
 await page.evaluate(()=>render());
 assert.equal(await page.locator('#day1-answer-ai').inputValue(),'No');
 assert.equal(await page.locator('#day1-next').isDisabled(),false);
 // Speaking submits the same active question without inventing a new one.
 await page.evaluate(async()=>{
  voiceSession.enabled=true;
  const speak=playLiveEve;playLiveEve=async()=>{};
  await runVoice(1,'No',true);
  playLiveEve=speak;voiceSession.enabled=false;
 });
 assert.equal(await page.locator('#day1-answer-ai').inputValue(),'No');
 assert.equal(await page.evaluate(()=>window.lastWrittenCheck.turn_kind),'answer');
 assert.equal(await page.locator('#day1-next').isDisabled(),false);
 await page.getByRole('button',{name:'Next: make a prediction'}).click();
 const predictionContext=await page.evaluate(()=>evePayload(1,'Introduce this question.','guidance'));
 assert.deepEqual(predictionContext.recent_turns,[]);
 assert.equal(predictionContext.question_context,'My item costs 80 and I sell it for 100. What is my profit?');
 assert.doesNotMatch(predictionContext.activity,/Does every computer program/);
 assert.equal(await page.locator('#day1-answer-ai').count(),0);
 assert.equal(await page.locator('#day1-answer-predict').count(),1);
 assert.doesNotMatch(await page.locator('main').innerText(),/difference is 20/);
 await page.locator('#day1-answer-predict').fill('It could calculate the profit and explain other costs.');
 // An unavailable teacher leaves the answer intact and allows a retry.
 await page.evaluate(()=>{window.checkMock=window.BuildAICloud.teacherReply;window.BuildAICloud.teacherReply=async()=>{throw Error('Offline');};});
 await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
 await page.getByText(/Eve could not check your answer/).waitFor();
 assert.equal(await page.locator('#day1-next').isDisabled(),true);
 assert.equal(await page.locator('#day1-answer-predict').inputValue(),'It could calculate the profit and explain other costs.');
 await page.evaluate(()=>{window.BuildAICloud.teacherReply=window.checkMock;});
 await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
 await page.getByText('Eve: Yes. That is a useful explanation.',{exact:true}).waitFor();
 assert.match(await page.evaluate(()=>window.lastWrittenCheck.answer_guidance),/prediction, not a test of exact wording/);
 await page.getByRole('button',{name:'See a sample answer'}).click();
 assert.match(await page.locator('main').innerText(),/difference is 20/);
 await page.locator('#day1-answer-source').fill('From training examples and the current question.');
 await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
 await page.getByText('Eve: Yes. That is a useful explanation.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'What should I check?'}).click();
 await page.locator('#day1-answer-evidence').fill('Future sales cannot be known for certain.');
 await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
 await page.getByText('Eve: Yes. That is a useful explanation.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Try a small task'}).click();
 await page.getByRole('button',{name:'Use a fluent answer as evidence that it is correct',exact:true}).click();
 assert.match(await page.locator('#detail-feedback').innerText(),/still be wrong/);
 await page.getByRole('button',{name:'Use the answer as a starting point and check important claims',exact:true}).click();
 await page.getByRole('button',{name:'Next: explain AI'}).click();
 await page.locator('#day1-answer-explain').fill('AI learns patterns to help answer questions.');
 await page.getByRole('button',{name:'Check with Eve',exact:true}).click();
 await page.getByText('Eve: Yes. That is a useful explanation.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Check what I learned'}).click();
 await page.getByRole('button',{name:'Trust every answer',exact:true}).click();
 assert.match(await page.locator('#check-feedback').innerText(),/Try the other/);
 assert.equal(await page.evaluate(()=>store.page),'lab1');
 await page.getByRole('button',{name:'Check important facts',exact:true}).click();
 assert.equal(await page.evaluate(()=>store.page),'lab2');
 // Resume preserves page and work; restart targets just the active learner.
 await page.reload();await page.getByRole('button',{name:'Resume with Eve'}).waitFor();
 await page.evaluate(()=>{voiceSession.enabled=false;window.BuildAICloud.teacherReply=async()=>({text:'Test guidance'});window.BuildAICloud.teacherSpeech=async()=>{throw Error('Test audio offline');};});
 await page.getByRole('button',{name:'Resume with Eve'}).click();
 await page.getByRole('button',{name:'Try again',exact:true}).first().waitFor();
 assert.equal(await page.evaluate(()=>store.page),'lab2');
 await page.evaluate(()=>{voiceSession.enabled=false;cancelVoice();const other=defaultProject();other.name='Other learner';store.projects.push(other);save();});
 page.once('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Restart this learner'}).click();
 await page.getByRole('button',{name:'Start AI 102',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>store.projects.some(p=>p.name==='Other learner')),true);
 assert.equal(await page.evaluate(()=>project().guidance.learnerName),'');
 // Moving between activities preserves written work.
 await page.evaluate(()=>{project().guidance.learnerName='Emma';project().preset='business';store.page='lab4';render();});
 await page.getByRole('button',{name:'Next activity',exact:true}).click();
 await page.locator('#behavior').fill('Use two short sentences and show the cost.');
 await page.getByRole('button',{name:'Next activity',exact:true}).click();
 await page.getByRole('button',{name:'Previous activity',exact:true}).click();
 assert.equal(await page.locator('#behavior').inputValue(),'Use two short sentences and show the cost.');
 // Late replies cannot replace the current reply.
 await page.evaluate(async()=>{
  voiceSession.enabled=true;let finish;
  let calls=0;
  window.BuildAICloud.teacherReply=async()=>{calls++;return {text:'Wrong page'};};
  await runVoice(0,'Late Start here trigger');
  if(calls!==0)throw Error('Wrong-page request was sent');
  store.page='lab1';
  window.BuildAICloud.teacherReply=()=>new Promise(resolve=>{finish=resolve;});
  const task=runVoice(1,'Old turn');go('lab2');finish({text:'Stale reply'});await task;
  if(eveDebug.reply==='Stale reply')throw Error('Stale reply accepted');
  voiceSession.enabled=false;
 });
 // Leaving a written check preserves the draft and discards late feedback.
 await page.evaluate(async()=>{
  store.page='lab1';project().guidance.day1Step=1;project().guidance.day1Predict=false;render();
  const input=document.getElementById('day1-answer-ai');input.value='My saved new attempt';input.dispatchEvent(new Event('input',{bubbles:true}));
  let resolve;window.BuildAICloud.teacherReply=()=>new Promise(done=>{resolve=done;});
  const task=checkDay1Answer('ai');go('lab2');resolve({text:'Late written feedback'});await task;
  if(project().guidance.day1Answers?.ai?.feedback==='Late written feedback')throw Error('Stale written feedback saved');
  go('lab1');
  if(document.getElementById('day1-answer-ai').value!=='My saved new attempt')throw Error('Written draft lost');
  if(project().guidance.day1Answers?.ai?.answer===document.getElementById('day1-answer-ai').value)throw Error('Edited answer accepted without checking');
 });
 // Three distinct launch checks persist before completion.
 await page.evaluate(()=>{const p=project();p.guidance.learnerName='Emma';p.preset='business';p.model={name:'Practice',version:1};p.completed=['intro'];store.page='lab7';render();});
 for(let i=0;i<3;i++){
  await page.getByRole('button',{name:'Try this question',exact:true}).click();
  await page.getByRole('button',{name:'I checked this answer',exact:true}).click();
 }
 await page.getByRole('button',{name:'Finish and save my assistant'}).click();
 await page.getByRole('button',{name:'Admit the limit and ask for a reliable source'}).click();
 assert.equal(await page.evaluate(()=>store.page),'dashboard');
 assert.deepEqual(errors,[]);
 await browser.close();console.log('Beginner journey, misconception retry, resume, isolated reset, voice failure, stale turn and launch tests passed.');
})().catch(e=>{console.error(e);process.exit(1);});
