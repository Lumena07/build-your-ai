// Learner experience: one voice turn, one activity, and checks before completion.
const presetPractice={
 tutor:{question:'Why do plants need sunlight?',answer:'Plants use light to help turn water and carbon dioxide into food. This process is called photosynthesis.',tool:'What is 25 * 4?',hard:'What will be on my exact biology exam tomorrow?'},
 study:{question:'How can I revise for a test next week?',answer:'Choose one topic today. Try two questions without your notes, check your answers, and practise the part you found difficult.',tool:'What is 20 * 5?',hard:'What exact mark will I get next week?'},
 business:{question:'My item costs 80 and I sell it for 100. What is my profit?',answer:'The difference is 20 per item before other expenses. Include delivery, rent and other costs before deciding whether the price works.',tool:'What is 100 - 80?',hard:'How many customers will buy from me tomorrow?'},
 aviation:{question:'How should I prepare for an internal audit?',answer:'Identify the scope and current approved procedures, then gather evidence against their requirements. Confirm details with the responsible team.',tool:'What is 12 * 5?',hard:'Is our operation compliant without reviewing our approved procedures?'},
 writer:{question:'Make this request more polite: Send the report today.',answer:'Could you please send the report today? Thank you.',tool:'What is 250 * 4?',hard:'What did the author secretly intend by this sentence?'},
 coach:{question:'How can I start a goal that feels too big?',answer:'Choose one action you can do in ten minutes today. After trying it, decide on one manageable next step.',tool:'What is 10 * 7?',hard:'Can you guarantee I will reach every goal this month?'}
};
const tinyChecks={
 lab1:['Your assistant sounds certain. What should you do?', ['Trust every answer','Check important facts'],1,'AI can sound confident even when it is wrong. Check an important fact before using it.'],
 lab2:['Is every token a whole word?', ['No — it may be part of a word or punctuation','Yes — always'],0,'Tokens are pieces of text. A piece may be smaller than a word.'],
 lab3:['Which example helps teach useful answers?', ['A question paired with a clear, relevant answer','A question paired with “I am helpful”'],0,'The answer should actually help with the question, so the example shows what good work looks like.'],
 lab4:['Which instruction is easier to follow?', ['Be amazing','Explain in two short sentences'],1,'A specific rule makes it easier to judge whether the AI followed it.'],
 lab5:['What proves your version is more useful?', ['Its new name','Comparing answers to the same separate test question'],1,'Compare the same question and check accuracy and usefulness. A name or version number is not evidence.'],
 lab6:['What does the calculator tool do?', ['Computes the arithmetic','Guesses a likely sentence'],0,'The tool computes a result. Look for the actual tool result when checking the answer.'],
 lab7:['Your assistant cannot know an answer. What is useful behaviour?', ['Admit the limit and ask for a reliable source','Invent a confident answer'],0,'A useful assistant acknowledges missing information instead of inventing facts.']
};
let voiceSession={generation:0,phase:'idle',retry:null,recorder:null,stream:null,source:null,context:null,enabled:false};
let pendingCheck=null,courseResuming=false;
let launchTrial=null;

function guidedDay1(){
 const p=project(),x=presetPractice[p.preset]||presetPractice.tutor,step=p.guidance.day1Step||1;
 const content=[
  `<h2>What could your assistant help with?</h2><p>${esc(x.question)}</p><p>Imagine asking your chosen assistant this question.</p><button class="button" onclick="advanceDay1(2)">See a sample answer</button>`,
  `<h2>A sample answer</h2><p>${esc(x.answer)}</p><p>This prepared example shows the kind of help you want. A real AI generates an answer using learned patterns and your request.</p><button class="button" onclick="advanceDay1(3)">What should I check?</button>`,
  `<h2>An answer can sound right and still be wrong</h2><p>Consider this question: ${esc(x.hard)}</p><p>Your AI would need information it does not have. A useful answer should acknowledge that limit.</p><button class="button" onclick="advanceDay1(4)">Try a small task</button>`,
  `<h2>Which request gives clearer direction?</h2><p>${esc(x.question)}</p><button class="button secondary" onclick="day1ChooseDetail(false)">Just be helpful</button> <button class="button secondary" onclick="day1ChooseDetail(true)">Explain in two short sentences with one example</button><p id="detail-feedback" aria-live="polite"></p><button class="button" onclick="finishLab('lab1','lab2')">Check what I learned</button>`
 ];
 return `${header('DAY 1 · WHAT IS AI?','AI learns patterns from examples.','Your request guides its answer. Important answers still need checking.')}<div class="card">${content[Math.min(3,step-1)]}</div>`;
}
function day1ChooseDetail(correct){
 project().guidance.detailTask=correct;save();
 document.getElementById('detail-feedback').textContent=correct?'Yes. A specific length and example give clearer direction.':'“Be helpful” is vague. Try the option that describes the answer you want.';
 eveTeachMoment(1,correct?'The learner chose specific instructions. Briefly acknowledge the reasoning, then invite the understanding check.':'The learner chose vague instructions. Explain why the more specific request helps using their preset, and invite another attempt.');
}
function guidedLaunch(){
 const p=project();if(!p.model)return `${header('DAY 7 · TEST','Prepare your version first.','Then test it with three different questions.')}<div class="card"><button class="button" onclick="go('lab5')">Open Day 5</button></div>`;
 const tests=p.guidance.launchTests||{},kind=['normal','difficult','tool'].find(k=>!tests[k])||'done';
 const x=presetPractice[p.preset]||presetPractice.tutor;
 const q={normal:x.question,difficult:x.hard,tool:x.tool}[kind];
 return `${header('DAY 7 · TEST YOUR ASSISTANT','Try it before relying on it.',p.model.adapterKey?'This version is connected to a model service.':'Practice mode: these results demonstrate saved examples and local tools. They are not live model answers.')}<div class="card">${kind==='done'?'<h2>You reviewed all three tests.</h2><p>You tried a normal request, an unknown answer and a tool. Keep checking important answers.</p><button class="button" onclick="launch()">Finish and save my assistant</button>':`<h2>${{normal:'1. A normal question',difficult:'2. A question it may not know',tool:'3. A tool task'}[kind]}</h2><p>${esc(q)}</p><button class="button" id="run-trial" onclick="runLaunchTrial('${kind}')">Try this question</button><div id="trial-answer" aria-live="polite"></div>`}</div>`;
}
async function runLaunchTrial(kind){
 const p=project(),x=presetPractice[p.preset]||presetPractice.tutor,q={normal:x.question,difficult:x.hard,tool:x.tool}[kind];
 const button=document.getElementById('run-trial');button.disabled=true;const id=p.id;
 try{
  let text;
  if(p.model.adapterKey&&window.BuildAICloud.enabled())text=(await window.BuildAICloud.chat(p,q)).text;
  else if(kind==='normal')text=x.answer;
  else if(kind==='difficult')text='I do not have enough information to know that. Please check a reliable source or provide the missing details.';
  else if(p.tools.calculator)text=generateReply(q,p,'agent').text;
  else text='Calculator is off. Enable it in Day 6 to run this tool task.';
  if(store.page!=='lab7'||project().id!==id)return;
  launchTrial={kind,text};
  document.getElementById('trial-answer').innerHTML=`<p>${esc(text)}</p><p>${kind==='tool'?'Check the arithmetic and whether the calculator was enabled.':kind==='difficult'?'Does this admit the information it does not have?':'Does this actually answer the question? Check a fact in it.'}</p><button class="button secondary" onclick="reviewLaunchTrial()">I checked this answer</button>`;
  eveTeachMoment(7,`The learner ran the ${kind} test. Actual displayed answer: ${text}. Ask them to review it against the visible check, without automatically praising accuracy.`);
 }catch(e){document.getElementById('trial-answer').textContent=e.message;}finally{button.disabled=false;}
}
function reviewLaunchTrial(){if(!launchTrial)return;const p=project();if(launchTrial.kind==='tool'&&!p.tools.calculator){go('lab6');return;}p.guidance.launchTests??={};p.guidance.launchTests[launchTrial.kind]=true;launchTrial=null;save();render();}

function voiceState(phase,error=''){
 voiceSession.phase=phase;
 const label={idle:'Talk to Eve',recording:'Finish speaking',thinking:'Eve is preparing…',speaking:'Stop Eve',error:'Try again'}[phase];
 const orb=document.getElementById('eve-orb');
 if(orb){orb.disabled=phase==='thinking';orb.textContent=label;orb.setAttribute('aria-label',label);orb.onclick=()=>useEve(store.page==='intro'?0:labDay(store.page));}
 updateEveDebug(label,{error});
 let retry=document.getElementById('eve-retry');
 if(!retry){retry=document.createElement('div');retry.id='eve-retry';document.querySelector('main')?.append(retry);}
 if(retry)retry.innerHTML=error?'<p>Eve could not finish this turn.</p><button class="button" onclick="retryEve()">Try again</button>':'';
}
function cancelVoice(){
 voiceSession.generation++;
 if(voiceSession.recorder){voiceSession.recorder.onstop=null;if(voiceSession.recorder.state==='recording')voiceSession.recorder.stop();}
 voiceSession.stream?.getTracks().forEach(t=>t.stop());
 if(voiceSession.source){voiceSession.source.onended=null;try{voiceSession.source.stop();}catch{}}
 Object.assign(voiceSession,{recorder:null,stream:null,source:null,retry:null});
 voiceState('idle');
}
async function speakTurn(text,token){
 voiceState('thinking');
 const audio=await window.BuildAICloud.teacherSpeech(text);
 if(token!==voiceSession.generation)return;
 const context=unlockEveAudio();
 if(!context)throw Error('Audio is unavailable in this browser.');
 await context.resume();
 const bytes=Uint8Array.from(atob(audio.audio_base64),c=>c.charCodeAt(0));
 const buffer=await context.decodeAudioData(bytes.buffer);
 if(token!==voiceSession.generation)return;
 const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);
 voiceSession.source=source;voiceState('speaking');
 source.onended=()=>{if(token===voiceSession.generation){voiceSession.source=null;voiceSession.retry=null;voiceState('idle');}};
 source.start();
}
async function runVoice(day,message,learner=false){
 if(!voiceSession.enabled||voiceSession.phase==='recording')return;
 cancelVoice();const token=voiceSession.generation;
 voiceSession.retry=()=>runVoice(day,message,false);
 if(learner)saveEveTurn(day,'learner',message);
 voiceState('thinking');
 try{
  const reply=await window.BuildAICloud.teacherReply(evePayload(day,message));
  if(token!==voiceSession.generation)return;
  if(!reply.text?.trim())throw Error('No teaching answer was returned.');
  saveEveTurn(day,'eve',reply.text);updateEveDebug('Eve received her answer.',{reply:reply.text,error:''});
  voiceSession.retry=()=>playLiveEve(reply.text,day);
  await speakTurn(reply.text,token);
 }catch(error){if(token===voiceSession.generation)voiceState('error',error.message);}
}
function retryEve(){voiceSession.enabled=true;unlockEveAudio();const retry=voiceSession.retry;if(retry)retry();else useEve(store.page==='intro'?0:labDay(store.page));}

async function recordTurn(day){
 if(voiceSession.phase==='recording'){if(voiceSession.recorder?.state==='recording'){voiceState('thinking');voiceSession.recorder.stop();}return;}
 if(voiceSession.phase==='thinking')return;
 cancelVoice();const token=voiceSession.generation;voiceState('thinking');
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  if(token!==voiceSession.generation){stream.getTracks().forEach(t=>t.stop());return;}
  const recorder=new MediaRecorder(stream),chunks=[];voiceSession.stream=stream;voiceSession.recorder=recorder;
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.onerror=()=>{stream.getTracks().forEach(t=>t.stop());if(token===voiceSession.generation)voiceState('error','Recording failed. Please try again.');};
  recorder.onstop=async()=>{
   stream.getTracks().forEach(t=>t.stop());voiceSession.stream=null;voiceSession.recorder=null;
   const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
   async function transcribe(){
    voiceState('thinking');
    try{
     if(!blob.size)throw Error('No recording was captured.');
     const heard=await window.BuildAICloud.teacherTranscribe(blob,project().languages==='Swahili'?'sw':'en');
     if(token!==voiceSession.generation)return;
     if(!heard.text?.trim())throw Error('No words were recognised.');
     updateEveDebug('Eve heard you.',{heard:heard.text,error:''});
     voiceState('idle');
     const p=project();
     if(p.guidance.awaitingName){
      const name=nameFromSpeech(heard.text);if(!name)throw Error('Please say your name once more.');
      p.guidance.learnerName=name;p.guidance.awaitingName=false;save();evePageVisit='';render();
     }else await runVoice(day,heard.text,true);
    }catch(error){if(token===voiceSession.generation){voiceSession.retry=blob.size?transcribe:()=>recordTurn(day);voiceState('error',error.message);}}
   }
   await transcribe();
  };
  recorder.start();voiceState('recording');
 }catch(error){if(token===voiceSession.generation){voiceSession.retry=()=>recordTurn(day);voiceState('error',error.message);}}
}

function askTinyCheck(page,proceed){
 const c=tinyChecks[page];if(!c){proceed();return;}
 pendingCheck={page,proceed};
 const main=document.querySelector('main');
 main.innerHTML=`<div class="eyebrow">ONE SMALL CHECK</div><h1>${esc(c[0])}</h1><div class="card">${c[1].map((a,i)=>`<button class="button secondary" onclick="answerTinyCheck(${i})">${esc(a)}</button>`).join(' ')}<p id="check-feedback" aria-live="polite"></p></div>${eveVoiceButton(labDay(page))}`;
 eveTeachMoment(labDay(page),`The current screen is a comprehension check: ${c[0]} Choices: ${c[1].join(' or ')}. Ask the learner to select their answer on screen. Do not give the answer yet.`);
}
function answerTinyCheck(answer){
 if(!pendingCheck)return;
 const {page,proceed}=pendingCheck,c=tinyChecks[page],ok=answer===c[2];
 document.getElementById('check-feedback').textContent=ok?'That is right. '+c[3]:c[3]+' Try the other answer.';
 const p=project();p.guidance.checks??={};p.guidance.checks[page]={passed:ok,attempts:(p.guidance.checks[page]?.attempts||0)+1};save();
 if(ok){pendingCheck=null;proceed();}else eveTeachMoment(labDay(page),`The learner chose: ${c[1][answer]}. Explain this misconception with their preset: ${c[3]}. Ask them to try the visible choices again.`);
}

function restartLearner(){
 if(!confirm('Restart this learner? This removes this learner’s name, conversations and AI project from this browser. Other projects stay saved.'))return;
 cancelVoice();const id=store.active;store.projects=store.projects.filter(p=>p.id!==id);
 const fresh=defaultProject();store.projects.push(fresh);store.active=fresh.id;store.page='intro';
 voiceSession.enabled=false;courseResuming=false;pendingCheck=null;evePageVisit='';save();render();
}
function resumeLearner(){courseResuming=false;voiceSession.enabled=true;unlockEveAudio();evePageVisit='';render();}

function decorateActivities(){
 const p=project(),main=document.querySelector('main');if(!main)return;
 if(courseResuming){main.innerHTML=`<h1>Welcome back, ${esc(p.guidance.learnerName)}.</h1><p>Your work is saved. Continue where you left off.</p><button class="button" onclick="resumeLearner()">Resume with Eve</button><button class="button secondary" onclick="restartLearner()">Restart this learner</button>`;return;}
 const bar=main.querySelector('.topbar');
 if(bar&&p.guidance.learnerName)bar.insertAdjacentHTML('beforeend','<button class="button ghost" onclick="restartLearner()">Restart this learner</button>');
 if(!p.guidance.learnerName)return;
 for(const [id,value] of Object.entries(p.guidance.drafts?.[store.page]||{})){
  const field=document.getElementById(id);if(field&&'value' in field)field.value=value;
 }
 // Split side-by-side form/review cards into separate beginner activities.
 Array.from(main.children).filter(el=>el.matches('.grid')&&Array.from(el.children).every(child=>child.matches('.card'))).forEach(grid=>grid.replaceWith(...Array.from(grid.children)));
 const blocks=Array.from(main.children).filter(el=>el.matches('.card,.grid,.grid3')&&!el.matches('#eve-debug,[aria-label]'));
 if(blocks.length>1){
  p.guidance.activityIndex??={};const index=Math.min(p.guidance.activityIndex[store.page]||0,blocks.length-1);
  blocks.forEach((el,i)=>{el.hidden=i!==index;});
  const controls=document.createElement('div');controls.className='actions';
  controls.innerHTML=`<button class="button secondary" ${index===0?'disabled':''} onclick="switchActivity(-1)">Previous activity</button><span>Activity ${index+1} of ${blocks.length}</span><button class="button secondary" ${index===blocks.length-1?'disabled':''} onclick="switchActivity(1)">Next activity</button>`;
  blocks[index].after(controls);
 }
 voiceState(voiceSession.phase,eveDebug.error||'');
}
function switchActivity(delta){
 const p=project();p.guidance.activityIndex??={};p.guidance.activityIndex[store.page]=Math.max(0,(p.guidance.activityIndex[store.page]||0)+delta);save();render();
 eveTeachMoment(labDay(store.page)||0,'The learner opened another activity. Use only the visible activity described in context. Introduce one small action.');
}

function installExperience(){
 document.addEventListener('input',event=>{
  const field=event.target;
  if(!field.id||!field.matches('input,textarea,select')||field.id==='chat-input')return;
  const p=project();p.guidance.drafts??={};p.guidance.drafts[store.page]??={};p.guidance.drafts[store.page][field.id]=field.value;save();
 });
 lab1=guidedDay1;
 lab7=guidedLaunch;
 temperaturePreview=function(){const el=document.getElementById('temp');if(!el)return;const x=presetPractice[project().preset]||presetPractice.tutor;document.getElementById('temp-value').textContent=Number(el.value).toFixed(1);document.getElementById('temp-answer').textContent=(Number(el.value)<.5?'Focused example: ':'More conversational example: ')+x.answer+(Number(el.value)<.5?'':' Let’s work through one small part together.');};
 courseGuide.lab1.steps=['Read your preset question.','Inspect a prepared sample answer.','Notice an answer the assistant cannot know.','Choose a clearer request and complete a small understanding check.'];
 const baseRender=render;
 render=function(){baseRender();decorateActivities();};
 const baseContext=teacherPageContext;
 teacherPageContext=function(day){
  if(pendingCheck){const c=tinyChecks[pendingCheck.page];return `Current screen: understanding check. ${c[0]} Choices: ${c[1].join(' / ')}. Explain errors simply and invite a click. Do not claim a spoken answer has submitted the check.`;}
  const visible=Array.from(document.querySelectorAll('main > .card, main > .grid, main > .grid3')).filter(el=>!el.hidden&&!el.matches('#eve-debug,[aria-label]')).map(el=>el.innerText.slice(0,700)).join(' ');
  return `Visible activity: ${visible}\n${baseContext(day)}`;
 };
 stopEve=cancelVoice;
 useEve=async function(day){voiceSession.enabled=true;unlockEveAudio();if(voiceSession.phase==='speaking'){cancelVoice();return;}if(voiceSession.phase==='error'){retryEve();return;}await recordTurn(day);};
 toggleEveRecording=recordTurn;
 playLiveEve=async function(text,day){cancelVoice();const token=voiceSession.generation;voiceSession.retry=()=>playLiveEve(text,day);updateEveDebug('Eve is preparing speech.',{reply:text,error:''});try{await speakTurn(text,token);}catch(e){if(token===voiceSession.generation)voiceState('error',e.message);}};
 sendLiveEve=(day,message)=>runVoice(day,message,true);
 eveTeachMoment=(day,message)=>runVoice(day,message);
 const welcome=maybeWelcomeEve;
 maybeWelcomeEve=()=>{if(!courseResuming&&voiceSession.enabled&&!pendingCheck)return welcome();};
 const start=startAI102;
 startAI102=async()=>{if(voiceSession.phase==='thinking'||voiceSession.phase==='speaking')return;voiceSession.enabled=true;await start();voiceState(voiceSession.phase);};
 const originalFinish=finishLab;
 finishLab=(page,next)=>{
  if(page==='lab1'&&!project().guidance.detailTask){toast('Try the clearer-request task first.');return;}
  if(page==='lab3'&&project().examples.length<3){toast('Approve three useful examples before continuing.');return;}
  askTinyCheck(page,()=>originalFinish(page,next));
 };
 for(const [page,name] of [['lab2','saveLab2'],['lab4','saveLab4']]){
  const original=name==='saveLab2'?saveLab2:saveLab4;
  const wrapped=()=>{
   // Save entered values before displaying the question (which replaces the form).
   const p=project();
   if(page==='lab2')p.samples=[document.getElementById('sample1').value,document.getElementById('sample2').value];
   else{p.behavior=document.getElementById('behavior').value;p.temperature=Number(document.getElementById('temp').value);p.evaluation=[document.getElementById('eval1').value,document.getElementById('eval2').value];}
   save();askTinyCheck(page,()=>{complete(page);go(page==='lab2'?'lab3':'lab5');});
  };
  if(name==='saveLab2')saveLab2=wrapped;else saveLab4=wrapped;
 }
 const create=createModel;createModel=()=>askTinyCheck('lab5',()=>{render();create();});
 const originalLaunch=launch;launch=()=>{if(!['normal','difficult','tool'].every(k=>project().guidance.launchTests?.[k])){toast('Review the three tests first.');return;}askTinyCheck('lab7',originalLaunch);};
 useSuggestedExample=()=>{const p=project(),x=presetPractice[p.preset]||presetPractice.tutor,index=p.examples.length%3;document.getElementById('ex-in').value=[x.question,x.hard,'Explain your main job in one sentence.'][index];document.getElementById('ex-out').value=[x.answer,'I do not have enough information to know that. Please provide a reliable source or the missing details.',day1Preset(p).purpose][index];};
 const originalPreset=choosePreset;
 choosePreset=async id=>{const p=project();if(p.guidance.drafts)delete p.guidance.drafts.intro;p.guidance.activityIndex??={};p.guidance.activityIndex.intro=1;await originalPreset(id);};
 courseResuming=Boolean(project().guidance.learnerName);
}
