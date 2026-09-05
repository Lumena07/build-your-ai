/* Shared by the lesson page and Eve. These are learning goals, not scores. */
const courseGuide = {
  intro: {goal:'Choose who your AI will help.', takeaway:'A preset is a ready-made starting idea, not a finished AI.', steps:['Choose one of the six starting ideas.', 'Check its purpose, name and language, then save your blueprint.']},
  lab1: {goal:'Explain what AI does and why its answers need checking.', takeaway:'AI learns patterns from examples. Your request guides its answer, but it can still be wrong.', steps:['Read your preset question and suggest a helpful opening.', 'Look at the job you have given your AI.', 'Notice how its instructions guide an answer.', 'Add one useful detail to the question, then answer the tiny practice question.']},
  lab2: {goal:'Recognise that AI handles text in small pieces called tokens.', takeaway:'A token can be a word, part of a word, or punctuation. It is not always a whole word.', steps:['Look at the coloured pieces in your preset question.', 'Keep or edit two questions people might ask your AI, then save them.']},
  lab3: {goal:'Show what a useful answer looks like.', takeaway:'An example pairs a question with a good answer. Notes are information to look up, not the same as training examples.', steps:['Write one question and an answer that actually helps, then approve it.', 'Add a second useful question and answer.', 'Add a third useful question and answer.', 'Review your three examples. Optionally add trusted notes, then continue.']},
  lab4: {goal:'Choose clear rules for how your AI answers.', takeaway:'Instructions guide an answer. A more creative answer is not necessarily more correct.', steps:['Try the focused-or-creative demonstration.', 'Write one clear behaviour rule and two separate test questions, then save.']},
  lab5: {goal:'Understand a model version and compare answers fairly.', takeaway:'A model is the learned pattern system. This local practice version does not train a new neural network.', steps:['Prepare three approved examples in Day 3.', 'Create a practice version, or start training if your GPU service is connected.', 'Compare both answers to the same question. Decide which helps and why.']},
  lab6: {goal:'Understand how a tool lets an AI carry out a specific job.', takeaway:'A calculator computes an answer; a language model alone predicts text. Check what tool was actually used.', steps:['Choose a tool your AI needs. Start with Calculator.', 'Read the calculator example, then save your tools.']},
  lab7: {goal:'Test your assistant and recognise its limits.', takeaway:'Your assistant combines a model, instructions, notes and tools. Test it before relying on it.', steps:['Create a version in Day 5 first.', 'Ask one preset question in the playground.', 'Try a tool question and one question it may not know. Check the answers before launching.']}
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
  if(['lab2','lab4','lab6'].includes(page))step=Math.min(1,p.guidance.lessonSteps?.[page]||0);
  if(page==='lab7'&&p.guidance.lessonSteps?.lab7)step=2;
  return {...lesson,step,next:lesson.steps[step]};
}

const lessonJourney={
 intro:['Your journey: turn one starting idea into an assistant you can explain and test.','What would make this assistant worth using?'],
 lab1:['Start here gave your assistant a purpose. First, discover what AI actually is.','Could a fluent answer still be wrong? Give a realistic example.'],
 lab2:['Day 1 showed a text answer. Now look at the small pieces of text a model works with.','Why might two sentences with the same number of words use different numbers of tokens?'],
 lab3:['Day 2 explored text pieces. Now show the kind of complete answer you want those pieces to form.','Could an example be well written but teach the wrong thing? Explain how.'],
 lab4:['Day 3 showed good answers through examples. Now describe their shared qualities as clear instructions.','Write two rules that conflict. How would you resolve the conflict?'],
 lab5:['You have examples and instructions. Now distinguish guiding an existing model from adapting it, and compare a version fairly.','Why is testing only the questions used in your examples a weak test?'],
 lab6:['A model can produce text. Now extend your assistant with reference information and tools that perform specific jobs.','For your preset, which request needs a source and which needs a calculator? Why?'],
 lab7:['Bring together your preset, examples, instructions, version and tools. Test the whole assistant.','Design a test that could expose a weakness, rather than only show a success.']
};
function learningCard(){
  const p=project(),c=learningContext(store.page,p);
  if(!c||!p.guidance.learnerName)return '';
  const journey=lessonJourney[store.page];
  return `<section class="card" aria-label="Today’s learning goal"><p>${esc(journey[0])}</p><b>Today’s goal</b><p>${esc(c.goal)}</p><details><summary>Go deeper with Eve</summary><p>${esc(journey[1])}</p><button class="button secondary" onclick="challengeWithEve()">Explore this challenge</button></details></section>`;
}
function challengeWithEve(){const page=store.page;eveTeachMoment(labDay(page)||0,`The learner requested a harder challenge: ${lessonJourney[page][1]}. Ask for their reasoning using the selected preset. Wait for their attempt before giving an answer. Keep the explanation short but intellectually meaningful.`);}

function teacherPageContext(day){
  const p=project(),page=day===0?'intro':`lab${day}`,c=learningContext(page,p);
  if(!c)return '';
  const fields=['human-guess','prediction-input','token-text','sample1','sample2','ex-in','ex-out','behavior','eval1','eval2','purpose','name'];
  const values=fields.flatMap(id=>{const el=document.getElementById(id);return el?.value?[`${id}: ${el.value.slice(0,180)}`]:[];});
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
    if(project().model&&store.page==='lab5')eveTeachMoment(5,'A version has been created. Explain the current practice or connected mode truthfully. Invite the learner to compare the two answers and give one reason for a preference.');
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
