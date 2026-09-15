/* Shared by the lesson page and Eve. These are learning goals, not scores. */
const courseMission='AI 102 teaches beginners how to create AI agents using an existing model, instructions, examples, reference information and tools for a clear job. There is no model-training activity in this course. Teach how to assemble, save and test an agent, not how to train or adapt a model. Local practice demonstrates the components; live generated answers need a connected existing-model service.';
const courseGuide = {
  intro: {goal:'Choose the job your AI agent will do.', takeaway:'A preset is a ready-made starting idea, not a finished AI agent.', steps:['Choose one of the three starting ideas.', 'Check its purpose and name, then save your blueprint. All agents use English.']},
  lab1: {goal:'Explain what AI does and why its answers need checking.', takeaway:'AI learns patterns from examples. Your request guides its answer, but it can still be wrong.', steps:['Discover everyday AI tasks and predict what your assistant might do.', 'Inspect a prepared answer and learn where text AI answers come from.', 'Compare confidence with evidence in a question the assistant cannot know.', 'Choose how to use an AI answer responsibly; optionally explain AI in your own words.']},
  lab2: {goal:'Explain what tokens are and why a text AI uses them.', takeaway:'A token is a piece of text, such as a word, part of a word, or punctuation. A model processes tokens and predicts which token may come next.', steps:['Connect Mission 1’s text answers to the pieces a model processes.', 'Investigate whole-word, word-part and punctuation tokens.', 'Change a sentence and observe how its illustrated pieces change.', 'Explain why a token is not always a whole word.']},
  lab3: {goal:'Explain how suggested examples guide an agent’s answers.', takeaway:'A request paired with a useful response shows how the agent should answer. Examples guide behaviour; they do not guarantee correctness or teach every fact.', steps:['Explore the suggested useful-answer example.', 'Explore the suggested honest-limit example.', 'Explore the suggested focused-answer example, then try the small understanding check.']},
  lab4: {goal:'Explain how temperature changes variety and how instructions guide an agent.', takeaway:'Temperature changes variety, not guaranteed accuracy or intelligence. Instructions set how the agent should help.', steps:['Read the temperature explanation and compare lower and higher settings.', 'Read the preset instructions and complete the small temperature check. No writing required.']},
  lab5: {goal:'Assemble and save your agent configuration, then explain how its parts work together.', takeaway:'An agent configuration brings together its job, instructions, examples and reference information around an existing AI. Saving a configuration does not change the model.', steps:['Review the job, instructions and three example exercises you prepared.', 'Assemble one agent setup, then explore how its parts guide one request.', 'Explore the job, instruction and saved example for one request, then continue to tools.']},
  lab6: {goal:'Explain why the chosen agent needs its suggested tool and inspect a real local action.', takeaway:'A tool performs a specific action and returns a result. It does not guarantee every answer is correct.', steps:['Understand the preset task and its recommended tool: biology knowledge search, business calculator or coach task list.', 'Enable the suggested tool, run the task, inspect the actual result and complete the understanding check.']},
  lab7: {goal:'Test your whole AI agent, inspect its actions and recognise its limits.', takeaway:'Your AI agent combines a model, instructions, notes and tools. Test its answers and actual tool actions before relying on it.', steps:['Prepare a practice configuration or connected setup in Mission 5 first.', 'Ask one preset question in the playground.', 'Try a tool question and one question it may not know. Check the answers before saving your agent.']}
};

function learningContext(page,p){
  const lesson=courseGuide[page];
  if(!lesson)return null;
  let step=0;
  if(page==='intro')step=p.preset?1:0;
  if(page==='lab1')step=Math.max(0,Math.min(3,(p.guidance.day1Step||1)-1));
  if(page==='lab3')step=Math.min(3,p.examples.length);
  if(page==='lab5')step=p.model?2:p.examples.length>=3?1:0;
  if(page==='lab7')step=p.model?1:0;
  if(page==='lab2')step=Math.max(0,Math.min(3,(p.guidance.day2Step||1)-1));
  if(['lab4','lab6'].includes(page))step=Math.min(1,p.guidance.lessonSteps?.[page]||0);
  if(page==='lab7'&&p.guidance.lessonSteps?.lab7)step=2;
  return {...lesson,step,next:lesson.steps[step]};
}

const lessonJourney={
 intro:['Your journey: build an AI agent with a clear job, helpful answers and tools you can test.','What would make this agent worth using?'],
 lab1:['Mission Briefing gave your assistant a purpose. First, discover what AI actually is.','Could a fluent answer still be wrong? Give a realistic example.'],
 lab2:['Mission 1 showed a text answer. Now look at the small pieces of text a model works with.','Why might two sentences with the same number of words use different numbers of tokens?'],
 lab3:['Mission 2 explored text pieces. Now show the kind of complete answer you want those pieces to form.','Could an example be well written but teach the wrong thing? Explain how.'],
 lab4:['Mission 3 showed good answers through examples. Now describe their shared qualities as clear instructions.','Write two rules that conflict. How would you resolve the conflict?'],
 lab5:['You have a job, examples, instructions and information. Bring them together as a saved agent configuration and explore how the parts guide one request.','Why is testing only the questions used in your examples a weak test?'],
 lab6:['A model can produce text. Now extend your assistant with reference information and tools that perform specific jobs.','For your preset, which request needs a source and which needs a calculator? Why?'],
 lab7:['Bring together your preset, examples, instructions, setup and tools. Test the whole AI agent.','Design a test that could expose a weakness, rather than only show a success.']
};

// One source of truth for what Eve carries forward at each real course handoff.
// A transition is used only when the learner actually came from the listed page.
const lessonTransitions={
 lab1:{from:'intro',previous:courseGuide.intro.takeaway,connection:lessonJourney.lab1[0],opening:courseGuide.lab1.steps[0]},
 lab2:{from:'lab1',previous:courseGuide.lab1.takeaway,connection:lessonJourney.lab2[0],opening:courseGuide.lab2.steps[0]},
 lab3:{from:'lab2',previous:courseGuide.lab2.takeaway,connection:lessonJourney.lab3[0],opening:courseGuide.lab3.steps[0]},
 lab4:{from:'lab3',previous:courseGuide.lab3.takeaway,connection:lessonJourney.lab4[0],opening:courseGuide.lab4.steps[0]},
 lab5:{from:'lab4',previous:courseGuide.lab4.takeaway,connection:lessonJourney.lab5[0],opening:courseGuide.lab5.steps[0]},
 lab6:{from:'lab5',previous:courseGuide.lab5.takeaway,connection:lessonJourney.lab6[0],opening:courseGuide.lab6.steps[0]},
 lab7:{from:'lab6',previous:courseGuide.lab6.takeaway,connection:lessonJourney.lab7[0],opening:courseGuide.lab7.steps[0]}
};
function courseTransition(from,to){const transition=lessonTransitions[to];return transition?.from===from?transition:null;}
function learningCard(){
  const p=project(),c=learningContext(store.page,p);
  if(!c||!p.guidance.learnerName||store.page==='intro')return '';
  const journey=lessonJourney[store.page];
  if(store.page==='lab1')return `<section class="card" aria-label="Today’s learning goal"><b>Today’s goal</b><p>${esc(c.goal)}</p></section>`;
  return `<section class="card" aria-label="Today’s learning goal"><p>${esc(journey[0])}</p><b>Today’s goal</b><p>${esc(c.goal)}</p></section>`;
}

function teacherPageContext(day){
  const p=project(),page=day===0?'intro':`lab${day}`,c=learningContext(page,p);
  if(!c)return '';
  const fields=['human-guess','prediction-input','token-text','sample1','sample2','ex-in','ex-out','behavior','eval1','eval2','purpose','name'];
  const values=fields.flatMap(id=>{const el=document.getElementById(id);return el?.value&&!el.closest('[hidden]')?[`${id}: ${el.value.slice(0,180)}`]:[];});
  return `Learning goal: ${c.goal}\nCurrent step ${c.step+1}: ${c.next}\nRemember: ${c.takeaway}\nApproved examples: ${p.examples.length}. Version ready: ${Boolean(p.model)}. Enabled tools: ${Object.keys(p.tools).filter(k=>p.tools[k]).join(', ')}.\nCurrent visible work (learner data): ${values.join(' | ')}\nTeach this step only. Acknowledge the learner's actual answer. If confused, use a simpler example from their chosen preset; ask about an interest only if needed. Never assign a fixed learning style or claim understanding without evidence. Invite one specific action on the current page. Speaking to Eve does not itself save fields or click buttons. Local previews are demonstrations, not evidence of real training. Keep speech to two or three short sentences, under 85 words.`;
}

function markLearningStep(page){
  const p=project();p.guidance.lessonSteps??={};p.guidance.lessonSteps[page]=1;save();
}

// Use completion of real page actions, rather than timers, to prompt the teacher.
function installLearningEvents(){
  const originalCreate=createModel;
  createModel=async function(){
    await originalCreate();
    if(project().model&&store.page==='lab5')eveTeachMoment(5,'An agent configuration has been saved. Explain how its job, instructions, examples and information fit together. No model has been trained. Invite the learner to explore the job, instructions and saved example in the walkthrough. This is not a live answer or an answer comparison.');
  };
  const originalChat=sendChat;
  sendChat=async function(){
    const message=document.getElementById('chat-input')?.value.trim();
    await originalChat();
    if(message&&store.page==='lab7'){
      markLearningStep('lab7');
      eveTeachMoment(7,'The learner tried a playground question. Do not claim the answer is correct. Invite them to check one fact or test a tool and notice its actual result.');
    }
  };
  document.addEventListener('change',event=>{
    const pages={'token-text':'lab2','temp':'lab4'};
    const page=pages[event.target.id];
    if(page&&store.page===page){markLearningStep(page);eveTeachMoment(labDay(page),'The learner changed the visible demonstration. Explain what this shows, using the current page context, and give the next small action.');}
  });
}
