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
 lab4:['What does higher temperature mainly change?', ['How accurate the AI is','How much variety its choices allow'],1,'Temperature changes variety, not guaranteed accuracy. Lower temperature is a sensible starting point for these agents.'],
 lab5:['How can you judge whether your agent helps?', ['Its new name','Comparing answers to the same separate test question'],1,'Compare answers and check accuracy and usefulness. A name alone is not evidence.'],
 lab6:['Why give an agent a tool?', ['To perform a specific action and return a result','To make every answer automatically correct'],0,'A tool performs a specific action. Inspect its actual result; tools do not guarantee every answer is correct.'],
 lab7:['Your assistant cannot know an answer. What is useful behaviour?', ['Admit the limit and ask for a reliable source','Invent a confident answer'],0,'A useful assistant acknowledges missing information instead of inventing facts.']
};
let voiceSession={generation:0,phase:'idle',retry:null,recorder:null,stream:null,source:null,context:null,enabled:false};
let pendingCheck=null,courseResuming=false;
let launchTrial=null;

const day1Questions={
 ai:{question:'Does every computer program use AI?',rubric:'No. An ordinary alarm follows a set time; many modern AI systems learn patterns from examples. Accept a simple no as correct.'},
 predict:{question:'What might it say?',rubric:'Accept any plausible useful response or description of how the selected agent could help with this preset request. This is a prediction, not a test of exact wording. Do not require the learner to know the subject answer.'},
 source:{question:'Where does your agent’s generated answer come from?',rubric:'Learned patterns from training examples and the current information or request. It does not automatically search the internet or know everything.'},
 evidence:{question:'What information is missing for the request below?',rubric:'Identify relevant missing evidence or explain that a future outcome or private intention cannot be guaranteed. Accept reasonable uncertainty.'},
 explain:{question:'In your own words, what is AI?',rubric:'Accept a simple explanation using recognising patterns, predictions, generating content, or learning from examples. Do not demand jargon.'}
};
Object.assign(day1Questions.ai,{idea:'Teach the difference with a fresh analogy: an ordinary program follows a fixed recipe, while AI studies examples to find patterns and handle new situations. Do not repeat the phone, face-photo, writing-assistant, or alarm examples already shown on the page.'});
Object.assign(day1Questions.predict,{idea:'Use the selected agent’s title and exact question context. First let the learner predict a useful response from their chosen agent; do not reveal the sample. Do not call their agent a text assistant.'});
Object.assign(day1Questions.source,{idea:'Training builds patterns from examples. A model uses these patterns and the current request to generate a response.'});
Object.assign(day1Questions.evidence,{idea:'Fluent answers are not proof. Missing evidence or uncertain future events can limit an answer.'});
Object.assign(day1Questions.explain,{idea:'AI can recognise patterns, make predictions and generate useful content. Help the learner express this simply.'});
const day2Question={
 question:'Is every token a whole word? Explain your answer.',
 rubric:'No. Accept answers explaining that a token may be a whole word, part of a word, punctuation, a number, or another piece of text. A simple no with one valid example is correct.',
 idea:'A token is a piece of text used by a model. It can be a whole word, part of a word, punctuation, a number, or another text piece. Token boundaries depend on the model.'
};
function day1AnswerBox(key,label,context=''){
 const g=project().guidance,r=g.day1Answers?.[key],value=g.drafts?.lab1?.[`day1-answer-${key}`]??r?.answer??'';
 const reviewed=Boolean(r?.feedback&&r.assessment&&r.answer===value.trim()),passed=reviewed&&r.assessment==='correct';
 const canCheck=Boolean(value.trim())&&!reviewed;
 return `<form onsubmit="event.preventDefault();checkDay1Answer('${key}')"><div class="field"><label for="day1-answer-${key}">${esc(day1Questions[key].question)}</label>${context?`<blockquote>${esc(context)}</blockquote>`:''}<textarea id="day1-answer-${key}" placeholder="Type your answer here…" required maxlength="2000">${esc(value)}</textarea><small>To continue, answer correctly. Eve will explain mistakes so you can try again.</small></div><button id="day1-check" class="button secondary" type="submit" ${canCheck?'':'disabled'}>${reviewed?(passed?'Answer checked':'Edit your answer to try again'):'Check with Eve'}</button><p id="day1-feedback" role="status" aria-live="polite">${reviewed?`Eve: ${esc(r.feedback)}${passed?'':' Try again to unlock Next.'}`:''}</p></form><button id="day1-next" class="button" ${passed?'':'disabled'} aria-describedby="day1-next-rule" onclick="continueDay1('${key}')">${label}</button><p id="day1-next-rule" class="fineprint">${passed?'Correct answer received. You can continue.':'Next unlocks after Eve marks your answer correct.'}</p>`;
}
async function continueDay1(key){
 const input=document.getElementById(`day1-answer-${key}`);
 if(!input||input.readOnly)return;
 const p=project(),review=p.guidance.day1Answers?.[key];
 const passed=review?.assessment==='correct'&&review.answer===input.value.trim();
 if(!passed)return;
 const nextButton=document.getElementById('day1-next');
 nextButton.disabled=true;nextButton.setAttribute('aria-busy','true');nextButton.textContent='Opening…';
 input.readOnly=true;
 if(!input.isConnected||project().id!==p.id||store.page!=='lab1')return;
 const next={ai:startDay1Prediction,predict:()=>advanceDay1(2),source:()=>advanceDay1(3),evidence:()=>advanceDay1(4),explain:()=>finishLab('lab1','lab2')};
 next[key]?.();
}
async function checkDay1Answer(key,{speak=true}={}){
 const input=document.getElementById(`day1-answer-${key}`),answer=input?.value.trim();
 if(!answer){document.getElementById('day1-feedback').textContent='Type an answer before checking with Eve.';input?.focus();return;}
 const p=project(),panel=document.getElementById('day1-feedback'),button=input.form.querySelector('button');
 if(button.disabled)return;
 cancelVoice();const token=voiceSession.generation;
 voiceState('thinking');
 button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Checking…';input.readOnly=true;panel.textContent='Eve is checking your answer…';
 document.getElementById('day1-next').disabled=true;
 try{
  const payload=evePayload(1,answer,'answer');
  const reply=await window.BuildAICloud.teacherReply(payload);
  if(token!==voiceSession.generation||project().id!==p.id||!panel.isConnected)return;
  if(!reply.text?.trim()||!['correct','not_yet','unclear'].includes(reply.assessment))throw Error('No checked feedback was returned.');
  p.guidance.day1Answers??={};p.guidance.day1Answers[key]={answer,feedback:reply.text,assessment:reply.assessment};
  saveEveTurn(1,'learner',`${day1Questions[key].question}\n${answer}`);saveEveTurn(1,'eve',reply.text);save();
  const passed=reply.assessment==='correct';
  panel.textContent=`Eve: ${reply.text}`;
  const nextButton=document.getElementById('day1-next'),rule=document.getElementById('day1-next-rule');
  nextButton.disabled=!passed;
  rule.textContent=passed?'Correct answer received. You can continue.':'Next unlocks after Eve marks your answer correct.';
  if(speak&&voiceSession.enabled&&p.guidance.voiceReplies)void playLiveEve(reply.text,1);
  return passed;
 }catch(error){
  if(panel.isConnected&&token===voiceSession.generation)panel.textContent='Eve could not check your answer. Your writing is saved. Select Check with Eve to try again.';
 }finally{
  if(panel.isConnected){
   input.readOnly=false;button.removeAttribute('aria-busy');
   const current=project().guidance.day1Answers?.[key],reviewed=Boolean(current?.assessment&&current.answer===input.value.trim()),passed=reviewed&&current.assessment==='correct';
   button.disabled=reviewed||!input.value.trim();
   button.textContent=reviewed?(passed?'Answer checked':'Edit your answer to try again'):'Check with Eve';
   document.getElementById('day1-next').disabled=!passed;
   if(panel.textContent==='Eve is checking your answer…')panel.textContent='Check interrupted. Select Check with Eve to try again.';
  }
  if(token===voiceSession.generation&&voiceSession.phase==='thinking')voiceState('idle');
 }
}
function startDay1Prediction(){cancelVoice();project().guidance.day1Predict=true;save();render();eveTeachMoment(1,'The learner is now on the prediction step. Invite an answer to the one visible prediction prompt. Do not give the sample answer or ask another question.');}
function isDay1NextCommand(message){
 const words=String(message).toLowerCase().replace(/[^a-z\s]/g,'').trim().replace(/\s+/g,' ');
 return ['next','continue','continue please','go on','move on','next question','next step','proceed','ici'].includes(words);
}

function day2IllustratedTokens(text){return text.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)||[];}
function day2TokenMarkup(text){return day2IllustratedTokens(text).map(piece=>`<span class="token">${esc(piece)}</span>`).join('');}
function advanceDay2(step,instruction){
 const p=project();p.guidance.day2Step=step;save();render();eveTeachMoment(2,instruction);
}
function startDay2Split(){
 advanceDay2(2,'The learner revealed the illustrated pieces in their preset question. Explain that a model processes text as tokens and that real boundaries depend on the model. Invite them to inspect the three visible token types, without asking another question.');
}
function inspectDay2Token(kind){
 const p=project();p.guidance.day2Discoveries??=[];
 if(!p.guidance.day2Discoveries.includes(kind))p.guidance.day2Discoveries.push(kind);
 save();render();
 const messages={word:'The learner selected the whole-word token. Explain in one short sentence that a common word can sometimes be one token.',part:'The learner selected the word-part token. Explain in one short sentence why an unfamiliar or longer word may be split into smaller reusable pieces.',punctuation:'The learner selected punctuation. Explain in one short sentence that punctuation can affect meaning and may be its own token.'};
 eveTeachMoment(2,messages[kind]);
}
function updateDay2ExperimentButton(){
 const input=document.getElementById('token-text'),button=document.getElementById('day2-experiment-next');
 if(button&&input)button.disabled=input.value.trim()===input.dataset.start.trim()||!input.value.trim();
}
function completeDay2Experiment(){
 const input=document.getElementById('token-text');if(!input?.value.trim()||input.value.trim()===input.dataset.start.trim()){toast('Change the sentence first, then watch the pieces change.');return;}
 const p=project();p.samples[1]=input.value.trim();p.guidance.day2ExperimentDone=true;save();
 advanceDay2(4,'The learner changed the sentence and observed its illustrated pieces. Connect this to next-token prediction: a text model processes the pieces in order and predicts a likely next piece. Invite only the visible final question.');
}
function day2AnswerBox(){
 const g=project().guidance,r=g.day2Answer,value=g.drafts?.lab2?.['day2-answer']??r?.answer??'';
 const reviewed=Boolean(r?.feedback&&r.assessment&&r.answer===value.trim()),passed=reviewed&&r.assessment==='correct',canCheck=Boolean(value.trim())&&!reviewed;
 return `<form onsubmit="event.preventDefault();checkDay2Answer()"><div class="field"><label for="day2-answer">${esc(day2Question.question)}</label><textarea id="day2-answer" placeholder="Type your answer here…" required maxlength="1200">${esc(value)}</textarea><small>Use one example from the token detective. Eve will explain a mistake so you can try again.</small></div><button id="day2-check" class="button secondary" type="submit" ${canCheck?'':'disabled'}>${reviewed?(passed?'Answer checked':'Edit your answer to try again'):'Check with Eve'}</button><p id="day2-feedback" role="status" aria-live="polite">${reviewed?`Eve: ${esc(r.feedback)}${passed?'':' Try again to unlock Finish.'}`:''}</p></form><button id="day2-next" class="button" ${passed?'':'disabled'} aria-describedby="day2-next-rule" onclick="finishDay2()">Finish Mission 2</button><p id="day2-next-rule" class="fineprint">${passed?'Correct answer received. You can finish Mission 2.':'Finish unlocks after Eve marks your answer correct.'}</p>`;
}
async function checkDay2Answer({speak=true}={}){
 const input=document.getElementById('day2-answer'),answer=input?.value.trim();
 if(!answer){document.getElementById('day2-feedback').textContent='Type an answer before checking with Eve.';input?.focus();return;}
 const p=project(),panel=document.getElementById('day2-feedback'),button=document.getElementById('day2-check');if(button.disabled)return;
 cancelVoice();const token=voiceSession.generation;voiceState('thinking');button.disabled=true;button.textContent='Checking…';input.readOnly=true;panel.textContent='Eve is checking your answer…';document.getElementById('day2-next').disabled=true;
 try{
  const reply=await window.BuildAICloud.teacherReply(evePayload(2,answer,'answer'));
  if(token!==voiceSession.generation||project().id!==p.id||!panel.isConnected)return;
  if(!reply.text?.trim()||!['correct','not_yet','unclear'].includes(reply.assessment))throw Error('No checked feedback was returned.');
  p.guidance.day2Answer={answer,feedback:reply.text,assessment:reply.assessment};saveEveTurn(2,'learner',`${day2Question.question}\n${answer}`);saveEveTurn(2,'eve',reply.text);save();
  const passed=reply.assessment==='correct';panel.textContent=`Eve: ${reply.text}`;document.getElementById('day2-next').disabled=!passed;document.getElementById('day2-next-rule').textContent=passed?'Correct answer received. You can finish Mission 2.':'Finish unlocks after Eve marks your answer correct.';
  if(speak&&voiceSession.enabled&&p.guidance.voiceReplies)void playLiveEve(reply.text,2);return passed;
 }catch(error){if(panel.isConnected&&token===voiceSession.generation)panel.textContent='Eve could not check your answer. Your writing is saved. Select Check with Eve to try again.';}
 finally{
  if(panel.isConnected){input.readOnly=false;const current=project().guidance.day2Answer,reviewed=Boolean(current?.assessment&&current.answer===input.value.trim()),passed=reviewed&&current.assessment==='correct';button.disabled=reviewed||!input.value.trim();button.textContent=reviewed?(passed?'Answer checked':'Edit your answer to try again'):'Check with Eve';document.getElementById('day2-next').disabled=!passed;}
  if(token===voiceSession.generation&&voiceSession.phase==='thinking')voiceState('idle');
 }
}
function finishDay2(){
 const input=document.getElementById('day2-answer'),review=project().guidance.day2Answer;
 if(!input||review?.assessment!=='correct'||review.answer!==input.value.trim())return;
 const p=project(),x=presetPractice[p.preset]||presetPractice.tutor;p.samples=[p.samples[0]||x.question,p.samples[1]||x.question];complete('lab2');save();go('lab3');
}
function guidedDay2(){
 const p=project(),x=presetPractice[p.preset]||presetPractice.tutor,step=p.guidance.day2Step||1,question=p.samples[0]||x.question,discoveries=p.guidance.day2Discoveries||[];
 const content=[
  `<h2>From answers to text pieces</h2><p>Yesterday you learned that AI uses patterns and your request to create an answer. Before a text model can work with that request, it turns the writing into smaller pieces called <b>tokens</b>.</p><div class="token-mystery"><p class="fineprint">YOUR PRESET QUESTION</p><p class="big-sentence">${esc(question)}</p><p>Where might a computer split this writing? Make a prediction in your head, then reveal the pieces.</p></div><button class="button" onclick="startDay2Split()">Reveal the token pieces</button>`,
  `<h2>Token detective</h2><p>These coloured pieces illustrate how text can be divided. Real token boundaries vary between models.</p><div class="token-board">${day2TokenMarkup(question)}</div><p>Investigate all three clues:</p><div class="grid3"><button class="choice ${discoveries.includes('word')?'selected':''}" onclick="inspectDay2Token('word')"><strong>${discoveries.includes('word')?'✓':'○'} Whole word</strong><small><span class="token">plant</span> can be one token.</small></button><button class="choice ${discoveries.includes('part')?'selected':''}" onclick="inspectDay2Token('part')"><strong>${discoveries.includes('part')?'✓':'○'} Word part</strong><small><span class="token">photo</span><span class="token">synthesis</span> shows reusable parts.</small></button><button class="choice ${discoveries.includes('punctuation')?'selected':''}" onclick="inspectDay2Token('punctuation')"><strong>${discoveries.includes('punctuation')?'✓':'○'} Punctuation</strong><small><span class="token">?</span> can be its own token.</small></button></div><div class="token-clue">${discoveries.length?`You found ${discoveries.length} of 3 token types.${discoveries.length===3?' Tokens are text pieces, not simply words.':''}`:'Select a clue to investigate it.'}</div><button class="button" ${discoveries.length===3?'':'disabled'} onclick="advanceDay2(3,'The learner found all three token types: a whole word, a word part, and punctuation. Introduce the visible sentence experiment and ask them to change one thing, without predicting the result for them.')">Next: Try the token lab</button>`,
  `<h2>Make the pieces change</h2><p>A model processes tokens in order. Change the sentence by adding punctuation, a number, or a longer word, then watch the illustrated pieces change.</p><div class="field"><label for="token-text">Your sentence</label><textarea id="token-text" data-start="${esc(question)}" oninput="tokenize();updateDay2ExperimentButton()">${esc(p.guidance.drafts?.lab2?.['token-text']||question)}</textarea></div><div id="tokens" class="token-board"></div><p id="token-count" class="muted"></p><p class="fineprint">This classroom splitter is an illustration. A real model may divide the same writing differently.</p><button id="day2-experiment-next" class="button" disabled onclick="completeDay2Experiment()">I changed it — what happens next?</button>`,
  `<h2>Why the pieces matter</h2><p>A text model reads the tokens already present and predicts a likely token to come next. It repeats that step to build a response. That is how Mission 1’s request becomes an answer, one text piece at a time.</p><div class="token-board"><span class="token">Can</span><span class="token"> you</span><span class="token"> help</span><span class="token">?</span><span class="token token-next">→ next piece</span></div>${day2AnswerBox()}`
 ];
 return `${header('MISSION 2 · TOKENS','Become a token detective.','Reveal how text becomes pieces, experiment with those pieces, and connect them to how a model builds an answer.')}<div class="card"><p class="eyebrow">PART ${step} OF 4 · ${['CONNECT','INVESTIGATE','EXPERIMENT','CHECK'][step-1]}</p>${content[Math.min(3,step-1)]}</div>`;
}

function suggestedDay3Examples(){const p=project(),x=presetPractice[p.preset]||presetPractice.tutor;return [
 {input:x.question,output:x.answer,why:'This shows a relevant answer: respond to the actual question and give useful help.'},
 {input:x.hard,output:'I do not have enough information to know that. Please share the missing details or a reliable source.',why:'This shows an honest limit: ask for evidence instead of inventing a confident answer.'},
 {input:'Explain your main job in one sentence.',output:day1Preset(p).purpose,why:'This shows focus: keep the answer short and connected to the agent’s job.'}
 ];}
function guidedDay3(){const p=project(),items=suggestedDay3Examples(),step=Math.min(p.guidance.day3ExampleStep||0,2),x=items[step],seen=p.guidance.day3Explored||[],opened=seen.includes(step);return `${header('MISSION 3 · EXAMPLES','Discover how examples guide your agent.','Explore three ready-made examples for your chosen agent. You do not need to write or approve any examples.')}<div class="card"><div class="eyebrow">EXAMPLE ${step+1} OF 3 · ${['USEFUL HELP','HONEST LIMITS','STAYING FOCUSED'][step]}</div><h2>${esc(day1Preset(p).title)} in action</h2><p><b>Someone asks:</b></p><blockquote class="prediction-request">${esc(x.input)}</blockquote><p><b>Your agent’s suggested reply:</b></p><div class="answer">${esc(x.output)}</div><p class="fineprint">This is a prepared example, not a live agent reply.</p><button class="button secondary" onclick="exploreDay3Example(${step})">Why is this example useful?</button>${opened?`<div class="token-clue">${esc(x.why)} An example pairs a request with a useful response. It guides the agent; it does not teach it every fact or guarantee future answers.</div>`:''}<div class="actions"><button class="button secondary" ${step?'':'disabled'} onclick="moveDay3Example(-1)">Previous example</button><button class="button" ${opened?'':'disabled'} onclick="${step<2?'moveDay3Example(1)':"finishLab('lab3','lab4')"}">${step<2?'Next example →':'Continue to behaviour →'}</button></div></div>`;}
function exploreDay3Example(index){const p=project(),x=suggestedDay3Examples()[index];p.guidance.day3Explored??=[];if(!p.guidance.day3Explored.includes(index))p.guidance.day3Explored.push(index);const key=`${p.preset}-${index}`;if(!p.examples.some(e=>e.suggestedKey===key))p.examples.push({input:x.input,output:x.output,author:'Course suggested',suggestedKey:key});save();render();eveTeachMoment(3,`Explain this suggested example, not an approval task: ${x.why} The learner does not write examples. Invite the visible Next example or Continue button.`);}
function moveDay3Example(delta){const p=project(),i=p.guidance.day3ExampleStep||0;if(delta>0&&p.guidance.day3Checks?.[i]?.selected!==i)return;cancelVoice();p.guidance.day3ExampleStep=Math.max(0,Math.min(2,i+delta));save();render();eveTeachMoment(3,'Guide only the current example classification question. Invite choosing the strongest response pattern; give a targeted hint without revealing the answer before an attempt.');}
function guidedDay4(){const p=project(),x=presetPractice[p.preset]||presetPractice.tutor,seen=p.guidance.day4Compared||[],value=p.guidance.day4TemperatureChoice||'low';return `${header('MISSION 4 · TEMPERATURE AND INSTRUCTIONS','Same job. Different ways to answer.','Discover what temperature changes, and how instructions keep your agent on track.')}<div class="card"><h2>What is temperature in AI?</h2><p>Temperature is a setting that changes how much variety an AI allows when choosing its next text pieces. It is not heat.</p><p><b>Lower temperature:</b> Tends to favour more likely choices, so answers are usually more consistent.</p><p><b>Higher temperature:</b> Allows more variety, so wording and ideas can change more between answers. It does not make the AI smarter or more accurate.</p><p>Compare two prepared replies from your ${esc(day1Preset(p).title)}:</p><blockquote class="prediction-request">${esc(x.question)}</blockquote><div class="actions"><button class="button" onclick="compareDay4Temperature('low')">Lower temperature · 0.2</button><button class="button secondary" onclick="compareDay4Temperature('high')">Higher temperature · 0.8</button></div>${seen.length?`<p><b>${value==='low'?'Lower':'Higher'} temperature illustration</b></p><div class="answer">${esc(value==='low'?x.answer:'Let’s look at this another way: '+x.answer+' Think of this as one small step toward a clearer picture.')}</div><p class="fineprint">These are prepared illustrations, not live model outputs. Higher temperature does not always mean a longer or friendlier reply; real results vary by model and request.</p>`:''}<h3>Your agent’s instructions</h3><p>${esc(day1Preset(p).behavior)}</p><p>Instructions tell the agent how to help. Temperature changes the variety of its choices; it does not replace these rules.</p><p>We will use lower temperature as your agent’s starting setting.</p><button class="button" ${seen.includes('low')&&seen.includes('high')?'':'disabled'} onclick="saveGuidedDay4()">Check what you learned →</button></div>`;}
function compareDay4Temperature(value){if(!['low','high'].includes(value))return;const p=project();p.guidance.day4Compared??=[];if(!p.guidance.day4Compared.includes(value))p.guidance.day4Compared.push(value);p.guidance.day4TemperatureChoice=value;save();render();eveTeachMoment(4,`The learner selected ${value} temperature in a prepared illustration. Explain variety versus consistency, not accuracy, intelligence or answer length. No writing task. Invite the other comparison or understanding check.`);}
function saveGuidedDay4(){const p=project();if(!['low','high'].every(x=>p.guidance.day4Compared?.includes(x))){toast('Compare both temperature settings first.');return;}askTinyCheck('lab4',()=>{p.behavior=day1Preset(p).behavior;p.temperature=.2;p.evaluation=[(presetPractice[p.preset]||presetPractice.tutor).question,(presetPractice[p.preset]||presetPractice.tutor).hard];complete('lab4');save();go('lab5');});}
function day6ToolPlan(){const id=project().preset;if(id==='tutor')return {id:'knowledge',name:'Knowledge search',request:'Find the photosynthesis explanation in the course biology note.',why:'Your tutor needs a supplied source, rather than relying only on a likely answer.',action:'Search a saved biology note and return the matching information.'};if(id==='coach')return {id:'tasks',name:'Task list',request:'Add task: Spend ten minutes on my first small step today.',why:'Your coach should help turn advice into a next action you can keep.',action:'Save one task in this agent’s local task list.'};return {id:'calculator',name:'Calculator',request:'What is 100 - 80?',why:'Your business helper needs an exact calculation of selling price minus cost.',action:'Calculate the arithmetic and return the number.'};}
function runSuggestedTool(){const p=project(),t=day6ToolPlan();if(!p.tools[t.id])throw Error(`${t.name} is not enabled. Select Use this tool first.`);if(t.id==='knowledge'){const title='Course biology note: photosynthesis';if(!p.knowledge.some(s=>s.title===title))p.knowledge.push({title,content:'Plants use light to turn water and carbon dioxide into food through photosynthesis.',courseSuggested:true});const source=p.knowledge.find(s=>s.title===title);save();return {action:'Searched the supplied course biology note',result:source.content,reply:'The saved note explains that plants use light to make food through photosynthesis.'};}if(t.id==='tasks'){const text='Spend ten minutes on my first small step today.';if(!p.tasks.some(x=>x.text===text))p.tasks.push({text,done:false});save();return {action:'Saved a task in this agent’s browser task list',result:p.tasks.find(x=>x.text===text).text,reply:'Your small next step is saved. It is not a scheduled notification.'};}const value=100-80;return {action:'Calculated 100 − 80',result:String(value),reply:`The difference is ${value} before other business expenses.`};}
function guidedDay6(){const p=project(),t=day6ToolPlan(),r=p.guidance.day6Result;return `${header('MISSION 6 · TOOLS','Help your agent take action.','A tool is a small function an agent can use to do a specific job, such as calculate, look up a note or save a task.')}<div class="card"><h2>A useful tool for your ${esc(day1Preset(p).title)}</h2><p><b>The request:</b></p><blockquote class="prediction-request">${esc(t.request)}</blockquote><p>${esc(t.why)}</p><h3>Suggested tool: ${t.name}</h3><p>${esc(t.action)}</p><p>${t.id==='knowledge'?'We supply a short course note for this exercise. This searches saved information, not the internet.':t.id==='tasks'?'The task stays in this browser. It does not send reminders or messages.':'The calculator computes a number instead of guessing text.'}</p><div class="actions"><button class="button secondary" onclick="enableDay6Tool()">${p.tools[t.id]?'✓ Tool enabled':'Use this tool'}</button><button class="button" ${p.tools[t.id]?'':'disabled'} onclick="tryDay6Tool()">Run this task →</button></div>${r?`<div class="token-clue"><b>1. Tool action</b><p>${esc(r.action)}</p><b>2. Actual tool result</b><p>${esc(r.result)}</p><b>3. How the agent can use it</b><p>${esc(r.reply)}</p></div><p class="fineprint">The tool action is real and local. The final wording above is a prepared illustration, not a live AI reply.</p>`:''}<p id="day6-error" role="alert"></p><button class="button" ${r?'':'disabled'} onclick="finishLab('lab6','lab7')">I inspected the result · Continue →</button></div>`;}
function enableDay6Tool(){const p=project();p.tools[day6ToolPlan().id]=true;if(p.model?.configuration)p.model.configuration.tools={...p.tools};save();render();eveTeachMoment(6,'Explain why the selected recommended tool helps this agent’s displayed task. Invite Run this task.');}
function tryDay6Tool(){try{project().guidance.day6Result=runSuggestedTool();save();render();eveTeachMoment(6,'Explain the actual tool action and result on screen, then invite inspecting it before continuing. Do not claim the prepared final wording is a live AI response.');}catch(e){document.getElementById('day6-error').textContent=e.message;}}
function guidedDay1(){
 const p=project(),x=presetPractice[p.preset]||presetPractice.tutor,step=p.guidance.day1Step||1;
 const content=[
  p.guidance.day1Predict
   ? `<h2>Imagine your ${esc(day1Preset(p).title)} answering</h2><blockquote class="prediction-request">${esc(x.question)}</blockquote>${day1AnswerBox('predict','See a sample answer')}`
   : `<h2>You may already use AI</h2><p>A phone can recognise your spoken words, a photo app can find faces, and a writing assistant can suggest a reply. These are different AI tasks.</p><p><b>Artificial intelligence (AI)</b> is the broad name for computer systems that perform tasks such as recognising patterns, making predictions and generating content. Many modern AI systems learn from examples.</p>${day1AnswerBox('ai','Next: Make a prediction')}`,
  `<h2>From a question to an answer</h2><p><b>You ask:</b> ${esc(x.question)}</p><p><b>Prepared sample answer:</b> ${esc(x.answer)}</p><p>This is an illustration, not a live generated answer. In a text AI, training builds patterns from many examples. Your current question supplies context; the model uses those patterns to generate a response.</p>${day1AnswerBox('source','What should I check?')}`,
  `<h2>Useful does not mean all-knowing</h2><p>Imagine two replies to a request the assistant cannot answer reliably:</p><p><b>A:</b> “I know the exact answer. You can rely on me.”</p><p><b>B:</b> “I need more information to answer reliably. Let’s identify what is missing.”</p><p>Both sound fluent. Only one acknowledges the missing evidence. Fluency is a skill; it is not proof.</p>${day1AnswerBox('evidence','Try a small task',x.hard)}`,
  p.guidance.detailTask
   ? `<h2>Explain it in your own words</h2>${day1AnswerBox('explain','Check what I learned')}`
: `<h2>You decide how to use AI</h2><p>You want help with: ${esc(x.question)}</p><p>Which approach makes better use of what you learned?</p><button class="button secondary" onclick="day1ChooseDetail(false)">Use it because it matches the agent’s job and sounds clear</button> <button class="button secondary" onclick="day1ChooseDetail(true)">Check important claims against reliable evidence before using it</button> <button class="button secondary" onclick="day1ChooseDetail(false)">Lower the temperature, then assume repeated answers are correct</button><p id="detail-feedback" aria-live="polite"></p><button id="detail-next" class="button" hidden onclick="render()">Next: Explain AI</button>`
 ];
 return `${header('MISSION 1 · WHAT IS AI?','Meet AI: useful, capable, imperfect.','Discover what AI does, where a text answer comes from, and how to judge when it needs checking.')}<div class="card"><p class="eyebrow">PART ${step} OF 4${step===1?(p.guidance.day1Predict?' · MAKE A PREDICTION':' · CHECK ONE IDEA'):''}</p>${content[Math.min(3,step-1)]}</div>`;
}
function day1ChooseDetail(correct){
 project().guidance.detailTask=correct;save();
 document.getElementById('detail-feedback').textContent=correct?'Yes. AI can help you think and draft, while evidence helps you judge its answer.':'A fluent answer can still be wrong. Consider what evidence you would need, then try again.';
 document.getElementById('detail-next').hidden=!correct;
 eveTeachMoment(1,correct?'The learner chose to check important claims. Confirm briefly without asking another question.':'The learner treated fluency as evidence of accuracy. Explain briefly and invite another attempt at the same question.');
}
function guidedLaunch(){
 const p=project();if(!p.model)return `${header('MISSION 7 · TEST','Assemble your agent first.','Mission 5 brings the parts together. Mission 6 adds tools. Then return here to test the whole agent.')}<div class="card"><button class="button" onclick="go('lab5')">Open Mission 5</button></div>`;
 const tests=p.guidance.launchTests||{},kind=['normal','difficult','tool'].find(k=>!tests[k])||'done';
 const x=presetPractice[p.preset]||presetPractice.tutor;
 const q={normal:x.question,difficult:x.hard,tool:day6ToolPlan().request}[kind];
 return `${header('MISSION 7 · TEST YOUR AGENT','Try it before relying on it.',p.model.adapterKey?'This agent is connected to a model service.':'Practice mode: these results demonstrate saved examples and local tools. They are not live model answers.')}<div class="card">${kind==='done'?'<h2>You reviewed all three tests.</h2><p>You tried a normal request, an unknown answer and a tool. Keep checking important answers.</p><button class="button" onclick="launch()">Finish and save my agent</button>':`<h2>${{normal:'1. A normal question',difficult:'2. A question it may not know',tool:'3. A tool task'}[kind]}</h2><p>${esc(q)}</p><button class="button" id="run-trial" onclick="runLaunchTrial('${kind}')">Try this question</button><div id="trial-answer" aria-live="polite"></div>`}</div>`;
}
async function runLaunchTrial(kind){
 const p=project(),x=presetPractice[p.preset]||presetPractice.tutor,q={normal:x.question,difficult:x.hard,tool:day6ToolPlan().request}[kind];
 const button=document.getElementById('run-trial');button.disabled=true;const id=p.id;
 try{
  let text;
  if(kind!=='tool'&&p.model.adapterKey&&window.BuildAICloud.enabled())text=(await window.BuildAICloud.chat(p,q)).text;
  else if(kind==='normal')text=x.answer;
  else if(kind==='difficult')text='I do not have enough information to know that. Please check a reliable source or provide the missing details.';
  else if(p.tools[day6ToolPlan().id]){const result=runSuggestedTool();text=`${result.action}: ${result.result}. ${result.reply}`;}
  else text='The suggested tool is off. Return to Mission 6 to enable it.';
  if(store.page!=='lab7'||project().id!==id)return;
  launchTrial={kind,text};
  document.getElementById('trial-answer').innerHTML=`<p>${esc(text)}</p><p>${kind==='tool'?'Check the tool action and its actual result.':kind==='difficult'?'Does this admit the information it does not have?':'Does this actually answer the question? Check a fact in it.'}</p><button class="button secondary" onclick="reviewLaunchTrial()">I checked this answer</button>`;
  eveTeachMoment(7,`The learner ran the ${kind} test. Actual displayed answer: ${text}. Ask them to review it against the visible check, without automatically praising accuracy.`);
 }catch(e){document.getElementById('trial-answer').textContent=e.message;}finally{button.disabled=false;}
}
function reviewLaunchTrial(){if(!launchTrial)return;const p=project();if(launchTrial.kind==='tool'&&!p.tools[day6ToolPlan().id]){go('lab6');return;}p.guidance.launchTests??={};p.guidance.launchTests[launchTrial.kind]=true;launchTrial=null;save();render();}

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
 source.start();project().guidance.eveGreeted=true;save();
}
async function runVoice(day,message,learner=false,transition=null){
 if(!voiceSession.enabled||voiceSession.phase==='recording'||store.page!==(day===0?'intro':`lab${day}`))return;
 claimEveTeachingEvent(day);
 const answerInput=learner?(day===1?document.querySelector('textarea[id^="day1-answer-"]'):day===2?document.getElementById('day2-answer'):null):null;
 if(answerInput){
  const key=day===1?answerInput.id.replace('day1-answer-',''):'tokens',review=day===1?project().guidance.day1Answers?.[key]:project().guidance.day2Answer;
  if(isDay1NextCommand(message)){
   if(review?.assessment==='correct'&&review.answer===answerInput.value.trim()){if(day===1)await continueDay1(key);else finishDay2();}
   else{
    const panel=document.getElementById('day1-feedback');
    const guidance='To continue, answer this question correctly. Eve will explain mistakes, then you can try again.';
    if(panel)panel.textContent=guidance;
    if(voiceSession.enabled&&project().guidance.voiceReplies)void playLiveEve(guidance,day);
   }
   return;
  }
  answerInput.value=message;answerInput.dispatchEvent(new Event('input',{bubbles:true}));
  if(day===1)await checkDay1Answer(key);else await checkDay2Answer();return;
 }
 cancelVoice();const token=voiceSession.generation;
 voiceSession.retry=()=>runVoice(day,message,learner,transition);
 if(learner)saveEveTurn(day,'learner',message);
 voiceState('thinking');
 try{
  const reply=await window.BuildAICloud.teacherReply(evePayload(day,message,learner?'conversation':'guidance',transition));
  if(token!==voiceSession.generation)return;
  if(!reply.text?.trim())throw Error('No teaching answer was returned.');
  saveEveTurn(day,'eve',reply.text);updateEveDebug('Eve received her answer.',{reply:reply.text,error:''});
  voiceSession.retry=()=>playLiveEve(reply.text,day);
  await speakTurn(reply.text,token);
 }catch(error){if(token===voiceSession.generation)voiceState('error',error.message);}
}
function retryEve(){voiceSession.enabled=true;unlockEveAudio();const retry=voiceSession.retry;if(retry)retry();else useEve(store.page==='intro'?0:labDay(store.page));}

async function recordTurn(day){
 if(!project().guidance.learnerName){document.getElementById('learner-name')?.focus();return;}
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
     const heard=await window.BuildAICloud.teacherTranscribe(blob,'en');
     if(token!==voiceSession.generation)return;
     if(!heard.text?.trim())throw Error('No words were recognised.');
     updateEveDebug('Eve heard you.',{heard:heard.text,error:''});
     voiceState('idle');
     await runVoice(day,heard.text,true);
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

function submitLearnerName(){
 const input=document.getElementById('learner-name');if(!input)return;
 const name=input.value.trim().replace(/\s+/g,' ').slice(0,80);
 if(!name){document.getElementById('learner-name-error').textContent='Please type the name you would like Eve to use.';input.focus();return;}
 cancelVoice();const p=project();p.guidance.learnerName=name;p.guidance.awaitingName=false;
 if(p.guidance.drafts?.intro)delete p.guidance.drafts.intro['learner-name'];
 courseResuming=false;voiceSession.enabled=true;unlockEveAudio();store.page='intro';evePageVisit='';evePreviousPage='';save();render();
}

function restartLearner(){
 if(!confirm('Restart this learner? This removes this learner’s name, conversations and AI project from this browser. Other projects stay saved.'))return;
 cancelVoice();const id=store.active;store.projects=store.projects.filter(p=>p.id!==id);
 const fresh=defaultProject();store.projects.push(fresh);store.active=fresh.id;store.page='intro';
 voiceSession.enabled=false;courseResuming=false;pendingCheck=null;evePageVisit='';evePreviousPage='';save();render();
}
function resumeLearner(){courseResuming=false;voiceSession.enabled=true;unlockEveAudio();evePageVisit='';evePreviousPage='';render();}

function decorateActivities(){
 const p=project(),main=document.querySelector('main');if(!main)return;
 if(courseResuming){main.innerHTML=`<header class="classroom-hero"><div><div class="eyebrow">YOUR AI JOURNEY</div><h1 class="title">Welcome back, ${esc(p.guidance.learnerName)}.</h1><p>Your work is saved. Continue where you left off.</p><div class="actions"><button class="button" onclick="resumeLearner()">Resume with Eve</button><button class="button secondary" onclick="restartLearner()">Restart this learner</button></div></div><div class="teacher-illustration">${evePortrait()}</div></header>`;return;}
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
  if(field.id.startsWith('day1-answer-')){
   document.getElementById('day1-feedback').textContent='';
   document.getElementById('day1-next').disabled=true;
   const check=document.getElementById('day1-check');if(check){check.disabled=!field.value.trim();check.textContent='Check with Eve';}
   const rule=document.getElementById('day1-next-rule');if(rule)rule.textContent='Next unlocks after Eve marks your answer correct.';
  }
  if(field.id==='day2-answer'){
   document.getElementById('day2-feedback').textContent='';document.getElementById('day2-next').disabled=true;
   const check=document.getElementById('day2-check');if(check){check.disabled=!field.value.trim();check.textContent='Check with Eve';}
   document.getElementById('day2-next-rule').textContent='Finish unlocks after Eve marks your answer correct.';
  }
  const p=project();p.guidance.drafts??={};p.guidance.drafts[store.page]??={};p.guidance.drafts[store.page][field.id]=field.value;save();
 });
 lab1=guidedDay1;
 lab2=guidedDay2;
 lab3=guidedDay3;
 lab4=guidedDay4;
 lab6=guidedDay6;
 lab7=guidedLaunch;
 temperaturePreview=function(){const el=document.getElementById('temp');if(!el)return;const x=presetPractice[project().preset]||presetPractice.tutor;document.getElementById('temp-value').textContent=Number(el.value).toFixed(1);document.getElementById('temp-answer').textContent=(Number(el.value)<.5?'Focused example: ':'More conversational example: ')+x.answer+(Number(el.value)<.5?'':' Let’s work through one small part together.');};
 lessonNotes[1].simple='AI systems perform tasks such as recognising speech, making predictions and generating text. Modern models learn patterns from training examples. A text model uses these patterns and the current question to generate a response; it can be wrong.';
 lessonNotes[1].try=courseGuide.lab1.steps[0];
 advanceDay1=step=>{project().guidance.day1Step=step;save();render();eveTeachMoment(1,'The learner moved to the next part of the introduction. Teach the visible idea. Ask only the one question already shown on the page, wait for the typed answer, and do not reveal its answer first.');};
 const baseRender=render;
 render=function(){baseRender();decorateActivities();};
 const baseGo=go;
 go=function(page){evePreviousPage=voiceSession.enabled?store.page:'';return baseGo(page);};
 const baseContext=teacherPageContext;
 teacherPageContext=function(day){
  const location=(day===0?'CURRENT PAGE: Mission Briefing (before Mission 1).':`CURRENT PAGE: Mission ${day} — ${lessonNotes[day].name}. This is a lesson, not the Mission Briefing setup page. Do not describe it as before Mission 1 or ask the learner to choose a preset again.`)+`\nCourse goal (private context, not a script): ${courseMission} Teach only the current step toward this goal.`;
  if(pendingCheck){const c=tinyChecks[pendingCheck.page];return `${location}\nCurrent screen: understanding check. ${c[0]} Choices: ${c[1].join(' / ')}. Explain errors simply and invite a click. Do not claim a spoken answer has submitted the check.`;}
  const visible=Array.from(document.querySelectorAll('main > .card, main > .grid, main > .grid3')).filter(el=>!el.hidden&&!el.matches('#eve-debug,[aria-label]')).map(el=>el.innerText.slice(0,700)).join(' ');
  const page=day===0?'intro':`lab${day}`;
  const writtenAnswer=day===1?document.querySelector('textarea[id^="day1-answer-"]'):null;
  const day2Answer=day===2?document.getElementById('day2-answer'):null;
  if(day2Answer){
   const review=project().guidance.day2Answer;
   return `${location}\nPrivate teaching context; never read this aloud. ${day2Question.idea}\nTeach only this question: ${day2Question.question}\n${review?.assessment==='correct'&&review.answer===day2Answer.value.trim()?'This answer has been checked and is correct. Briefly acknowledge it and invite the Finish Mission 2 button.':'Wait for an answer. If the learner struggles, give one small hint using the visible token examples. Do not reveal a complete answer before an attempt.'}`;
  }
  if(writtenAnswer){
   const key=writtenAnswer.id.replace('day1-answer-',''),q=day1Questions[key],review=project().guidance.day1Answers?.[key];
   return `${location}\nPrivate teaching context; never read this aloud. ${q.idea}\nTeach only this question: ${q.question}\n${review?.assessment==='correct'&&review.answer===writtenAnswer.value.trim()?'This answer has been checked and is correct. Briefly acknowledge it and invite the next button, without introducing the next question.':'Wait for an answer. If the learner struggles, give one small hint for this same question. Do not reveal the answer in the introduction.'}`;
  }
  const writtenContext=writtenAnswer?`Current question: ${day1Questions[writtenAnswer.id.replace('day1-answer-','')].question}. Current written answer (learner data): ${JSON.stringify(writtenAnswer.value.slice(0,2000))}. Ask only this one question. Do not give its answer before an attempt. The learner can submit it with Check with Eve. Do not add a second question.`:'';
  return `${location}\n${writtenContext}\nUse this current screen over any earlier conversation. Invite spoken answers; only ask the learner to type if a relevant input is visible.\nCourse connection: ${lessonJourney[page]?.[0]||''}. Treat the learner as a capable adult who is new to AI. Introduce technical words only with an explanation. Ask for predictions, comparisons or reasons instead of repetitive praise. Increase depth if their answer shows understanding; simplify only the confusing part.\nVisible activity: ${visible}\n${baseContext(day)}`;
 };
 stopEve=cancelVoice;
 useEve=async function(day){voiceSession.enabled=true;unlockEveAudio();if(voiceSession.phase==='speaking'){cancelVoice();return;}if(voiceSession.phase==='error'){retryEve();return;}await recordTurn(day);};
 toggleEveRecording=recordTurn;
 playLiveEve=async function(text,day){cancelVoice();const token=voiceSession.generation;voiceSession.retry=()=>playLiveEve(text,day);updateEveDebug('Eve is preparing speech.',{reply:text,error:''});try{await speakTurn(text,token);}catch(e){if(token===voiceSession.generation)voiceState('error',e.message);}};
 sendLiveEve=(day,message)=>runVoice(day,message,true);
 eveTeachMoment=(day,message,transition=null)=>runVoice(day,message,false,transition);
 const welcome=maybeWelcomeEve;
 maybeWelcomeEve=()=>{if(!courseResuming&&voiceSession.enabled&&!pendingCheck)return welcome();};
 const originalFinish=finishLab;
 finishLab=(page,next)=>{
  if(page==='lab1'&&!project().guidance.detailTask){toast('Try the practice task first.');return;}
  if(page==='lab3'&&(project().guidance.day3Explored||[]).length<3){toast('Explore the three suggested examples first.');return;}
  askTinyCheck(page,()=>originalFinish(page,next));
 };
 for(const [page,name] of [['lab4','saveLab4']]){
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
 choosePreset=async id=>{const p=project();if(p.guidance.drafts)delete p.guidance.drafts.intro;p.guidance.activityIndex??={};p.guidance.activityIndex.intro=0;await originalPreset(id);};
 courseResuming=Boolean(project().guidance.learnerName);
}
