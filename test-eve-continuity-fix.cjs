const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require('playwright');

class D1 {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    for (const file of fs.readdirSync(__dirname + '/drizzle').filter(name => name.endsWith('.sql')).sort()) {
      this.db.exec(fs.readFileSync(__dirname + '/drizzle/' + file, 'utf8'));
    }
  }
  prepare(sql) {
    return {
      bind: (...args) => ({
        first: async () => this.db.prepare(sql).get(...args) || null,
        all: async () => ({ results: this.db.prepare(sql).all(...args) }),
        run: async () => ({ meta: { changes: Number(this.db.prepare(sql).run(...args).changes) } }),
        sql,
        args,
      }),
    };
  }
  async batch(items) {
    this.db.exec('BEGIN');
    try {
      const result = items.map(item => ({ meta: { changes: Number(this.db.prepare(item.sql).run(...item.args).changes) } }));
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

const mockRTC = () => {
  window.rtcTest = { peers: [], sends: [], microphoneRequests: 0 };
  navigator.mediaDevices.getUserMedia = async () => {
    rtcTest.microphoneRequests++;
    throw Error('The automatic teacher must not request a microphone.');
  };
  HTMLMediaElement.prototype.play = async () => {};
  HTMLMediaElement.prototype.pause = () => {};
  class Channel {
    constructor() { this.readyState = 'connecting'; }
    close() { this.readyState = 'closed'; }
    send(raw) {
      const event = JSON.parse(raw);
      rtcTest.sends.push(event);
      if (event.type === 'response.create') {
        this.emit({ type: 'response.created' });
        this.emit({ type: 'output_audio_buffer.started' });
      }
    }
    emit(event) { this.onmessage?.({ data: JSON.stringify(event) }); }
  }
  window.RTCPeerConnection = class {
    constructor() { this.channel = null; rtcTest.peers.push(this); window.currentPeer = this; }
    addTransceiver() {}
    createDataChannel() { return this.channel = new Channel(); }
    async createOffer() { return { sdp: 'v=0\r\nmock-offer' }; }
    async setLocalDescription() {}
    async setRemoteDescription() {
      this.channel.readyState = 'open';
      setTimeout(() => this.channel.onopen?.(), 0);
    }
    close() { this.channel?.close(); }
  };
  window.finishEve = text => {
    currentPeer.channel.emit({ type: 'response.output_audio_transcript.done', transcript: text });
    currentPeer.channel.emit({ type: 'output_audio_buffer.stopped' });
  };
  window.cutOffEve = () => currentPeer.channel.emit({ type: 'output_audio_buffer.cleared' });
};

(async () => {
  const module = await import(pathToFileURL(__dirname + '/dist/server/index.js'));
  const worker = module.default;
  const db = new D1();
  const env = { DB: db, OPENAI_API_KEY: 'mock-private-key', COURSE_ADMIN_EMAIL: 'owner@example.com', COURSE_INITIAL_STUDENTS: 'continuity@example.com' };
  const nativeFetch = global.fetch;
  let callNumber = 0;
  let hangups = 0;
  global.fetch = async (url, options) => {
    if (!String(url).startsWith('https://api.openai.com/')) return nativeFetch(url, options);
    if (String(url).endsWith('/realtime/calls')) {
      return new Response('v=0\r\nmock-answer', { headers: { location: 'https://api.openai.com/v1/realtime/calls/rtc_' + (++callNumber) } });
    }
    if (String(url).endsWith('/hangup')) {
      hangups++;
      return new Response(null, { status: 200 });
    }
    throw Error('Unexpected OpenAI path: ' + url);
  };

  const workerRequest = async (path, init = {}, cookie = '') => {
    const headers = new Headers(init.headers);
    headers.set('oai-authenticated-user-id', 'continuity-user');
    headers.set('oai-authenticated-user-email', 'continuity@example.com');
    if (cookie) headers.set('cookie', cookie);
    return worker.fetch(new Request('http://course.test' + path, { ...init, headers }), env);
  };

  const first = await workerRequest('/api/session/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ takeover: false }),
  });
  assert.equal(first.status, 200);
  const cookie = first.headers.get('set-cookie').split(';')[0];
  db.db.prepare("UPDATE course_sessions SET call_id='rtc_existing' WHERE user_id='continuity-user'").run();

  const reload = await workerRequest('/api/session/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ takeover: false }),
  }, cookie);
  assert.equal(reload.status, 200);
  assert.equal(hangups, 0, 'A reload or same-session tab must not hang up active Eve audio.');
  assert.equal(db.db.prepare("SELECT call_id FROM course_sessions WHERE user_id='continuity-user'").get().call_id, 'rtc_existing');

  const independentTab = await workerRequest('/api/session/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ takeover: false }),
  });
  assert.equal(independentTab.status, 409);
  assert.equal(hangups, 0, 'A separate tab without the session cookie must not silently take over and stop Eve.');

  db.db.exec("DELETE FROM course_sessions WHERE user_id='continuity-user'");
  const server = http.createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const headers = new Headers(request.headers);
      headers.set('oai-authenticated-user-id', 'browser-continuity-user');
      headers.set('oai-authenticated-user-email', 'continuity@example.com');
      const webRequest = new Request('http://127.0.0.1:8998' + request.url, {
        method: request.method,
        headers,
        ...(!['GET', 'HEAD'].includes(request.method) ? { body: Buffer.concat(chunks) } : {}),
      });
      const result = await worker.fetch(webRequest, env);
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) {
      response.writeHead(500);
      response.end(error.message);
    }
  });
  await new Promise(resolve => server.listen(8998, '127.0.0.1', resolve));

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(mockRTC);
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8998');
    await page.waitForFunction(() => CourseSession.active);
    await page.locator('#learner-name').fill('Emma');
    await page.getByRole('button', { name: 'Start AI 102', exact: true }).click();
    await page.waitForFunction(() => rtcTest.sends.some(event => event.type === 'response.create'));
    assert.equal(await page.evaluate(() => project().guidance.eveGreeted), false, 'Starting audio must not complete the welcome.');

    await page.evaluate(() => cutOffEve());
    assert.equal(await page.evaluate(() => project().guidance.eveGreeted), false, 'Interrupted audio must leave the welcome incomplete.');
    await page.evaluate(() => EveRealtime.startForPage());
    await page.waitForFunction(() => rtcTest.sends.filter(event => event.type === 'response.create').length >= 2);
    await page.evaluate(() => finishEve('Hi Emma, welcome to AI 102. I will guide you through the complete course.'));
    assert.equal(await page.evaluate(() => project().guidance.eveGreeted), true, 'Only a fully completed welcome may be saved.');

    await page.getByRole('button', { name: /Business helper/ }).click();
    await page.waitForFunction(() => rtcTest.sends.filter(event => event.type === 'response.create').length >= 3);
    await page.evaluate(() => finishEve('A business helper supports planning, communication, and practical decisions.'));
    await page.getByRole('button', { name: 'Save name & begin Mission 1 →', exact: true }).click();
    await page.waitForFunction(() => rtcTest.peers.length === 2);
    await page.waitForFunction(() => rtcTest.sends.filter(event => event.type === 'response.create').length >= 4);
    const missionOne = await page.evaluate(() => rtcTest.sends.filter(event => event.type === 'response.create').at(-1).response.instructions);
    assert.match(missionOne, /first explanation in Mission 1/i);
    assert.match(missionOne, /Start from the beginning/i);
    assert.match(missionOne, /4[–-]6 connected sentences/i);
    assert.match(missionOne, /70[–-]120 words/i);
    assert.doesNotMatch(missionOne, /A preset is a ready-made starting idea/i);
    assert.doesNotMatch(missionOne, /Make one brief connection/i);
    assert.doesNotMatch(missionOne, /Finish one short teaching thought/i);
    assert.equal(await page.evaluate(() => rtcTest.microphoneRequests), 0);
    assert.ok(hangups >= 1, 'Changing missions should close the old voice context before creating a fresh one.');
    console.log('PASS: same-session reload and a separate tab cannot silently stop Eve; an interrupted welcome remains incomplete; a completed welcome is saved; Mission 1 opens a fresh voice session with no false recap and a complete 4–6 sentence teaching brief. OpenAI transport and browser audio are mocked.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    global.fetch = nativeFetch;
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
