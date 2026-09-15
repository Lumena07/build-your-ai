const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),turns=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://127.0.0.1:8999/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1)||'index.html';
   if(!['index.html','app.js','curriculum.js','experience.js','gpu-client.js','runtime-config.js','styles.css'].includes(name))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(name),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  await page.route('http://127.0.0.1:8787/v1/teacher/**',route=>{
   if(!route.request().url().endsWith('/respond'))return route.fulfill({json:{audio_base64:''}});
   const body=route.request().postDataJSON(),reply={text:`${body.lesson}: continue with this one activity.`,assessment:body.turn_kind==='answer'?'correct':'none'};
   turns.push({body,reply});return route.fulfill({json:reply});
  });
  await page.goto('http://127.0.0.1:8999');
  await page.evaluate(()=>{
   const p=project();Object.assign(p,{preset:'business',name:'BusinessHelper',purpose:'Help a small business plan prices and daily work.',languages:'English',samples:['My item costs 80 and I sell it for 100. What is my profit?','Explain delivery costs simply.'],examples:[],behavior:'Use simple words.',evaluation:[],model:null,knowledge:[],tools:{calculator:false,knowledge:false,notes:false,tasks:false},completed:['intro']});
   Object.assign(p.guidance,{learnerName:'Anna',day1Step:1,day2Step:1,day2Discoveries:[],day2Answer:null,activityIndex:{},launchTests:{},eveHistory:[]});
   voiceSession.enabled=true;courseResuming=false;speakTurn=async()=>{};save();
  });
  async function waitTurn(before,label){
   for(let i=0;i<800&&turns.length===before;i++)await new Promise(resolve=>setTimeout(resolve,25));
   assert.ok(turns.length>before,`${label} did not ask Eve for guidance`);return turns.at(-1);
  }
  async function waitLesson(lesson,before,label){
   for(let i=0;i<800&&!turns.slice(before).some(turn=>turn.body.lesson===lesson);i++)await new Promise(resolve=>setTimeout(resolve,25));
   const turn=turns.slice(before).findLast(item=>item.body.lesson===lesson);assert.ok(turn,`${label} did not receive ${lesson} guidance`);return turn;
  }
  async function goDay(day){const before=turns.length;await page.evaluate(day=>{evePageVisit='';go(`lab${day}`);},day);return waitTurn(before,`Day ${day}`);}
  function assertTurn(turn,lesson,shown,hidden){
   assert.equal(turn.body.lesson,lesson);assert.match(turn.body.activity,shown);
   if(hidden)assert.doesNotMatch(turn.body.activity,hidden);
   assert.deepEqual(turn.body.recent_turns,[],'Automatic guidance reused an answered question');
  }
  function assertHandoff(turn,label){
   assert.ok(turn.body.previous_takeaway,`${label} did not carry the previous lesson goal`);
   assert.ok(turn.body.lesson_connection,`${label} did not connect the lessons`);
   assert.ok(turn.body.opening_action,`${label} did not identify the first current action`);
  }
  // Confirm the learner begins with aligned Day 1 and Day 2 introductions.
  let turn;
  turn=await goDay(1);assertTurn(turn,'What is AI?',/Does every computer program use AI/i,/Predict first/i);assertHandoff(turn,'Start here to Day 1');
  await page.evaluate(()=>{const p=project();p.completed.push('lab1');p.guidance.day2Step=1;save();});
  turn=await goDay(2);assertTurn(turn,'Tokens',/From answers to text pieces|preset question/i,/Token detective/i);assertHandoff(turn,'Day 1 to Day 2');
  await page.evaluate(()=>{const p=project();p.completed.push('lab2');save();});

  // Day 3: create, review and store examples, then distinguish knowledge.
  turn=await goDay(3);assertTurn(turn,'Examples',/Add an answer example/i,/Knowledge library/i);assertHandoff(turn,'Day 2 to Day 3');
  for(let index=1;index<=3;index++){
   await page.locator('#ex-in').fill(`Business question ${index}`);await page.locator('#ex-out').fill(`Useful answer ${index}`);
   const before=turns.length;await page.getByRole('button',{name:'Approve example'}).click();turn=await waitTurn(before,`Day 3 example ${index}`);assertTurn(turn,'Examples',/Add an answer example/i,/Knowledge library/i);
  }
  let before=turns.length;await page.getByRole('button',{name:'Next activity',exact:true}).click();turn=await waitTurn(before,'Day 3 review');assertTurn(turn,'Examples',/Your approved examples/i,/Add an answer example/i);
  before=turns.length;await page.getByRole('button',{name:'Next activity',exact:true}).click();turn=await waitTurn(before,'Day 3 knowledge');assertTurn(turn,'Examples',/Knowledge library/i,/Your approved examples/i);
  await page.locator('#source-title').fill('Business notes');await page.locator('#source-content').fill('Record income and expenses every day.');await page.getByRole('button',{name:'Add source'}).click();
  before=turns.length;await page.getByRole('button',{name:'Continue to behaviour →'}).click();await page.getByRole('button',{name:'A question paired with a clear, relevant answer'}).click();
  assert.equal(await page.evaluate(()=>store.page),'lab4');

  // Day 4: explore creativity, set a rule and save separate test questions.
  turn=await waitLesson('Behaviour',before,'Day 4 opening');assertTurn(turn,'Behaviour',/Focused or creative/i,/Questions to test it with/i);assertHandoff(turn,'Day 3 to Day 4');
  await page.locator('#temp').fill('0.8');
  before=turns.length;await page.getByRole('button',{name:'Next activity',exact:true}).click();turn=await waitTurn(before,'Day 4 rules');assertTurn(turn,'Behaviour',/Write the behaviour rules/i,/Focused or creative/i);
  await page.locator('#behavior').fill('Use two short sentences and one practical example.');
  before=turns.length;await page.getByRole('button',{name:'Next activity',exact:true}).click();turn=await waitTurn(before,'Day 4 tests');assertTurn(turn,'Behaviour',/Questions to test it with/i,/Write the behaviour rules/i);
  await page.locator('#eval1').fill('Explain cash flow simply.');await page.locator('#eval2').fill('How can I track stock?');
  before=turns.length;await page.getByRole('button',{name:'Save behaviour and tests →'}).click();await page.getByRole('button',{name:'Explain in two short sentences'}).click();
  assert.equal(await page.evaluate(()=>store.page),'lab5');

  // Day 5: pass the understanding gate, create a version and open comparison.
  turn=await waitLesson('Agent configuration',before,'Day 5 opening');assertTurn(turn,'Agent configuration',/Approved examples|Save BusinessHelper/i,/Compare agent answers/i);assertHandoff(turn,'Day 4 to Day 5');
  await page.getByRole('heading',{name:'Bring your agent together.'}).waitFor();
  assert.match(turn.body.lesson_summary,/Assemble the agent/);
  assert.doesNotMatch(await page.locator('main').innerText(),/GPU|LoRA|adapter|dataset|training progress|model creation/i);
  await page.evaluate(()=>{
   if(window.BuildAICloud.startTraining||window.BuildAICloud.trainingStatus)throw Error('Training bridge still exposed');
   window.trainingCalls=0;window.BUILD_AI_CONFIG.gpuEnabled=true;
   window.BuildAICloud.startTraining=()=>{window.trainingCalls++;throw Error('Training must never be called');};
   window.BuildAICloud.trainingStatus=()=>{window.trainingCalls++;throw Error('Training must never be polled');};
   project().training={id:'legacy-job',status:'QUEUED'};save();
   saveEveTurn(5,'eve','An old model-training explanation.');
   project().guidance.eveHistory.at(-1).pageContextVersion=2;
   if(evePayload(5,'What next?').recent_turns.some(turn=>turn.text.includes('old model-training')))throw Error('Old training dialogue reused');
  });
  await page.getByRole('button',{name:/Save BusinessHelper-1/}).click();await page.getByRole('button',{name:'Comparing answers to the same separate test question'}).click();
  assert.equal(await page.evaluate(()=>Boolean(project().model)),true);
  assert.equal(await page.evaluate(()=>window.trainingCalls),0);
  assert.equal(await page.evaluate(()=>project().model.kind),'agent-configuration');
  assert.equal(await page.evaluate(()=>project().model.configuration.behavior),'Use two short sentences and one practical example.');
  assert.equal(await page.evaluate(()=>project().model.configuration.examples.length),3);
  assert.equal(await page.evaluate(()=>project().model.configuration.knowledge.length),1);
  assert.equal(await page.evaluate(()=>project().training.id),'legacy-job','Do not cancel existing external jobs or erase learner data');
  const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)).projects.find(p=>p.id===store.active));
  assert.equal(persisted.model.kind,'agent-configuration');
  assert.equal(persisted.guidance.learnerName,'Anna');
  await page.evaluate(()=>{window.BUILD_AI_CONFIG.gpuEnabled=false;});
  await page.reload();
  await page.getByRole('button',{name:'Resume with Eve'}).waitFor();
  await page.evaluate(()=>{speakTurn=async()=>{};});
  await page.getByRole('button',{name:'Resume with Eve'}).click();
  await page.getByRole('heading',{name:'Bring your agent together.'}).waitFor();
  assert.equal(await page.evaluate(()=>project().model.kind),'agent-configuration');
  assert.equal(await page.evaluate(()=>project().model.configuration.examples.length),3);
  assert.equal(await page.evaluate(()=>project().training.id),'legacy-job');
  before=turns.length;await page.getByRole('button',{name:'Next activity',exact:true}).click();turn=await waitTurn(before,'Day 5 comparison');assertTurn(turn,'Agent configuration',/Compare agent answers/i,/Save a new agent version/i);
  before=turns.length;await page.getByRole('button',{name:'Give your agent tools →'}).click();assert.equal(await page.evaluate(()=>store.page),'lab6');

  // Day 6: enable a real visible tool choice, inspect its trace and continue.
  turn=await waitLesson('Tools',before,'Day 6 opening');assertTurn(turn,'Tools',/Calculator|Knowledge search/i,/Tool trace preview/i);assertHandoff(turn,'Day 5 to Day 6');
  before=turns.length;await page.getByRole('button',{name:/Calculator/}).click();turn=await waitTurn(before,'Day 6 calculator');assertTurn(turn,'Tools',/Calculator/i,/Tool trace preview/i);
  before=turns.length;await page.getByRole('button',{name:'Next activity',exact:true}).click();turn=await waitTurn(before,'Day 6 trace');assertTurn(turn,'Tools',/Tool trace preview/i,/Knowledge search/i);
  before=turns.length;await page.getByRole('button',{name:'Save my tools →'}).click();await page.getByRole('button',{name:'Computes the arithmetic'}).click();assert.equal(await page.evaluate(()=>store.page),'lab7');

  // Day 7: Eve follows each test state instead of replaying the prior answer.
  turn=await waitLesson('Launch',before,'Day 7 opening');assertTurn(turn,'Launch',/A normal question/i,/question it may not know/i);assertHandoff(turn,'Day 6 to Day 7');
  for(const expected of [/A normal question/i,/question it may not know/i,/tool task/i]){
   assert.match(await page.locator('main').innerText(),expected);
   before=turns.length;await page.getByRole('button',{name:'Try this question'}).click();turn=await waitTurn(before,'Day 7 trial');assert.equal(turn.body.lesson,'Launch');assert.deepEqual(turn.body.recent_turns,[]);
   await page.getByRole('button',{name:'I checked this answer'}).click();
  }
  await page.getByRole('button',{name:'Finish and save my agent'}).click();await page.getByRole('button',{name:'Admit the limit and ask for a reliable source'}).click();
  assert.equal(await page.evaluate(()=>store.page),'dashboard');
  await page.getByRole('heading',{name:'Your AI agent workshop.'}).waitFor();
  const saved=await page.evaluate(()=>({completed:project().completed,examples:project().examples.length,knowledge:project().knowledge.length,calculator:project().tools.calculator,tests:project().guidance.launchTests}));
  for(const lesson of ['lab1','lab2','lab3','lab4','lab5','lab6','lab7'])assert.ok(saved.completed.includes(lesson),`${lesson} was not saved as complete`);
  assert.equal(saved.examples,3);assert.equal(saved.knowledge,1);assert.equal(saved.calculator,true);assert.deepEqual(saved.tests,{normal:true,difficult:true,tool:true});
  assert.deepEqual(errors,[]);
  console.log('One learner completed Days 1–7 while Eve stayed aligned with every visible activity, gate and saved transition (mocked Eve).');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
