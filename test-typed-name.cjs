const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://127.0.0.1:8999/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1)||'index.html';
   if(!['index.html','app.js','curriculum.js','experience.js','gpu-client.js','runtime-config.js','styles.css'].includes(name))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(name),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  // No OpenAI or physical microphone is used in these interaction tests.
  await page.addInitScript(()=>{
   window.nameTestMicCalls=0;
   navigator.mediaDevices.getUserMedia=async()=>{window.nameTestMicCalls++;throw Error('Microphone denied for test');};
  });
  await page.goto('http://127.0.0.1:8999');
  await page.evaluate(()=>{
   window.BuildAICloud.teacherReply=async()=>{throw Error('Teacher offline for test');};
   window.BuildAICloud.teacherSpeech=async()=>{throw Error('Audio offline for test');};
  });
  // Blank names cannot skip onboarding. Drafts survive refresh before submission.
  assert.equal(await page.locator('#eve-orb').count(),0,'Onboarding must not offer a microphone button');
  assert.doesNotMatch(await page.locator('main').innerText(),/say your name|speak or type|or type your name/i);
  await page.getByRole('button',{name:'Start AI 102',exact:true}).click();
  assert.match(await page.locator('#learner-name-error').innerText(),/Please type/);
  assert.equal(await page.evaluate(()=>project().guidance.learnerName),'');
  await page.locator('#learner-name').fill('  Emma Jane  ');
  await page.reload();
  assert.equal(await page.locator('#learner-name').inputValue(),'  Emma Jane  ');
  await page.evaluate(()=>{window.BuildAICloud.teacherReply=async()=>{throw Error('Teacher offline for test');};});
  await page.getByRole('button',{name:'Start AI 102',exact:true}).click();
  await page.getByRole('heading',{name:'What would you like your agent to help with?'}).waitFor();
  assert.equal(await page.evaluate(()=>project().guidance.learnerName),'Emma Jane');
  assert.equal(await page.evaluate(()=>project().guidance.awaitingName),false);
  assert.equal(await page.evaluate(()=>window.nameTestMicCalls),0);
  // Name persists on Day 1 and after resume even when the teacher is offline.
  await page.getByRole('button',{name:/Biology tutor Help/}).click();
  await page.locator('#name').fill('BiologyTutor');
  await page.getByRole('button',{name:'Save my blueprint →'}).click();
  assert.equal(await page.evaluate(()=>store.page),'lab1');
  assert.equal(await page.evaluate(()=>evePayload(1,'Hello').learner_name),'Emma Jane');
  await page.reload();
  await page.getByRole('heading',{name:'Welcome back, Emma Jane.'}).waitFor();
  await page.evaluate(()=>{window.BuildAICloud.teacherReply=async()=>{throw Error('Teacher offline for test');};});
  await page.getByRole('button',{name:'Resume with Eve'}).click();
  assert.equal(await page.evaluate(()=>store.page),'lab1');
  assert.equal(await page.evaluate(()=>project().guidance.learnerName),'Emma Jane');
  // Old saved spoken-name onboarding now uses typing only, without microphone access.
  await page.evaluate(()=>{
   cancelVoice();const fresh=defaultProject();store.projects=[fresh];store.active=fresh.id;store.page='intro';courseResuming=false;voiceSession.enabled=false;evePageVisit='';save();render();
   fresh.guidance.awaitingName=true;save();render();
   window.BuildAICloud.teacherSpeech=async()=>{throw Error('Audio offline for test');};
  });
  await page.reload();
  assert.equal(await page.locator('#eve-orb').count(),0);
  assert.match(await page.locator('main').innerText(),/Type your name to meet Eve/);
  await page.evaluate(async()=>{
   window.BuildAICloud.teacherReply=async()=>{throw Error('Teacher offline for test');};
   await recordTurn(0);
  });
  assert.equal(await page.evaluate(()=>window.nameTestMicCalls),0,'Recording before a typed name must be blocked');
  await page.locator('#learner-name').fill('Éma');
  await page.locator('#learner-name').press('Enter');
  await page.getByRole('heading',{name:'What would you like your agent to help with?'}).waitFor();
  assert.equal(await page.evaluate(()=>project().guidance.learnerName),'Éma');
  assert.equal(await page.evaluate(()=>project().guidance.awaitingName),false);
  // Eve's regular lesson voice button remains available after typed onboarding.
  await page.evaluate(()=>cancelVoice());
  assert.equal(await page.locator('#eve-orb').count(),1);
  await page.locator('#eve-orb').click();
  await page.waitForFunction(()=>window.nameTestMicCalls===1&&voiceSession.phase==='error');
  assert.equal(await page.evaluate(()=>project().guidance.learnerName),'Éma');
  assert.deepEqual(errors,[]);
  console.log('Typing-only onboarding, Start/Enter submission, blank validation, saved draft/name, legacy saved state, Day 1 resume, offline teacher and retained lesson voice control passed (mocked services).');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
