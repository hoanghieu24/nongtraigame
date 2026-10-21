import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReadySetCook2D } from '../src/restaurant/ReadySetCook2D.js';
import { PlayerController, StationLogic, CrisisManager, DifficultyDirector } from '../src/restaurant/KitchenLogic.js';

function kitchen(role = 'host') {
  const sent = [];
  const scene = Object.create(ReadySetCook2D.prototype);
  scene.g = {
    session: { role, sendRsc: (msg) => sent.push(msg) },
    store: { state: { meta: { hostId: 'p1' }, players: {
      p1: { id: 'p1', name: 'An', connected: true },
      p2: { id: 'p2', name: 'Bình', connected: true },
    } } },
    input: { resetTouch() {}, axis: () => ({ x: 0, y: 0 }), keys: new Set() },
    audio: { sfx() {} },
  };
  Object.assign(scene, { t: 0, floats: [], particles: [], tapRipples: [], touchJoy: {}, active: true });
  scene.playerController = new PlayerController(scene);
  scene.stationLogic = new StationLogic(scene);
  scene.crisisManager = new CrisisManager(scene);
  scene.difficultyDirector = new DifficultyDirector(scene);
  scene.resetState();
  scene.chefs[1].present = true;
  scene.draw = () => {};
  return { scene, sent };
}

function plateCount(scene) {
  const heldCount = (h) => !h ? 0 : h.kind === 'extinguisher' ? heldCount(h.prevHold) : h.kind === 'dirty' ? h.count || 1 : h.hasPlate ? 1 : 0;
  return scene.cleanPlateStack + scene.plates.filter((p) => p.hasPlate).length + scene.sink.dirtyCount
    + scene.chefs.reduce((sum, c) => sum + heldCount(c.hold), 0)
    + (scene.drinkMachine.reservedPlate ? 1 : 0)
    + scene.tables.reduce((sum, tb) => sum + (tb.guest?.phase === 'eating' ? 1 : 0) + (tb.dirtyCount || 0), 0);
}

const tick = (scene, seconds) => { for (let i = 0; i < Math.ceil(seconds * 20); i++) scene.update(0.05); };
const snapshot = (scene) => JSON.parse(JSON.stringify(scene.getSyncState()));

test('two chefs share a five-second oven, independent of chef count', () => {
  const { scene } = kitchen();
  scene.ovens[0].state = 'baking';
  tick(scene, 2.5);
  assert.equal(scene.ovens[0].state, 'baking');
  assert.ok(Math.abs(scene.ovens[0].prog - 0.5) < 0.001);
  tick(scene, 2.55);
  assert.equal(scene.ovens[0].state, 'ready');
  assert.ok(scene.ovens[0].burn < 0.03);
});

test('two chefs at one board do not double chopping speed or duplicate food', () => {
  const { scene } = kitchen();
  scene.boards[0].ing = 'tomato';
  scene.chefs.forEach((c) => { c.x = 1046; c.y = 545; });
  tick(scene, 1.5);
  assert.ok(Math.abs(scene.boards[0].prog - 0.5) < 0.001);
  tick(scene, 1.55);
  assert.equal(scene.chefs.filter((c) => c.hold?.dish === 'tomato_salad').length, 1);
  assert.equal(plateCount(scene), 4);
});

test('washing with two chefs still takes two seconds and conserves plates', () => {
  const { scene } = kitchen();
  scene.consumeOneCleanPlate();
  scene.sink.dirtyCount = 1;
  scene.chefs.forEach((c) => { c.x = 204; c.y = 226; });
  tick(scene, 1);
  assert.equal(scene.sink.dirtyCount, 1);
  tick(scene, 1.05);
  assert.equal(scene.sink.dirtyCount, 0);
  assert.equal(plateCount(scene), 4);
});

test('complete service, dirty plate collection and washing recirculate four plates', () => {
  const { scene } = kitchen();
  const chef = scene.myChef, table = scene.tables[0];
  scene.tryAddHeldItem(chef, 'tomato_cut');
  assert.equal(plateCount(scene), 4);
  chef.x = table.standX; chef.y = table.standY;
  assert.equal(scene.interactAt(chef, null, table), true);
  assert.equal(scene.served, 1);
  assert.equal(plateCount(scene), 4);
  tick(scene, 3.3);
  assert.equal(table.dirty, true);
  assert.equal(scene.interactAt(chef, null, table), true);
  assert.equal(plateCount(scene), 4);
  const sink = scene.getStation('sink');
  chef.x = sink.standX; chef.y = sink.standY;
  scene.interactAt(chef, sink, null);
  tick(scene, 2.05);
  assert.equal(scene.getTotalCleanPlates(), 4);
  assert.equal(plateCount(scene), 4);
});

test('customer requires the exact recipe and cannot eat the same dish twice', () => {
  const { scene } = kitchen();
  const chef = scene.myChef, table = scene.tables[0];
  table.guest.dish = 'caprese';
  scene.tryAddHeldItem(chef, 'tomato_cut');
  assert.equal(scene.stationLogic.handleTableInteract(chef, table), false);
  assert.equal(scene.served, 0);
  scene.tryAddHeldItem(chef, 'mozz_cut');
  assert.equal(scene.stationLogic.handleTableInteract(chef, table), true);
  scene.tryAddHeldItem(chef, 'tomato_cut');
  assert.equal(scene.stationLogic.handleTableInteract(chef, table), false);
  assert.equal(scene.served, 1);
});

test('occupied assembly plates are not available to the drink dispenser', () => {
  const { scene } = kitchen();
  scene.cleanPlateStack = 0;
  scene.plates.forEach((p) => { p.items = ['mozz_cut']; });
  assert.equal(scene.getTotalCleanPlates(), 0);
  assert.equal(scene.consumeOneCleanPlate(0), false);
  assert.equal(scene.stationLogic.handleDrinkInteract(scene.myChef, scene.getStation('drink')), false);
});

test('partial ingredients transfer their existing plate without duplication', () => {
  const { scene } = kitchen();
  scene.plates[0].items = ['mozz_cut'];
  assert.equal(scene.stationLogic.handlePlateInteract(scene.myChef, scene.getStation('plateTop')), true);
  assert.equal(scene.myChef.hold.hasPlate, true);
  assert.equal(plateCount(scene), 4);
  scene.stationLogic.handleTrashInteract(scene.myChef, scene.getStation('trash'));
  assert.equal(plateCount(scene), 4);
});

test('ingredients cannot transform dirty plates, extinguishers or cooked pizza', () => {
  const { scene } = kitchen();
  for (const held of [{ kind: 'dirty', count: 1 }, { kind: 'extinguisher' }, { kind: 'dish', dish: 'pizza', hasPlate: true }]) {
    scene.myChef.hold = held;
    assert.equal(scene.tryAddHeldItem(scene.myChef, 'dough'), false);
    assert.equal(scene.myChef.hold, held);
  }
});

test('client actions send intent without mutating its shared kitchen', () => {
  const { scene, sent } = kitchen('client');
  const tomato = scene.getStation('tomato');
  assert.equal(scene.interactAt(scene.myChef, tomato, null), false);
  assert.equal(scene.myChef.hold, null);
  assert.equal(sent.at(-1).kind, 'client_act');
  scene.interactAt(scene.myChef, tomato, null);
  assert.equal(sent.length, 1, 'repeated action waits for a host snapshot');
});

test('host validates client action proximity and finite pose data', () => {
  const { scene } = kitchen();
  scene.handleNetworkMsg('p2', { kind: 'client_act', stationId: 'tomato' });
  assert.equal(scene.chefs[1].hold, null);
  const tomato = scene.getStation('tomato');
  scene.chefs[1].x = tomato.standX; scene.chefs[1].y = tomato.standY;
  scene.handleNetworkMsg('p2', { kind: 'client_act', stationId: 'tomato' });
  assert.equal(scene.chefs[1].hold.kind, 'raw');
  scene.handleNetworkMsg('p2', { kind: 'client_move', x: NaN, y: 20, vx: 0, vy: 0, dir: 0 });
  assert.equal(scene.chefs[1].x, tomato.standX);
});

test('client snapshots retain predicted position and share guest references/styles', () => {
  const host = kitchen().scene, client = kitchen('client').scene;
  client.applySyncState(snapshot(host));
  client.myChef.x = 900;
  client.myChef.path = [{ x: 920, y: 500 }];
  client.applySyncState(snapshot(host));
  assert.equal(client.myChef.x, 900);
  assert.equal(client.myChef.path.length, 1);
  assert.equal(client.tables[0].guest, client.guests.find((g) => g.tableId === 0));
  assert.ok(client.guests.every((g) => Number.isFinite(g.animT) && g.style?.skin));
  host.restartShift();
  client.applySyncState(snapshot(host));
  assert.equal(client.myChef.x, 620);
  assert.equal(client.myChef.path.length, 0);
});

test('client cannot advance the oven or chopping before authoritative snapshots', () => {
  const host = kitchen().scene, client = kitchen('client').scene;
  host.ovens[0].state = 'baking'; host.boards[0].ing = 'tomato';
  client.applySyncState(snapshot(host));
  client.myChef.x = 1046; client.myChef.y = 545;
  tick(client, 1);
  assert.equal(client.boards[0].prog, 0);
  assert.equal(client.ovens[0].prog, 0);
});

test('order ticket hit testing uses the same urgency order as drawing', () => {
  const { scene } = kitchen();
  scene.guests[2].patience = 2;
  let chosen;
  scene.autoSmartStep = (chef, dish, table) => { chosen = table; };
  scene.onCanvasTap(460, 60);
  assert.equal(chosen.id, scene.getOrderQueue()[0].tableId);
});

test('completion is paid exactly once and an idle shift earns no completion reward', () => {
  const { scene } = kitchen();
  scene.served = 1;
  scene.difficultyDirector.elapsed = 179.95;
  tick(scene, 0.15);
  assert.equal(scene.matchOver, true);
  assert.equal(scene.difficultyDirector.shiftsCompleted, 1);
  assert.equal(scene.earned, 200);
  scene.finishShift(); scene.difficultyDirector.update(1);
  assert.equal(scene.earned, 200);
  const idle = kitchen().scene;
  idle.finishShift();
  assert.equal(idle.earned, 0);
});

test('background kitchen advances shared timer and equipment without drawing', () => {
  const { scene } = kitchen();
  let draws = 0; scene.draw = () => { draws++; };
  scene.ovens[0].state = 'baking';
  for (let i = 0; i < 20; i++) scene.update(0.1, false);
  assert.ok(Math.abs(scene.timer - 178) < 0.001);
  assert.ok(Math.abs(scene.ovens[0].prog - 0.4) < 0.001);
  assert.equal(draws, 0);
});
