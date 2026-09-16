const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const journey = require('./blocks/learning-journey');
const eve = require('./blocks/eve-teacher');

assert.equal(journey.canTransition('learn', 'see'), true);
assert.equal(journey.canTransition('see', 'practice', { demonstrationSeen: false }), false);
assert.equal(journey.canTransition('see', 'practice', { demonstrationSeen: true }), true);
assert.equal(journey.canTransition('practice', 'recap', { practiceFinished: false }), false);
assert.equal(journey.canTransition('practice', 'recap', { practiceFinished: true }), true);
assert.deepEqual(journey.stepModel('practice').map(step => step.active), [false, false, true, false]);

let resolveFirst;
const calls = [];
const queue = eve.createTurnQueue(async value => { calls.push(value); if (value === 'first') await new Promise(resolve => { resolveFirst = resolve; }); });
const first = queue.enqueue('first');
queue.enqueue('stale');
queue.enqueue('latest');
setImmediate(() => resolveFirst());

(async () => {
  await first;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['first', 'latest']);

  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/runtime-config.js') {
      response.writeHead(200, { 'content-type': 'application/javascript' });
      return response.end('window.BUILD_AI_CONFIG={requireCourseSession:false,realtimeEnabled:false};');
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = path.join(root, relative);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); return response.end('Not found'); }
    response.writeHead(200, { 'content-type': file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html' });
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(8994, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8994');
    await page.locator('#learner-name').waitFor();
    const versions = await page.evaluate(() => Object.fromEntries(Object.entries(AI102Blocks).map(([key, value]) => [key, value.VERSION])));
    assert.deepEqual(versions, { learningJourney: '0.1.0', classroomUI: '0.1.0', eveTeacher: '0.1.0' });
    await page.evaluate(() => { eveTeachMoment = async () => {}; playLiveEve = async () => {}; stopEve = () => {}; });
    await page.locator('#learner-name').fill('Emma');
    await page.getByRole('button', { name: 'Start AI 102', exact: true }).click();
    await page.getByRole('button', { name: /Biology tutor/ }).click();
    let action = await page.evaluate(() => evePayload(0, 'Guide me.', 'guidance').next_action);
    assert.match(action, /Type an agent name/);
    await page.getByRole('button', { name: 'Save name & begin Mission 1 →', exact: true }).click();
    assert.equal(await page.evaluate(() => chapterPhase()), 'learn');
    await page.evaluate(() => setChapterPhase('practice'));
    assert.equal(await page.evaluate(() => chapterPhase()), 'learn');
    await page.getByRole('button', { name: 'Watch AI handle a request →', exact: true }).click();
    assert.equal(await page.evaluate(() => chapterPhase()), 'see');
    await page.evaluate(() => setChapterPhase('practice'));
    assert.equal(await page.evaluate(() => chapterPhase()), 'see');
    await page.getByRole('button', { name: 'Show what happens', exact: true }).click();
    await page.getByRole('button', { name: 'Try it yourself →', exact: true }).click();
    assert.equal(await page.evaluate(() => chapterPhase()), 'practice');
    await page.evaluate(() => {
      const host = document.getElementById('eve-live-host');
      AI102Blocks.classroomUI.renderTeacherStatus(host, { state: 'preparing' });
    });
    assert.equal(await page.locator('#eve-live-controls').getAttribute('aria-busy'), 'true');
    assert.match(await page.locator('#eve-live-controls').innerText(), /continue automatically/);
    await page.evaluate(() => {
      AI102Blocks.classroomUI.renderTeacherStatus(document.getElementById('eve-live-host'), { state: 'error' });
    });
    assert.equal(await page.locator('#eve-live-controls').getAttribute('data-eve-state'), 'error');
    assert.match(await page.locator('#eve-live-controls').innerText(), /Try again/);
    await page.evaluate(() => localStorage.setItem('block-test', JSON.stringify({ phase: chapterPhase() })));
    await page.reload();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('block-test')).phase), 'practice');
  } finally { await browser.close(); server.close(); }
  console.log('Shippable blocks passed: public APIs, queue deduplication, actual gated controls, UI states, saved-state reload and error state.');
})().catch(error => { console.error(error); process.exitCode = 1; });
