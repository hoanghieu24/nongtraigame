// Real Chrome smoke checks. Run Vite on port 3000, then node tests/browser-smoke.mjs.
// Uses Chrome DevTools directly so no browser automation dependencies are needed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const origin = process.env.GAME_TEST_URL || 'http://127.0.0.1:3000';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean);
let executable;
for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch {} }
assert.ok(executable, 'Set CHROME_PATH to a Chrome or Edge executable.');
const profile = await mkdtemp(path.join(os.tmpdir(), 'farm-browser-'));
const artifacts = await mkdtemp(path.join(os.tmpdir(), 'farm-screenshots-'));
const browser = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-allow-origins=*', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,800', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket, seq = 0;
const pending = new Map(), handlers = new Map(), exceptions = [];
function call(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 30000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
function on(method, fn) { const list = handlers.get(method) || []; list.push(fn); handlers.set(method, list); }
function pageApi(sessionId) {
  return {
    send: (method, params) => call(method, params, sessionId),
    eval: async (expression) => {
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    },
    screenshot: async (name) => {
      console.log('Screenshot:', name);
      await call('Page.bringToFront', {}, sessionId);
      const { data } = await call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false, optimizeForSpeed: true }, sessionId);
      await writeFile(path.join(artifacts, name + '.png'), Buffer.from(data, 'base64'));
    },
  };
}
async function waitFor(page, expression, description, timeout = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeout) { if (await page.eval(expression)) return; await delay(200); }
  throw new Error(`Timed out waiting for ${description}`);
}
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(150); }
  }
  assert.ok(port, 'Chrome started its debug server.');
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) {
      const task = pending.get(msg.id); if (!task) return;
      clearTimeout(task.timeout); pending.delete(msg.id);
      if (msg.error) task.reject(new Error(JSON.stringify(msg.error))); else task.resolve(msg.result);
    } else for (const fn of handlers.get(msg.method) || []) fn(msg.params, msg.sessionId);
  });
  on('Runtime.exceptionThrown', (p) => exceptions.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text));
  // Keep smoke-test farms in the browser, never touch the developer's saved farms.
  on('Fetch.requestPaused', (p, sessionId) => {
    const body = p.request.url.includes('/api/farms') ? { ok: true, farms: [] } : { ok: true };
    call('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') }, sessionId).catch(() => {});
  });
  const { browserContextId } = await call('Target.createBrowserContext');
  async function newPage() {
    const { targetId } = await call('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    const page = pageApi(sessionId);
    await page.send('Runtime.enable'); await page.send('Page.enable');
    await page.send('Fetch.enable', { patterns: [{ urlPattern: origin + '/api/*' }] });
    return page;
  }
  const host = await newPage();
  await host.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await host.screenshot('browser-ready');
  await host.send('Page.navigate', { url: origin + '/?debug&nopeer&q=low' });
  await waitFor(host, '!!window.__ffp?.ui?.menu?.g', 'game menu');
  console.log('Desktop initialized');
  await host.screenshot('desktop-menu');
  await host.eval(`window.__ffp.startFarm({ profile: { id: 'smoke-host', name: 'Hiếu', preset: 0 }, farmName: 'Browser smoke test' })`);
  await waitFor(host, 'window.__ffp.mode === "play"', 'farm start');
  await host.eval('window.__ffp.ui.close(); window.__ffp.persist = () => {}');
  await delay(1200);
  await host.eval('window.__ffp.ui.close()');
  await host.eval(`(() => {
    const g=window.__ffp, w=g.store.state.world.t+100;
    g.store.state.crops={
      p0_0:{id:'p0_0',r:0,c:0,crop:'carrot',s:'planted',g:0.1,w,by:[]},
      p0_1:{id:'p0_1',r:0,c:1,crop:'tomato',s:'planted',g:0.5,w,by:[]},
      p0_2:{id:'p0_2',r:0,c:2,crop:'carrot',s:'ripe',g:1,w,by:[]}
    }; g.store.touch('crops');
    const matrix=g.views.crop.soil.matrix.clone();g.views.crop.soil.getMatrixAt(0,matrix);
    g.local.x=matrix.elements[12]+2;g.local.z=matrix.elements[14]+5;
  })()`);
  await delay(700);
  assert.equal(await host.eval('[...window.__ffp.views.crop.plants.values()].reduce((n,b)=>n+b.count,0)'), 9, 'three growth stages have real instanced plants');
  assert.equal(await host.eval('window.__ffp._err || 0'), 0, 'farm frame loop has no error');
  await host.screenshot('desktop-farm');
  const roomCode = await host.eval('window.__ffp.session.code');
  const guest = await newPage();
  await guest.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await guest.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await guest.send('Page.navigate', { url: origin + '/?debug&nopeer&q=low' });
  await waitFor(guest, '!!window.__ffp?.ui?.menu?.g', 'mobile menu');
  await guest.screenshot('mobile-menu');
  await guest.eval(`window.__ffp.joinFarm(${JSON.stringify(roomCode)}, { id: 'smoke-guest', name: 'Huyền', preset: 1 })`);
  await waitFor(guest, 'window.__ffp.mode === "play"', 'co-op join');
  await guest.eval('window.__ffp.ui.close(); window.__ffp.persist = () => {}');
  await delay(1000); await guest.eval('window.__ffp.ui.close()');
  assert.equal(await guest.eval('window.__ffp.session.role'), 'client');
  assert.equal(await host.eval('window.__ffp.sim.connected().length'), 2);
  await guest.eval('window.__ffp.local.x=window.__ffp.session.remotePoses[window.__ffp.store.state.meta.hostId]?.x || 0');
  const bounds = await guest.eval(`(() => { const ids=['hudL','hudR','hotbar','acts']; return ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}); })()`);
  for (const b of bounds) assert.ok(b.x >= 0 && b.y >= 0 && b.right <= 845 && b.bottom <= 391, `${b.id} fits mobile landscape: ${JSON.stringify(b)}`);
  assert.ok(bounds[0].right < bounds[1].x, 'mobile HUD groups do not overlap');
  await guest.screenshot('mobile-farm');
  // Portrait iPhone fallback rotates the whole game; canvas must fill that viewport.
  await guest.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(650);
  const rotated = await guest.eval(`(() => { const r=document.getElementById('c').getBoundingClientRect();return {rot:document.getElementById('app').classList.contains('rot'),w:r.width,h:r.height};})()`);
  assert.ok(rotated.rot && Math.abs(rotated.w - 390) <= 1 && Math.abs(rotated.h - 844) <= 1, 'portrait rotation fills screen');
  await guest.screenshot('mobile-portrait');
  await guest.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await delay(400);
  await host.eval('window.__ffp.rsc2d.open()');
  await guest.eval('window.__ffp.rsc2d.open()');
  await waitFor(guest, 'window.__ffp.rsc2d.active && window.__ffp.rsc2d.chefs.length >= 2', 'shared kitchen chefs');
  await delay(1200);
  assert.equal(await host.eval('window.__ffp.rsc2d.isHost'), true);
  assert.equal(await guest.eval('window.__ffp.rsc2d.isHost'), false);
  assert.equal(await guest.eval('window.__ffp.rsc2d.chefs.length'), await host.eval('window.__ffp.rsc2d.chefs.length'));
  await host.screenshot('desktop-kitchen'); await guest.screenshot('mobile-kitchen');
  const touchTargets = await guest.eval('Array.from(document.querySelectorAll(".rscTouchUi button")).map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))');
  assert.ok(touchTargets.length >= 4 && touchTargets.every((r) => r.width >= 44 && r.height >= 44), 'mobile kitchen buttons have real 44px touch targets');
  const timerBeforeBackground = await host.eval('window.__ffp.rsc2d.timer');
  await delay(1400);
  assert.ok(await host.eval(`window.__ffp.rsc2d.timer < ${timerBeforeBackground - 0.6}`), 'kitchen continues while host tab is in the background');
  const matching = await guest.eval('JSON.stringify(window.__ffp.rsc2d.guests.map(g=>g.id+":"+g.dish).sort())');
  assert.equal(matching, await host.eval('JSON.stringify(window.__ffp.rsc2d.guests.map(g=>g.id+":"+g.dish).sort())'), 'both players see the same orders');
  await host.eval(`window.__savedCalls=0;window.__ffp.persist=()=>{window.__savedCalls++};window.__ffp.autosaveT=19.99;window.__ffp.update(0.02)`);
  assert.equal(await host.eval('window.__savedCalls'), 1, 'autosave also runs inside the kitchen');
  await host.eval('window.__ffp.rsc2d.close();window.__ffp.rsc2d.earned=999;window.__ffp.backToMenu();window.__ffp.startFarm({profile:{id:"smoke-new",name:"New",preset:0},farmName:"New farm"})');
  assert.equal(await host.eval('window.__ffp.rsc2d.earned'), 0, 'a different farm starts a fresh kitchen session');
  assert.equal(await host.eval('window.__ffp._err || 0'), 0, 'host frame loop has no error');
  assert.equal(await guest.eval('window.__ffp._err || 0'), 0, 'guest frame loop has no error');
  assert.deepEqual(exceptions, [], 'no uncaught browser exceptions');
  console.log('PASS: desktop/mobile menu, farm HUD, portrait rotation, two-player join and shared kitchen.');
  console.log('Screenshots:', artifacts);
  await call('Target.disposeBrowserContext', { browserContextId });
} finally {
  for (const task of pending.values()) clearTimeout(task.timeout);
  socket?.close(); browser.kill();
  await delay(400);
  assert.equal(path.dirname(path.resolve(profile)), path.resolve(os.tmpdir()), 'Only delete this test’s temporary Chrome profile.');
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
