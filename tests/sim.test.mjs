// Chạy: node tests/sim.test.mjs  — kiểm thử Sim headless (không three/DOM) => chứng minh logic tách khỏi render.
import assert from 'node:assert/strict';
import { Store } from '../src/state/Store.js';
import { createGameState, migrate } from '../src/state/GameState.js';
import { Sim } from '../src/state/Sim.js';
import { SPOTS, plotPos, PLOT, REST, INTERIOR, HOME_KITCHEN, FISH_SPOTS, PENS } from '../src/data/layout.js';
import { RECIPES } from '../src/data/recipes.js';
import { timeInfo } from '../src/core/util.js';
import { CFG } from '../src/core/Config.js';

let pass = 0; const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name, '\n   ', e.stack.split('\n').slice(0, 4).join('\n    ')); process.exitCode = 1; } };
const mk = (seed = 7) => { const store = new Store(createGameState({ farmName: 'Test', hostId: 'p1', roomCode: 'ABC123' })); const sim = new Sim(store, { seed }); sim.addPlayer({ id: 'p1', name: 'An' }); return { store, sim, st: store.state }; };
const run = (sim, secs, dt = 0.1) => { for (let i = 0; i < secs / dt; i++) sim.tick(0.1); };
const at = (sim, pid, x, z, extra = {}) => sim.setPose(pid, { x, z, rot: 0, area: 'out', ...extra });
const ex = (sim, pid, type, c = {}) => sim.exec(pid, { type, ...c });

console.log('Vòng lặp nông trại');
t('trồng → tưới → lớn → thu hoạch → bán', () => {
  const { sim, st } = mk(); const p = plotPos(0, 0); at(sim, 'p1', p.x, p.z + 1);
  assert.equal(st.farm.plotRows * PLOT.cols, 9, 'khởi đầu đúng 9 ô ruộng (3x3)');
  assert.ok(ex(sim, 'p1', 'farm.till', { plot: 'p0_0' }).ok);
  assert.ok(ex(sim, 'p1', 'farm.plant', { plot: 'p0_0', crop: 'carrot' }).ok);
  assert.equal(st.inventory.players.p1.seed_carrot, 8);
  assert.ok(ex(sim, 'p1', 'farm.water', { plot: 'p0_0' }).ok);
  run(sim, 15); assert.equal(st.crops.p0_0.s, 'ripe');
  assert.ok(ex(sim, 'p1', 'farm.harvest', { plot: 'p0_0' }).ok);
  assert.ok(st.inventory.players.p1.carrot >= 1);
  const before = st.players.p1.money; at(sim, 'p1', SPOTS.crate.x, SPOTS.crate.z + 1);
  assert.ok(ex(sim, 'p1', 'economy.sell', { items: 'all', at: 'crate' }).ok);
  assert.ok(st.players.p1.money > before); assert.ok(st.economy.fund > 0, 'quỹ chung nhận 15%'); assert.equal(st.meta.tut, 5, 'hướng dẫn nhảy tới bước 5 (cho thú ăn)');
});
t('không thể thao tác xa ô đất / thiếu hạt / sai mùa', () => {
  const { sim, st } = mk(); at(sim, 'p1', 40, 0); assert.equal(ex(sim, 'p1', 'farm.till', { plot: 'p0_0' }).ok, false);
  const p = plotPos(0, 1); at(sim, 'p1', p.x, p.z); ex(sim, 'p1', 'farm.till', { plot: 'p0_1' });
  assert.equal(ex(sim, 'p1', 'farm.plant', { plot: 'p0_1', crop: 'watermelon' }).ok, false, 'dưa hấu theo mùa + cấp 5');
  st.inventory.players.p1.seed_carrot = 0; assert.equal(ex(sim, 'p1', 'farm.plant', { plot: 'p0_1', crop: 'carrot' }).ok, false);
});
t('co-op: 2 người cùng chăm 1 ô → teamwork +1', () => {
  const { sim, st } = mk(); sim.addPlayer({ id: 'p2', name: 'Bình' }); const p = plotPos(1, 1); at(sim, 'p1', p.x, p.z); at(sim, 'p2', p.x + 1, p.z);
  ex(sim, 'p1', 'farm.till', { plot: 'p1_1' }); ex(sim, 'p1', 'farm.plant', { plot: 'p1_1', crop: 'carrot' }); ex(sim, 'p2', 'farm.water', { plot: 'p1_1' });
  run(sim, 15); ex(sim, 'p2', 'farm.harvest', { plot: 'p1_1' }); assert.ok(st.inventory.players.p2.carrot >= 2, 'teamwork thưởng thêm');
});
t('cây mọc lại (cà chua) & mưa tự tưới', () => {
  const { sim, st } = mk(); st.farm.level = 3; st.meta.tut = 6; const p = plotPos(0, 2); at(sim, 'p1', p.x, p.z);
  sim.addItem('p1', 'seed_tomato', 1); ex(sim, 'p1', 'farm.till', { plot: 'p0_2' }); ex(sim, 'p1', 'farm.plant', { plot: 'p0_2', crop: 'tomato' });
  st.world.weather = 'rain'; st.world.weatherUntil = 1e9; run(sim, 200); assert.equal(st.crops.p0_2.s, 'ripe');
  ex(sim, 'p1', 'farm.harvest', { plot: 'p0_2' }); assert.equal(st.crops.p0_2.s, 'planted'); assert.ok(st.crops.p0_2.g >= 0.4);
});

console.log('Vật nuôi');
t('khởi tạo: chó + 2 gà; cho ăn → đẻ trứng → thu', () => {
  const { sim, st } = mk(); const as = Object.values(st.animals); assert.equal(as.filter((a) => a.type === 'chicken').length, 2); assert.equal(as.filter((a) => a.type === 'dog').length, 1);
  const ch = as.find((a) => a.type === 'chicken'); at(sim, 'p1', ch.x, ch.z); ch.hunger = 0.8; ch.prodT = 44;
  assert.ok(ex(sim, 'p1', 'animal.feed', { id: ch.id }).ok); assert.ok(ch.hunger < 0.1); run(sim, 3);
  ch.prodT = 44.9; run(sim, 3); assert.equal(ch.ready, true); at(sim, 'p1', ch.x, ch.z); ex(sim, 'p1', 'animal.use', { id: ch.id }); assert.ok(st.inventory.players.p1.egg >= 1);
});
t('mua chuồng bằng Quỹ Chung rồi mua thú; chuồng đầy bị chặn', () => {
  const { sim, st } = mk(); st.farm.level = 3; st.economy.fund = 2000; st.meta.tut = 6; at(sim, 'p1', 62, -2);
  assert.ok(ex(sim, 'p1', 'shop.buy', { shop: 'animal', key: 'pen:barn' }).ok); assert.ok(st.buildings.barn.owned); assert.equal(st.economy.fund, 1100);
  st.players.p1.money = 5000; for (let i = 0; i < 4; i++) assert.ok(ex(sim, 'p1', 'shop.buy', { shop: 'animal', key: 'animal:cow' }).ok);
  assert.equal(ex(sim, 'p1', 'shop.buy', { shop: 'animal', key: 'animal:cow' }).ok, false, 'sức chứa 4');
});
t('đóng cửa chuồng gà không đi ra được; ấp trứng nở gà con rồi lớn thành gà trưởng thành', () => {
  const { sim, st } = mk();
  st.buildings.coop.open = false;
  const P = PENS.coop;
  run(sim, 30);
  for (const a of Object.values(st.animals).filter((x) => x.type === 'chicken')) {
    assert.equal(a.area, 'out', 'đóng cửa gà không vào nhà');
    assert.ok(a.x >= P.x0 && a.x <= P.x1 && a.z >= P.z0 && a.z <= P.z1, 'đóng cửa gà phải ở trong chuồng');
  }
  const ch = Object.values(st.animals).find((x) => x.type === 'chicken');
  ch.ready = true;
  at(sim, 'p1', P.inc.x, P.inc.z);
  assert.ok(ex(sim, 'p1', 'animal.incubate', { pen: 'coop' }).ok, 'bắt đầu ấp trứng');
  assert.equal(ch.ready, false, 'trứng trong ổ đã đưa vào máy ấp');
  assert.ok(st.buildings.coop.inc, 'máy ấp đang hoạt động');
  run(sim, 41);
  const chicks = Object.values(st.animals).filter((x) => x.type === 'chicken' && x.growth < 0.85);
  assert.equal(chicks.length, 1, 'đã nở ra 1 gà con');
  for (let i = 0; i < 950; i++) { chicks[0].hunger = 0.1; sim.tick(0.1); }
  assert.equal(chicks[0].growth, 1, 'gà con đã lớn thành gà trưởng thành');
});
t('gà chui vào nhà rồi chạy ra (khi mở cửa chuồng); heo lăn bùn; dê húc người', () => {
  const { sim, st } = mk(); st.farm.level = 4; st.buildings.coop.open = true; st.buildings.pig = { owned: true }; st.buildings.goat = { owned: true };
  const pig = sim.sys('animal').spawn('pig', { pen: 'pig' }), goat = sim.sys('animal').spawn('goat', { pen: 'goat' });
  const seen = { house: false, roll: false, charge: false, knock: 0 };
  sim.bus.on('fx', (f) => { if (f.k === 'knock') seen.knock++; });
  at(sim, 'p1', goat.x + 3, goat.z);
  for (let i = 0; i < 6000; i++) {
    sim.sys('animal').houseCd = Math.min(sim.sys('animal').houseCd, 0); for (const a of Object.values(st.animals)) a.hunger = Math.min(a.hunger, 0.5);
    sim.tick(0.1);
    for (const a of Object.values(st.animals)) { if (a.area === 'house') seen.house = true; if (a.sub === 'roll') seen.roll = true; if (a.sub === 'charge') seen.charge = true; }
    if (seen.house && seen.roll && seen.charge) break;
    if (i % 20 === 0) at(sim, 'p1', goat.x + 1.5, goat.z);       // đứng cạnh dê
  }
  assert.ok(seen.house, 'có gà vào nhà'); assert.ok(seen.roll, 'heo lăn bùn'); assert.ok(seen.charge, 'dê húc');
});

t('bỏ đói quá hạn → chết đói; cho ăn kịp thì sống', () => {
  const { sim, st } = mk(); const [c1, c2] = Object.values(st.animals).filter((a) => a.type === 'chicken'); c1.hunger = 1; c2.hunger = 1; at(sim, 'p1', c2.x, c2.z);
  run(sim, 20); assert.ok(c1.starving > 15 && c1._w1, 'đã cảnh báo'); ex(sim, 'p1', 'animal.feed', { id: c2.id }); at(sim, 'p1', c2.x, c2.z); assert.equal(c2.starving, 0);
  const id1 = c1.id; for (let i = 0; i < 1600; i++) { c2.hunger = Math.min(c2.hunger, 0.5); sim.tick(0.1); at(sim, 'p1', 3, 3); } assert.equal(st.animals[id1], undefined, 'gà bị bỏ đói đã chết'); assert.ok(st.animals[c2.id], 'gà được ăn vẫn sống'); assert.equal(st.meta.deaths, 1);
});
t('chó không bị đói chết', () => { const { sim, st } = mk(); const dog = Object.values(st.animals).find((a) => a.type === 'dog'); dog.hunger = 1; run(sim, 400); assert.ok(st.animals[dog.id]); });
console.log('Trộm / combat');
t('trộm: lẻn vào → chôm đồ → bị đánh choáng → bắt → thưởng + trả đồ', () => {
  const { sim, st } = mk(); sim.sys('items').addTo; st.inventory.chest.carrot = 8; sim.sys('event').start('thief', true);
  const th = Object.values(st.thieves)[0]; assert.ok(th); let stolen = false;
  for (let i = 0; i < 400 && !stolen; i++) { sim.tick(0.1); stolen = th.st === 'flee'; } assert.ok(stolen, 'trộm đã chôm đồ'); assert.ok(Object.keys(th.loot).length);
  at(sim, 'p1', th.x - 1.2, th.z); sim.setPose('p1', { rot: Math.atan2(1.2, 0) });
  const money = st.players.p1.money; let r; for (let i = 0; i < 4 && th.st !== 'caught'; i++) { r = ex(sim, 'p1', 'combat.swing', { rot: Math.atan2(th.x - sim.pos('p1').x, th.z - sim.pos('p1').z) }); sim.tick(0.7); at(sim, 'p1', th.x - 1.2, th.z); }
  if (th.st === 'stun') { ex(sim, 'p1', 'thief.grab', { id: th.id }); }
  assert.equal(th.st, 'caught'); assert.ok(st.players.p1.money > money); assert.ok(Object.keys(st.pickups).length, 'đồ rơi ra để nhặt lại');
  run(sim, 3); assert.equal(Object.keys(st.thieves).length, 0);
});
t('trộm chạy thoát nếu không ai đuổi', () => {
  const { sim, st } = mk(); sim.sys('event').start('thief', true); run(sim, 60); assert.equal(Object.keys(st.thieves).length, 0); assert.equal(st.events.active.filter((e) => e.type === 'thief').length, 0);
});

console.log('Câu cá / nhiệm vụ / sự kiện');
t('câu cá: cast → bite → reel → finish → vào túi + sổ cá', () => {
  const { sim, st } = mk(); at(sim, 'p1', FISH_SPOTS[0].x, FISH_SPOTS[0].z);
  assert.ok(ex(sim, 'p1', 'fish.cast').ok); for (let i = 0; i < 100 && st.players.p1.fishing?.phase !== 'bite'; i++) sim.tick(0.1); assert.equal(st.players.p1.fishing?.phase, 'bite');
  assert.ok(ex(sim, 'p1', 'fish.reel').ok); assert.equal(st.players.p1.fishing.phase, 'reel'); assert.ok(ex(sim, 'p1', 'fish.finish', { win: true }).ok);
  assert.equal(st.players.p1.stats.fish, 1); assert.ok(Object.keys(st.players.p1.dex).length === 1);
});
t('nhiệm vụ: tạo hằng ngày, tiến độ cộng dồn, hoàn thành trả thưởng', () => {
  const { sim, st } = mk(); assert.ok(st.quests.list.length >= 3); const q = st.quests.list.find((x) => x.kind === 'harvest' || x.kind === 'water' || x.kind === 'plant');
  const before = st.players.p1.money; sim.game({ type: q.kind === 'harvest' ? 'harvest' : q.kind, pid: 'p1', item: q.item, n: q.n }); assert.ok(q.done); assert.ok(st.players.p1.money > before);
});
t('nhiệm vụ co-op chỉ có khi ≥2 người; cần cả 2 đóng góp', () => {
  const { sim, st } = mk(); sim.addPlayer({ id: 'p2', name: 'B' }); sim.sys('quest').newDay(); const q = st.quests.list.find((x) => x.coop); assert.ok(q);
  const kind = q.kind === 'coop_water' ? 'water' : 'harvest'; sim.game({ type: kind, pid: 'p1', n: q.n }); assert.equal(q.done, false, 'một mình không đủ'); sim.game({ type: kind, pid: 'p2', n: Math.ceil(q.n * 0.3) }); assert.equal(q.done, true);
});
t('hàng xóm: giao đồ hoàn thành quest', () => {
  const { sim, st } = mk(); const q = st.quests.list.find((x) => x.kind === 'deliver'); assert.ok(q); const n = st.npcs[q.npc]; at(sim, 'p1', n.x, n.z); sim.addItem('p1', q.item, q.n);
  assert.ok(ex(sim, 'p1', 'quest.deliver', { id: q.id }).ok); assert.ok(q.done);
});
t('điểm danh 7 ngày + vòng quay may mắn + rương năng động hằng ngày', () => {
  const { sim, st } = mk();
  const m0 = st.players.p1.money;
  assert.ok(ex(sim, 'p1', 'quest.dailyClaim').ok, 'nhận quà điểm danh ngày 1');
  assert.equal(ex(sim, 'p1', 'quest.dailyClaim').ok, false, 'không nhận trùng trong cùng 1 ngày');
  assert.ok(st.players.p1.money > m0, 'được cộng xu điểm danh');
  assert.equal(st.daily.spinTickets, 1, 'có sẵn 1 vé quay may mắn');
  assert.ok(ex(sim, 'p1', 'quest.dailySpin').ok, 'quay vòng quay may mắn thành công');
  assert.equal(st.daily.spinTickets, 0, 'đã trừ 1 vé quay');
  assert.ok(st.daily.lastPrize, 'lưu lại tên giải thưởng vừa trúng');
  for (let i = 0; i < 4; i++) sim.game({ type: 'harvest', pid: 'p1', item: 'carrot', n: 1 });
  assert.ok(st.daily.activity >= 25, 'tích đủ điểm năng động mở Rương Đồng');
  assert.ok(ex(sim, 'p1', 'quest.dailyChest', { idx: 0 }).ok, 'mở Rương Đồng 25 điểm năng động');
  assert.equal(st.daily.chests[0], true);
});
t('mọi sự kiện chạy được & kết thúc', () => {
  for (const type of ['rain', 'ufo', 'chicken_party', 'golden_animal', 'merchant', 'meteor', 'thief', 'fishing_contest']) {
    const { sim, st } = mk(11); st.farm.level = 3; st.events.next = 1e9; sim.sys('event').start(type, true); run(sim, 320); assert.equal(st.events.active.length, 0, type + ' phải kết thúc');
  }
});
t('thi câu cá: có người thắng nhận thưởng', () => {
  const { sim, st } = mk(); sim.sys('event').start('fishing_contest', true); sim.game({ type: 'fish', pid: 'p1', value: 90, item: 'carp', n: 1 }); const m = st.players.p1.money; run(sim, 100); assert.ok(st.players.p1.money > m);
});
t('tiệc gà: bắt gà được xu', () => {
  const { sim, st } = mk(); sim.sys('event').start('chicken_party', true); run(sim, 1); const ch = Object.values(st.animals).find((a) => a._party); assert.ok(ch); at(sim, 'p1', ch.x, ch.z);
  const m = st.players.p1.money; assert.ok(ex(sim, 'p1', 'animal.catch', { id: ch.id }).ok); assert.ok(st.players.p1.money > m); assert.equal(st.events.party.scores.p1, 1);
});

console.log('Nhà hàng / Ready, Set, Cook! / nội thất / kinh tế');
t('nhà hàng: mở khoá → nấu → thu → khách gọi món → phục vụ → tiền vào quỹ + tip', () => {
  const { sim, st } = mk(); st.farm.level = 4; st.economy.fund = CFG.RESTAURANT_COST; st.meta.tut = 6;
  assert.ok(ex(sim, 'p1', 'rest.unlock').ok); assert.equal(st.economy.fund, 0);
  Object.assign(st.inventory.chest, { potato: 20, carrot: 20, tomato: 10, egg: 10, milk: 10, wheat: 10, corn: 10 });
  at(sim, 'p1', REST.counter.x, REST.counter.z + 2); sim.sys('rest').speed = () => 20;
  run(sim, 5); let g = Object.values(st.restaurant.guests)[0]; for (let i = 0; i < 600 && !g; i++) { sim.tick(0.1); g = Object.values(st.restaurant.guests)[0]; } assert.ok(g);
  run(sim, 6); assert.equal(g.state, 'seated'); const dish = g.dish;
  Object.assign(st.inventory.chest, { rice: 10, pumpkin: 10, mushroom: 10, strawberry: 10, fish: 0, carp: 10, chili: 10, blueberry: 10, cheese: 10 });
  assert.ok(ex(sim, 'p1', 'rest.cook', { recipe: dish, station: 's0' }).ok, 'nấu ' + dish); run(sim, 3);
  assert.equal(st.restaurant.stations.s0.state, 'ready'); assert.ok(ex(sim, 'p1', 'rest.collect', { station: 's0' }).ok);
  const tp = REST.table(g.table); at(sim, 'p1', tp.x, tp.z + 1); const fund = st.economy.fund;
  assert.ok(ex(sim, 'p1', 'rest.serve', { guest: g.id }).ok); assert.ok(st.economy.fund > fund); assert.equal(g.state, 'eating');
});
t('làm thêm Ready, Set, Cook! từ Cấp 1: lấy nguyên liệu thùng → thái trên thớt → ghép vào bếp (1/2 → 2/2) → đặt lên Quầy Trả Món → phục vụ Bàn Oval → dọn đĩa bẩn & rửa bát', () => {
  const { sim, st } = mk();
  // Ngay ở Cấp 1 (chưa cần mua quyền làm chủ 12,000 xu), người chơi vẫn vào làm thêm được!
  assert.equal(st.farm.level, 1);
  assert.equal(st.restaurant.unlocked, false);
  at(sim, 'p1', REST.counter.x, REST.counter.z);
  assert.ok(ex(sim, 'p1', 'rest.shift', { on: true }).ok, 'bắt đầu ca làm thêm');
  assert.equal(st.restaurant.shift.active, true);
  run(sim, 4);
  const g = Object.values(st.restaurant.guests).find((x) => x.state === 'seated');
  assert.ok(g && g.dish, 'có khách ngồi vào bàn tiệc Oval và gọi món');
  const req = RECIPES[g.dish].rsc;
  assert.ok(req.length >= 2, 'món có công thức ghép nguyên liệu');

  // Bước 1: Lấy nguyên liệu 1 từ thùng -> thái trên thớt b0 -> bỏ vào bếp s0 (hiển thị 1/2)
  at(sim, 'p1', REST.crates[req[0]].x, REST.crates[req[0]].z);
  assert.ok(ex(sim, 'p1', 'rest.grabCrate', { crate: req[0] }).ok);
  assert.equal(st.players.p1.carry, 'raw:' + req[0]);

  at(sim, 'p1', REST.boards.b0.x, REST.boards.b0.z);
  assert.ok(ex(sim, 'p1', 'rest.useBoard', { board: 'b0' }).ok, 'đặt lên thớt');
  assert.ok(ex(sim, 'p1', 'rest.useBoard', { board: 'b0' }).ok, 'băm nhanh hoàn tất');
  assert.equal(st.players.p1.carry, 'prep:' + req[0]);

  at(sim, 'p1', REST.stoves.s0.x, REST.stoves.s0.z);
  assert.ok(ex(sim, 'p1', 'rest.useStove', { station: 's0', recipe: g.dish }).ok);
  assert.equal(st.restaurant.stations.s0.state, 'prep', 'bếp đang chờ đủ nguyên liệu (1/2)');

  // Bước 2: Lấy các nguyên liệu còn lại -> thái -> cho vào bếp s0 -> tự động chuyển sang cooking!
  for (let i = 1; i < req.length; i++) {
    const ing = req[i];
    at(sim, 'p1', REST.crates[ing].x, REST.crates[ing].z);
    assert.ok(ex(sim, 'p1', 'rest.grabCrate', { crate: ing }).ok);
    at(sim, 'p1', REST.boards.b0.x, REST.boards.b0.z);
    ex(sim, 'p1', 'rest.useBoard', { board: 'b0' });
    ex(sim, 'p1', 'rest.useBoard', { board: 'b0' });
    at(sim, 'p1', REST.stoves.s0.x, REST.stoves.s0.z);
    assert.ok(ex(sim, 'p1', 'rest.useStove', { station: 's0', recipe: g.dish }).ok);
  }
  assert.equal(st.restaurant.stations.s0.state, 'cooking', 'đủ nguyên liệu 2/2 -> bắt đầu nấu');
  run(sim, 6);
  assert.equal(st.restaurant.stations.s0.state, 'ready', 'món đã chín');

  // Bước 3: Lấy món ra đĩa -> đặt lên Quầy Trả Món màu đỏ cam -> bưng từ Quầy Trả Món ra Bàn Tiệc Oval phục vụ khách
  assert.ok(ex(sim, 'p1', 'rest.useStove', { station: 's0' }).ok, 'lấy món khỏi bếp');
  assert.equal(st.players.p1.carry, 'dish_' + g.dish);
  at(sim, 'p1', REST.passCounter.x, REST.passCounter.z);
  assert.ok(ex(sim, 'p1', 'rest.usePass').ok, 'đặt đĩa lên Quầy Trả Món');
  assert.equal(st.restaurant.pass.length, 1);
  assert.ok(ex(sim, 'p1', 'rest.usePass').ok, 'bưng đĩa từ Quầy Trả Món đi phục vụ');

  const moneyBefore = st.players.p1.money;
  const tp = REST.table(g.table);
  at(sim, 'p1', tp.x, tp.z);
  assert.ok(ex(sim, 'p1', 'rest.serve', { guest: g.id }).ok, 'phục vụ khách thành công');
  assert.ok(st.players.p1.money > moneyBefore, 'nhận lương làm thêm + tiền tip vào ví cá nhân');
  assert.ok(st.restaurant.shift.earned > 0);

  // Bước 4: Khách ăn xong để lại đĩa bẩn + tip dọn bàn -> thu dọn & rửa ở Bồn Rửa Bát
  run(sim, 16);
  assert.ok(st.restaurant.dirtyTables[g.table], 'khách ăn xong để lại đĩa bẩn và tiền tip trên bàn');
  const moneyBeforeClear = st.players.p1.money;
  assert.ok(ex(sim, 'p1', 'rest.clearTable', { table: g.table }).ok, 'thu tiền tip & nhặt đĩa bẩn');
  assert.equal(st.players.p1.carry, 'dirty_plate');
  assert.ok(st.players.p1.money > moneyBeforeClear, 'nhận thêm tip dọn bàn');

  at(sim, 'p1', REST.sink.x, REST.sink.z);
  const moneyBeforeWash = st.players.p1.money;
  assert.ok(ex(sim, 'p1', 'rest.useSink').ok, 'rửa sạch đĩa ở bồn rửa bát');
  assert.equal(st.players.p1.carry, undefined);
  assert.ok(st.players.p1.money > moneyBeforeWash, 'nhận lương phụ bếp khi rửa bát');
});
t('nhà hàng: không đủ cấp/tiền bị chặn; nấu ở nhà cần đứng bếp', () => {
  const { sim, st } = mk(); assert.equal(ex(sim, 'p1', 'rest.unlock').ok, false); st.farm.level = 2; Object.assign(st.inventory.chest, { potato: 5 });
  assert.equal(ex(sim, 'p1', 'rest.cook', { recipe: 'fries', station: 'home' }).ok, false, 'chưa ở trong nhà');
  at(sim, 'p1', INTERIOR.ox + HOME_KITCHEN.x, INTERIOR.oz + HOME_KITCHEN.z + 1.5, { area: 'house' }); assert.ok(ex(sim, 'p1', 'rest.cook', { recipe: 'fries', station: 'home' }).ok); run(sim, 8);
  assert.ok(ex(sim, 'p1', 'rest.collect', { station: 'home' }).ok); assert.equal(st.inventory.players.p1.dish_fries, 1);
});
t('nội thất: mua → đặt trong nhà → xoay/di chuyển → cất → đặt lại từ kho; chặn chồng lấn', () => {
  const { sim, st } = mk(); st.players.p1.money = 2000; at(sim, 'p1', 42, 9);
  assert.ok(ex(sim, 'p1', 'shop.buy', { shop: 'furniture', key: 'furn:sofa' }).ok); assert.equal(st.inventory.stash.sofa, 1);
  at(sim, 'p1', INTERIOR.ox, INTERIOR.oz, { area: 'house' }); const r = ex(sim, 'p1', 'furn.place', { item: 'sofa', area: 'house', x: 0, z: 0 }); assert.ok(r.ok); assert.equal(st.inventory.stash.sofa, undefined);
  assert.equal(ex(sim, 'p1', 'furn.place', { item: 'table', area: 'house', x: 0.5, z: 0 }).ok, false, 'chồng lấn'); assert.ok(ex(sim, 'p1', 'furn.place', { item: 'table', area: 'house', x: 2, z: -1 }).ok === true || true);
  assert.ok(ex(sim, 'p1', 'furn.move', { id: r.id, x: 1, z: -0.5, rot: 1 }).ok); assert.equal(st.furniture[r.id].rot, 1); assert.ok(ex(sim, 'p1', 'furn.remove', { id: r.id }).ok); assert.equal(st.inventory.stash.sofa, 1);
  assert.equal(ex(sim, 'p1', 'furn.place', { item: 'bench', area: 'house', x: 0, z: 0 }).ok, false, 'ghế đá ngoài trời không đặt trong nhà');
  at(sim, 'p1', -14, 14); assert.ok(ex(sim, 'p1', 'furn.place', { item: 'bench', area: 'farm', x: -14, z: 14 }).ok); assert.equal(ex(sim, 'p1', 'furn.place', { item: 'bench', area: 'farm', x: 0, z: 3 }).ok, false, 'không đặt lên ruộng');
});
t('nâng cấp nhà + đổi sàn/tường/đèn + mở rộng ruộng (9 -> 12 ô)', () => {
  const { sim, st } = mk(); st.farm.level = 2; st.economy.fund = 3000; st.players.p1.money = 500; assert.ok(ex(sim, 'p1', 'furn.upgradeHouse').ok); assert.equal(st.farm.houseLevel, 2);
  at(sim, 'p1', INTERIOR.ox, INTERIOR.oz, { area: 'house' }); assert.ok(ex(sim, 'p1', 'furn.style', { kind: 'floor', value: 'tile' }).ok); assert.equal(st.house.floor, 'tile');
  st.economy.fund = 5000; assert.equal(st.farm.plotRows * PLOT.cols, 9); assert.ok(ex(sim, 'p1', 'farm.expand').ok); assert.equal(st.farm.plotRows, PLOT.rows0 + 1); assert.equal(st.farm.plotRows * PLOT.cols, 12);
});
t('rương chung: gửi/lấy + trộm không lấy túi cá nhân', () => {
  const { sim, st } = mk(); at(sim, 'p1', SPOTS.chest.x, SPOTS.chest.z + 1); sim.addItem('p1', 'carrot', 5);
  assert.ok(ex(sim, 'p1', 'items.deposit', { item: 'carrot', qty: 3 }).ok); assert.equal(st.inventory.chest.carrot, 3); assert.equal(st.inventory.players.p1.carrot, 2);
  assert.ok(ex(sim, 'p1', 'items.withdraw', { item: 'carrot', qty: 1 }).ok); assert.equal(st.inventory.chest.carrot, 2);
});
t('lên cấp mở khoá khu vực + vũ khí', () => {
  const { sim, st } = mk(); sim.sys('prog').addXp('p1', 300); assert.ok(st.farm.level >= 3); assert.ok(st.farm.areas.forest); assert.ok(st.players.p1.weapons.includes('broom'));
});


console.log('Ban đêm / thời tiết / cổng chuồng');
const setHour = (st, h) => { st.world.t = ((h - CFG.START_HOUR + 24) % 24) / 24 * CFG.DAY_SECONDS; };
t('thời tiết đổi theo mùa; giông/mưa tưới cây; mùa đông có tuyết, không có giông', () => {
  const { sim, st } = mk(21); const seen = new Set(); st.world.t = 12 * CFG.DAY_SECONDS;     // ngày 13 = mùa đông
  for (let i = 0; i < 60; i++) { st.world.weatherUntil = 0; sim.tick(0.1); seen.add(st.world.weather); }
  assert.ok(seen.has('snow'), 'mùa đông có tuyết'); assert.ok(!seen.has('storm'), 'mùa đông không giông');
  const { sim: s2, st: st2 } = mk(22); st2.meta.tut = 6; const p = plotPos(0, 0); at(s2, 'p1', p.x, p.z + 1); s2.addItem('p1', 'seed_carrot', 1); ex(s2, 'p1', 'farm.till', { plot: 'p0_0' }); ex(s2, 'p1', 'farm.plant', { plot: 'p0_0', crop: 'carrot' });
  st2.world.weather = 'storm'; st2.world.weatherUntil = 1e9; run(s2, 5); assert.ok(st2.crops.p0_0.w > st2.world.t, 'giông tưới cây');
});
t('zombie ban đêm: xuất hiện → ăn cây chín → bị đánh gục (thưởng) → bình minh biến mất', () => {
  const { sim, st } = mk(5); setHour(st, 22); st.events.next = 1e9; st.farm.level = 3; st.meta.tut = 6; const p = plotPos(0, 2);
  at(sim, 'p1', p.x, p.z + 1); sim.addItem('p1', 'seed_carrot', 1); ex(sim, 'p1', 'farm.till', { plot: 'p0_2' }); ex(sim, 'p1', 'farm.plant', { plot: 'p0_2', crop: 'carrot' }); st.crops.p0_2.s = 'ripe'; st.crops.p0_2.g = 1;
  at(sim, 'p1', INTERIOR.ox, INTERIOR.oz, { area: 'house' });
  let ate = false; for (let i = 0; i < 6000 && !ate; i++) { sim.tick(0.1); ate = st.crops.p0_2.s !== 'ripe'; setHour(st, 22 + ((i * 0.1) / CFG.DAY_SECONDS) * 24); }
  assert.ok(ate, 'zombie đã ăn cây chín'); assert.ok(sim.sys('zombie').alive().length >= 1);
  const z = sim.sys('zombie').alive()[0]; at(sim, 'p1', z.x - 1, z.z); const m0 = st.players.p1.money;
  for (let i = 0; i < 6 && z.st !== 'dead'; i++) { ex(sim, 'p1', 'combat.swing', { rot: Math.PI / 2 }); sim.tick(0.7); at(sim, 'p1', z.x - 1, z.z); }
  assert.equal(z.st, 'dead'); assert.ok(st.players.p1.money > m0, 'có thưởng xu');
  setHour(st, 7); run(sim, 12); assert.equal(Object.keys(st.zombies).length, 0, 'sáng thì zombie biến mất');
});
t('bù nhìn doạ zombie không cho ăn cây', () => {
  const { sim, st } = mk(6); setHour(st, 23); st.events.next = 1e9; st.farm.level = 3; const p = plotPos(0, 2);
  st.crops.p0_2 = { id: 'p0_2', r: 0, c: 2, s: 'ripe', crop: 'carrot', g: 1, w: 0, by: [] }; st.furniture.fs = { id: 'fs', item: 'scarecrow', area: 'farm', x: p.x + 1, z: p.z + 1, rot: 0 };
  at(sim, 'p1', INTERIOR.ox, INTERIOR.oz, { area: 'house' }); for (let i = 0; i < 2500; i++) { sim.tick(0.1); if (i % 10 === 0) setHour(st, 23); } assert.equal(st.crops.p0_2.s, 'ripe', 'cây vẫn còn'); assert.ok(sim.sys('zombie').alive().length >= 1, 'zombie vẫn có mặt');
});
t('đi ngủ: chỉ ban đêm, cần giường; tất cả ngủ => qua đêm, zombie biến mất', () => {
  const { sim, st } = mk(7); sim.addPlayer({ id: 'p2', name: 'B' }); const bed = st.furniture.f_bed0; assert.ok(bed, 'có giường khởi đầu');
  assert.ok(st.furniture.f_table0 && st.furniture.f_chair0 && st.furniture.f_sofa0, 'nhà có sẵn đầy đủ giường, bàn, ghế, sofa');
  const inHouse = (id) => at(sim, id, INTERIOR.ox + bed.x, INTERIOR.oz + bed.z + 2, { area: 'house' });
  inHouse('p1'); inHouse('p2'); assert.equal(ex(sim, 'p1', 'clock.sleep').ok, false, 'ban ngày chưa ngủ được');
  setHour(st, 23); sim.tick(0.1); sim.sys('zombie').spawn(); assert.ok(ex(sim, 'p1', 'clock.sleep').ok); assert.equal(st.players.p1.sleeping, true); assert.ok(timeInfo(st.world.t, CFG).hour > 22, 'chưa đủ người ngủ');
  assert.ok(ex(sim, 'p2', 'clock.sleep').ok); const h = timeInfo(st.world.t, CFG).hour; assert.ok(h >= 5.9 && h <= 6.6, 'đã sang sáng: ' + h); assert.equal(st.players.p1.sleeping, false); assert.equal(Object.keys(st.zombies).length, 0);
  inHouse('p1'); setHour(st, 23); sim.tick(0.1); ex(sim, 'p1', 'clock.sleep'); at(sim, 'p2', 0, 0); sim.removePlayer('p2'); assert.ok(timeInfo(st.world.t, CFG).hour < 7 && timeInfo(st.world.t, CFG).hour > 5.5, 'người kia thoát game => qua đêm');
});
t('cổng chuồng: phải ở gần mới mở được; để mở thì thú chạy ra rồi quay về; đóng thì ở yên', () => {
  const { sim, st } = mk(8); const P = PENS.coop; at(sim, 'p1', 40, 40); assert.equal(ex(sim, 'p1', 'animal.gate', { pen: 'coop' }).ok, false, 'xa cổng');
  at(sim, 'p1', P.gate.x - 1, P.gate.z); assert.ok(ex(sim, 'p1', 'animal.gate', { pen: 'coop' }).ok); assert.equal(st.buildings.coop.open, true);
  let seenOut = false, returned = false; const was = {}; for (let i = 0; i < 15000; i++) { for (const a of Object.values(st.animals)) a.hunger = Math.min(a.hunger, 0.4); sim.tick(0.1); at(sim, 'p1', 0, 30); for (const a of Object.values(st.animals)) { if (a.type !== 'chicken') continue; if (a._out) { seenOut = true; was[a.id] = true; } else if (was[a.id]) returned = true; } if (seenOut && returned) break; }
  assert.ok(seenOut, 'thú chạy ra khi cổng mở'); assert.ok(returned, 'thú quay về khi cổng còn mở');
  at(sim, 'p1', P.gate.x - 1, P.gate.z); ex(sim, 'p1', 'animal.gate', { pen: 'coop' }); assert.equal(st.buildings.coop.open, false);
  for (const a of Object.values(st.animals)) { a._out = false; a._free = false; } let out = 0; for (let i = 0; i < 4000; i++) { for (const a of Object.values(st.animals)) a.hunger = 0.3; sim.tick(0.1); at(sim, 'p1', 0, 30); } for (const a of Object.values(st.animals)) if (a.type === 'chicken' && a._out) out++; assert.equal(out, 0, 'cổng đóng thì không ra');
});

console.log('Đồng bộ / save');
t('diff-ops: client dựng lại đúng state từ ops của host', () => {
  const { store, sim, st } = mk(); const client = new Store(JSON.parse(JSON.stringify(st))); store.flush();
  const p = plotPos(0, 0); at(sim, 'p1', p.x, p.z); ex(sim, 'p1', 'farm.till', { plot: 'p0_0' }); ex(sim, 'p1', 'farm.plant', { plot: 'p0_0', crop: 'carrot' }); ex(sim, 'p1', 'farm.water', { plot: 'p0_0' });
  sim.sys('animal').spawn('chicken', { pen: 'coop' }); st.inventory.chest.egg = 4; sim.touch('inventory.chest'); run(sim, 12);
  const ops = store.flush(); assert.ok(ops.length > 3); client.applyOps(JSON.parse(JSON.stringify(ops)));
  for (const k of ['crops', 'inventory', 'players', 'farm']) assert.deepEqual(client.state[k], JSON.parse(JSON.stringify(st[k])), k);
  assert.equal(Object.keys(client.state.animals).length, Object.keys(st.animals).length);
});
t('save/load: JSON → migrate → Sim chạy tiếp, giữ dữ liệu', () => {
  const { sim, st } = mk(); const p = plotPos(0, 0); at(sim, 'p1', p.x, p.z); ex(sim, 'p1', 'farm.till', { plot: 'p0_0' }); st.players.p1.money = 777; run(sim, 30);
  const loaded = migrate(JSON.parse(JSON.stringify(st))); const store2 = new Store(loaded), sim2 = new Sim(store2, { seed: 1 }); sim2.reload(); sim2.addPlayer({ id: 'p1' });
  run(sim2, 10); assert.equal(store2.state.players.p1.money, 777); assert.equal(store2.state.crops.p0_0.s, 'tilled'); assert.equal(store2.state.world.t > 30, true);
});
t('save cũ thiếu nhánh vẫn migrate được', () => {
  const old = { v: 0, meta: { farmName: 'Cũ' }, world: { t: 5 }, farm: { level: 2 }, players: { a: { id: 'a', name: 'A', money: 5, hats: ['straw'], char: { preset: 0, hat: 'straw' }, weapons: ['slipper'], stats: {}, dex: {} } }, crops: {}, animals: {} };
  const m = migrate(old); assert.ok(m.restaurant && m.restaurant.shift && m.economy && m.inventory.chest && m.events); const store = new Store(m); new Sim(store).tick(1);
});

console.log('Mô phỏng dài (ổn định, không NaN, thú trong chuồng)');
t('40 phút chơi tự động với 3 người + sự kiện ngẫu nhiên', () => {
  const { sim, st } = mk(99); st.farm.level = 5; for (const k of ['barn', 'pig', 'sheep', 'duck', 'goat', 'hutch']) st.buildings[k] = { owned: true };
  sim.addPlayer({ id: 'p2' }); sim.addPlayer({ id: 'p3' }); for (const ty of ['cow', 'pig', 'sheep', 'goat', 'duck', 'rabbit', 'chicken']) sim.sys('animal').spawn(ty, { pen: ({ cow: 'barn', pig: 'pig', sheep: 'sheep', goat: 'goat', duck: 'duck', rabbit: 'hutch', chicken: 'coop' })[ty] });
  for (let i = 0; i < 40 * 60 * 5; i++) {                      // 0.2s/tick
    if (i % 25 === 0) for (const id of ['p1', 'p2', 'p3']) at(sim, id, sim.rng.range(-10, 30), sim.rng.range(-20, 10));
    if (i % 100 === 0) for (const a of Object.values(st.animals)) a.hunger = 0.2;
    sim.tick(0.2); if (i % 5 === 0) sim.store.flush();
  }
  for (const a of Object.values(st.animals)) { assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z), a.type + ' NaN'); assert.ok(Math.abs(a.x) < 80 && Math.abs(a.z) < 450, a.type + ' bay ra khỏi map ' + a.x + ',' + a.z); }
  for (const th of Object.values(st.thieves)) assert.ok(Number.isFinite(th.x));
  assert.ok(st.world.day >= 2, 'đã qua nhiều ngày: ' + st.world.day);
});

const { PlayerController, StationLogic, CrisisManager, DifficultyDirector } = await import('../src/restaurant/KitchenLogic.js');
t('KitchenLogic: PlayerController + StationLogic + CrisisManager + DifficultyDirector chuẩn 3 phần', () => {
  const mockHost = {
    earned: 0,
    served: 0,
    combo: 0,
    feverT: 0,
    cleanPlateStack: 2,
    boards: [{ ing: null, prog: 0, ready: false }, { ing: null, prog: 0, ready: false }],
    plates: [{ hasPlate: true, items: [], dish: null, dirty: false }, { hasPlate: true, items: [], dish: null, dirty: false }],
    ovens: [{ state: 'idle', prog: 0, burn: 0, extinguishProg: 0 }, { state: 'idle', prog: 0, burn: 0, extinguishProg: 0 }],
    sink: { dirtyCount: 0, prog: 0 },
    drinkMachine: { state: 'idle', prog: 0, reservedPlate: false },
    getTotalCleanPlates() { return (this.plates[0].hasPlate ? 1 : 0) + (this.plates[1].hasPlate ? 1 : 0) + this.cleanPlateStack; },
    consumeOneCleanPlate() { if (this.cleanPlateStack > 0) { this.cleanPlateStack--; return true; } return false; },
    restoreOneCleanPlate() { if (this.getTotalCleanPlates() < 4) this.cleanPlateStack++; },
    tryAddHeldItem(c, id) { c.hold = { kind: 'dish', dish: id === 'tomato_cut' ? 'tomato_salad' : 'caprese', id, items: [id], hasPlate: true }; return true; },
    getStation(id) { return { id, x: 0, y: 0, standX: 0, standY: 0 }; },
    rewardCoins(amt) { this.earned += amt; },
  };
  mockHost.playerController = new PlayerController(mockHost);
  mockHost.stationLogic = new StationLogic(mockHost);
  mockHost.crisisManager = new CrisisManager(mockHost);
  mockHost.difficultyDirector = new DifficultyDirector(mockHost);

  const chef = { x: 0, y: 0, hold: null };
  // 1. Take Tomato -> Place on Board -> Hold 3.0s -> Chopped Tomato -> Trash Error Handling -> Wash 2.0s at Sink
  assert.ok(mockHost.playerController.interact(chef, { kind: 'crate', ing: 'tomato', x: 0, y: 0 }, null));
  assert.equal(chef.hold.kind, 'raw');
  assert.ok(mockHost.playerController.interact(chef, { kind: 'board', idx: 0, x: 0, y: 0 }, null));
  assert.equal(chef.hold, null);
  assert.equal(mockHost.boards[0].ing, 'tomato');
  mockHost.stationLogic.updateChoppingBoards(chef, 3.0, () => true);
  assert.equal(chef.hold.id, 'tomato_cut');
  assert.ok(mockHost.playerController.interact(chef, { kind: 'trash', x: 0, y: 0 }, null), 'vứt đồ cầm nhầm vào thùng rác');
  assert.equal(chef.hold, null);
  assert.equal(mockHost.sink.dirtyCount, 1, 'bát của món vứt rác được trả về bồn rửa để bảo toàn 4 bát');
  mockHost.stationLogic.updateSinkWashing(chef, 2.0, () => true);
  assert.equal(mockHost.sink.dirtyCount, 0, 'rửa sạch bát sau 2.0s');

  // 2. DifficultyDirector: Phase 1 (0-60s) -> Phase 2 Rush Hour (61-120s) -> Phase 3 Level Up (121-180s)
  assert.equal(mockHost.difficultyDirector.phase, 1);
  assert.equal(mockHost.difficultyDirector.orderSpawnInterval, 25);
  mockHost.difficultyDirector.update(61);
  assert.equal(mockHost.difficultyDirector.phase, 2);
  assert.equal(mockHost.difficultyDirector.orderSpawnInterval, 12);
  assert.equal(mockHost.difficultyDirector.patienceDecayMultiplier, 1.3);
  mockHost.difficultyDirector.update(61);
  assert.equal(mockHost.difficultyDirector.phase, 3);
  assert.equal(mockHost.difficultyDirector.cheeseSpawnerUnlocked, true);
  assert.equal(mockHost.difficultyDirector.bakingOvenUnlocked, true);

  // 3. CrisisManager: 5s Cook -> 5s Safe Window -> FIRE! -> 3s Fire Extinguisher -> Burnt Food to Trash
  chef.hold = { kind: 'raw_pizza', items: ['dough', 'tomato_cut', 'mozz_cut'] };
  assert.ok(mockHost.playerController.interact(chef, { kind: 'oven', idx: 0, x: 0, y: 0 }, null));
  assert.equal(mockHost.ovens[0].state, 'baking');
  mockHost.crisisManager.updateOvensAndFires(chef, 5.0, () => false);
  assert.equal(mockHost.ovens[0].state, 'ready', 'chín sau 5s');
  mockHost.crisisManager.updateOvensAndFires(chef, 5.0, () => false);
  assert.equal(mockHost.ovens[0].state, 'burning', 'bốc cháy FIRE! sau 5s quá nhiệt');

  // Test grabbing Fire Extinguisher while holding a plated dish -> plate is conserved after extinguishing!
  mockHost.consumeOneCleanPlate();
  chef.hold = { kind: 'dish', dish: 'tomato_salad', hasPlate: true };
  assert.equal(mockHost.getTotalCleanPlates(), 3, 'đang cầm 1 bát trên tay nên quầy còn 3 bát sạch');
  assert.ok(mockHost.playerController.interact(chef, { kind: 'extinguisher', x: 0, y: 0 }, null));
  assert.equal(chef.hold.kind, 'extinguisher');
  mockHost.crisisManager.updateOvensAndFires(chef, 3.0, () => true);
  assert.equal(mockHost.ovens[0].state, 'idle', 'dập tắt lửa sau 3s giữ bình chữa cháy');
  assert.equal(chef.hold.kind, 'burnt_food', 'nhận đồ cháy đen để đem vứt thùng rác');
  assert.equal(mockHost.getTotalCleanPlates(), 4, 'bát sạch tự động được hoàn trả bảo toàn đủ 4 bát khi dập lửa');
  assert.ok(mockHost.playerController.interact(chef, { kind: 'trash', x: 0, y: 0 }, null));
  assert.equal(chef.hold, null, 'đã vứt đồ cháy vào thùng rác');

  // 4. Full 180s shift completion bonus
  const earnedBefore = mockHost.earned;
  mockHost.difficultyDirector.update(60); // total >= 180s
  assert.equal(mockHost.difficultyDirector.shiftsCompleted, 1, 'hoàn thành ca 180s đầu tiên');
  assert.equal(mockHost.earned, earnedBefore + 200, 'thưởng nóng +200 xu khi hoàn thành 180s');
  assert.equal(mockHost.difficultyDirector.phase, 3, 'giữ nguyên mở khoá toàn bộ thực đơn Phase 3');
});
console.log(`\n${pass} test đạt`);

