const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const root = __dirname;
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/runtime-config.js') {
      response.writeHead(200, { 'content-type': 'application/javascript' });
      return response.end('window.BUILD_AI_CONFIG={requireCourseSession:false,realtimeEnabled:false};');
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = path.join(root, relative);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404);
      return response.end('Not found');
    }
    const type = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html';
    response.writeHead(200, { 'content-type': type });
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(8996, '127.0.0.1', resolve));

  const worker = await import(pathToFileURL(path.join(root, 'dist/server/index.js')));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8996');
    await page.locator('#learner-name').waitFor();
    await page.evaluate(() => {
      eveTeachMoment = async () => {};
      playLiveEve = async () => {};
      stopEve = () => {};
    });

    await page.locator('#learner-name').fill('Emma');
    await page.getByRole('button', { name: 'Start AI 102', exact: true }).click();
    let payload = await page.evaluate(() => evePayload(0, 'Open the current screen.', 'guidance'));
    assert.equal(payload.next_action, 'Choose one starting mission on the page.');
    assert.match(payload.visible_actions, /Biology tutor.*Business helper.*Personal coach/);

    await page.getByRole('button', { name: /Business helper/ }).click();
    payload = await page.evaluate(() => evePayload(0, 'Guide the current setup.', 'guidance'));
    assert.match(payload.next_action, /Type an agent name.*Save name & begin Mission 1/);
    assert.doesNotMatch(payload.next_action, /choose.*purpose/i);

    await page.getByRole('button', { name: 'Save name & begin Mission 1 →', exact: true }).click();
    payload = await page.evaluate(() => evePayload(1, 'Teach this lesson.', 'guidance'));
    assert.equal(payload.next_action, 'Select “Watch AI handle a request →”.');
    assert.match(payload.visible_actions, /Watch AI handle a request/);
    let instructions = worker.realtimeContext(payload).instructions;
    assert.match(instructions, /Correct next action: Select “Watch AI handle a request →”/);
    assert.match(instructions, /Never mention a different button, hidden activity, later mission, or earlier action/);

    await page.getByRole('button', { name: 'Watch AI handle a request →', exact: true }).click();
    payload = await page.evaluate(() => evePayload(1, 'Guide the current screen.', 'guidance'));
    assert.equal(payload.next_action, 'Select “Show what happens”.');

    await page.getByRole('button', { name: 'Show what happens', exact: true }).click();
    payload = await page.evaluate(() => evePayload(1, 'Explain the revealed example.', 'guidance'));
    assert.equal(payload.next_action, 'Select “Try it yourself →”.');

    await page.getByRole('button', { name: 'Try it yourself →', exact: true }).click();
    payload = await page.evaluate(() => evePayload(1, 'Guide the practice.', 'guidance'));
    assert.equal(payload.next_action, 'Select one answer on the page.');
    assert.equal(payload.visible_actions, 'Unanswered multiple-choice options');
    const answerOptions = await page.locator('.chapter-choices .choice').allTextContents();
    for (const option of answerOptions) assert.ok(!payload.visible_actions.includes(option));

    await page.locator('.chapter-choices .choice').nth(0).click();
    payload = await page.evaluate(() => evePayload(1, 'Explain the checked result.', 'guidance'));
    assert.equal(payload.next_action, 'Select another answer on the page.');

    await page.locator('.chapter-choices .choice').nth(1).click();
    payload = await page.evaluate(() => evePayload(1, 'Explain the checked result.', 'guidance'));
    assert.equal(payload.next_action, 'Select “Next: Make a prediction”.');
    assert.match(payload.visible_actions, /Next: Make a prediction/);

    await page.reload();
    await page.getByRole('button', { name: 'Resume with Eve', exact: true }).click();
    await page.evaluate(() => { eveTeachMoment = async () => {}; playLiveEve = async () => {}; stopEve = () => {}; });
    payload = await page.evaluate(() => evePayload(1, 'Resume the saved activity.', 'guidance'));
    assert.equal(payload.next_action, 'Select “Try again”.', 'A visible voice failure must ground Eve to the recovery control.');
    await page.evaluate(() => { eveDebug.error = ''; voiceState('idle'); });
    payload = await page.evaluate(() => evePayload(1, 'Resume the saved activity.', 'guidance'));
    assert.equal(payload.next_action, 'Select “Next: Make a prediction”.');

    const missionOpeners = {
      2: 'Look inside a short sentence →',
      3: 'Follow a worked example →',
      4: 'Compare possible word choices →',
      5: 'Follow a request through the setup →',
      6: 'Follow a tool action →',
      7: 'Inspect a worked test →',
    };
    for (const [dayText, opener] of Object.entries(missionOpeners)) {
      const day = Number(dayText);
      await page.locator('.lab-nav').getByRole('button', { name: new RegExp(`Mission ${day} ·`) }).click();
      payload = await page.evaluate(currentDay => evePayload(currentDay, 'Teach the current mission.', 'guidance'), day);
      assert.equal(payload.next_action, `Select “${opener}”.`, `Mission ${day} supplied the wrong lesson action.`);
      instructions = worker.realtimeContext(payload).instructions;
      assert.match(instructions, new RegExp(opener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await page.getByRole('button', { name: opener, exact: true }).click();
      payload = await page.evaluate(currentDay => evePayload(currentDay, 'Guide the worked example.', 'guidance'), day);
      assert.equal(payload.next_action, 'Select “Show what happens”.', `Mission ${day} supplied the wrong worked-example action.`);
    }

    console.log('PASS: Eve’s exact next action follows real controls through Mission Briefing, naming, Mission 1 choices, saved-state resume, and the lesson-to-example transition in all seven missions. The server prompt receives only grounded visible actions. OpenAI voice is mocked.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
