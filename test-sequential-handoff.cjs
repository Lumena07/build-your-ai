const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8000/index.html');
 const mock=()=>page.evaluate(()=>{cancelVoice();voiceSession.enabled=false;speakTurn=async()=>{};BuildAICloud.teacherReply=async()=>({text:'A targeted hint.',assessment:'correct'});courseResuming=false;});
 await mock();
 for(const preset of ['tutor','business','coach']){
  await page.evaluate(preset=>{const p=defaultProject();p.preset=preset;p.guidance.learnerName='Emma';p.completed=['lab1'];store.projects.push(p);store.active=p.id;store.page='lab1';save();render();},preset);
  // Even direct/stale callbacks cannot skip the worked example or finish a lesson.
  await page.evaluate(()=>{setChapterPhase('practice');continueChapter();});assert.equal(await page.evaluate(()=>chapterPhase()),'learn');
  await page.getByRole('button',{name:await page.evaluate(()=>lessonStageTitles.lab1[1]),exact:true}).click();
  await page.evaluate(()=>setChapterPhase('practice'));assert.equal(await page.evaluate(()=>chapterPhase()),'see');
  assert.ok(await page.getByRole('button',{name:'Try it yourself →'}).isDisabled());
  await page.getByRole('button',{name:'Show what happens',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:/Review|Return to the lesson/}).count(),0);
  await page.getByRole('button',{name:'Try it yourself →'}).click();
  assert.equal(await page.getByRole('button',{name:/Review/}).count(),0);
  assert.match(await page.locator('.chapter-choices h3').innerText(),/Does every computer program use AI/);
  assert.ok((await page.locator('.chapter-choices .choice').allTextContents()).every(x=>/^(Yes|No)\./.test(x)));
  await page.locator('.chapter-choices .choice').nth(0).click();assert.ok(await page.locator('#day1-next').isDisabled());
  await page.evaluate(()=>{setChapterPhase('recap');continueChapter();});assert.equal(await page.evaluate(()=>chapterPhase()),'practice');
  await page.locator('.chapter-choices .choice').nth(1).click();assert.ok(await page.locator('#day1-next').isEnabled());
  // Persist an unfinished attempt with an old course-completion flag.
  await page.reload();await page.getByRole('button',{name:'Resume with Eve'}).click();await mock();
  assert.equal(await page.evaluate(()=>chapterPhase()),'practice');assert.ok(await page.locator('#day1-next').isEnabled());
  assert.equal(await page.getByRole('heading',{name:'Mission 1 complete',exact:true}).count(),0);
  await page.evaluate(()=>go('lab2'));assert.equal(await page.evaluate(()=>store.page),'lab2');
  // Cross-day navigation stays available, but does not manufacture a recap.
  await page.evaluate(()=>go('lab1'));assert.equal(await page.evaluate(()=>chapterPhase()),'practice');
  await page.evaluate(()=>{project().guidance.day1Step=3;save();render();});
  assert.equal(await page.locator('.chapter-choices h3').innerText(),'Which response best handles the request below?');
  assert.ok((await page.locator('main').innerText()).includes(preset==='tutor'?'exact biology exam':preset==='business'?'customers':'every goal'));
  await page.locator('.chapter-choices .choice').nth(1).click();assert.ok(await page.locator('#day1-next').isDisabled());
  await page.locator('.chapter-choices .choice').nth(0).click();assert.ok(await page.locator('#day1-next').isEnabled());
 }
 await page.evaluate(()=>{store.page='lab3';project().guidance.chapters.lab3='practice';project().guidance.day3Explored=[0,1,2];project().guidance.day3Checks={0:{selected:0}};render();});
 await page.locator('.chapter-choices .choice').nth(1).click();assert.ok(await page.getByRole('button',{name:'Next example →',exact:true}).isDisabled());
 await page.evaluate(()=>moveDay3Example(1));assert.equal(await page.evaluate(()=>project().guidance.day3ExampleStep||0),0);
 await page.locator('.chapter-choices .choice').nth(0).click();await page.getByRole('button',{name:'Next example →',exact:true}).click();assert.equal(await page.evaluate(()=>project().guidance.day3ExampleStep),1);
 console.log('PASS: all three presets; aligned yes/no and uncertainty choices, wrong/correct answer gates, blocked premature practice/recap callbacks, no unfinished review controls, saved-answer resume, old completion flags do not interrupt cross-day navigation, and a wrong revisited example cannot advance. Eve mocked; no live OpenAI test.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
