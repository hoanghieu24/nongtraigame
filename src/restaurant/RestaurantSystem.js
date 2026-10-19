import { CFG } from '../core/Config.js';
import { RECIPES, RECIPE_LIST, RSC_CRATES, RSC_MENU } from '../data/recipes.js';
import { CUSTOMERS, CUSTOMER_LIST } from '../data/npcs.js';
import { RESTAURANT_UPGRADES } from '../data/furniture.js';
import { REST, HOME_KITCHEN, INTERIOR, inRest } from '../data/layout.js';
import { uid } from '../core/util.js';
import { fail, ok } from '../core/result.js';
import { canCook, takeKey } from '../inventory/Inventory.js';

export const KITCHEN_SPEED = [1, 1.4, 1.9];
export const stationCount = (k, shiftActive = false) => (shiftActive ? 3 : 1 + (k >= 2 ? 1 : 0) + (k >= 3 ? 1 : 0));
export const upgradeInfo = (r, what) => {
  const u = RESTAURANT_UPGRADES[what], cur = what === 'tables' ? r.tables / 2 : r[what], max = what === 'tables' ? 4 : u.max;
  return { cur, max, cost: cur >= max ? null : u.cost[cur - 1], u };
};

// Kiểm tra multiset A có nằm trong multiset B không
const isSubMultiset = (added, req) => {
  const counts = {};
  for (const x of req) counts[x] = (counts[x] || 0) + 1;
  for (const x of added) {
    if (!counts[x]) return false;
    counts[x]--;
  }
  return true;
};

// Danh sách nguyên liệu còn thiếu để hiển thị dạng "1/2" như Ready, Set, Cook!
export function rscProgress(s) {
  if (!s || !s.recipe || !RECIPES[s.recipe]) return [];
  const req = s.req || RECIPES[s.recipe].rsc || [];
  const added = s.added || [];
  const needMap = {}, haveMap = {};
  for (const k of req) needMap[k] = (needMap[k] || 0) + 1;
  for (const k of added) haveMap[k] = (haveMap[k] || 0) + 1;
  return Object.keys(needMap).map((k) => ({
    ing: k,
    icon: RSC_CRATES[k]?.icon || '🥗',
    have: Math.min(needMap[k], haveMap[k] || 0),
    need: needMap[k],
  }));
}

// Quán Ăn Làng & Làm Thêm (cơ chế Ready, Set, Cook! trên Facebook):
// - Bất kỳ lúc nào từ Cấp 1, người chơi có thể vào Quán Ăn ở Làng để Làm Thêm (shift):
//   Lấy nguyên liệu từ 6 thùng -> Thái trên 2 bàn thớt -> Ghép nguyên liệu vào 3 bếp chảo/nồi (hiển thị 1/2, 2/2) -> Nấu chín (coi chừng cháy!) -> Đặt lên Quầy Trả Món hoặc bưng thẳng ra Bàn Tiệc Oval phục vụ khách -> Thu tiền lương + tip & rửa đĩa bẩn ở Bồn Rửa Bát!
// - Khi đạt Cấp 4 và mua quyền Làm Chủ Nhà Hàng (rest.unlock), doanh thu tự động đổ về Quỹ Chung và Bếp Trưởng Bo hỗ trợ nấu tự động.
export class RestaurantSystem {
  constructor(sim) {
    this.sim = sim; this.id = 'rest'; this.acc = 0;
    this.cmds = {
      unlock:     (p) => this.unlock(p),
      upgrade:    (p, c) => this.upgrade(p, c),
      cook:       (p, c) => this.cook(p, c),
      collect:    (p, c) => this.collect(p, c),
      serve:      (p, c) => this.serve(p, c),
      auto:       (p, c) => this.auto(p, c),
      shift:      (p, c) => this.shift(p, c),
      grabCrate:  (p, c) => this.grabCrate(p, c),
      useBoard:   (p, c) => this.useBoard(p, c),
      useStove:   (p, c) => this.useStove(p, c),
      usePass:    (p, c) => this.usePass(p, c),
      clearTable: (p, c) => this.clearTable(p, c),
      useSink:    (p, c) => this.useSink(p, c),
      useTrash:   (p, c) => this.useTrash(p, c),
      quickStep:  (p, c) => this.quickStep(p, c),
    };
  }

  isOpen(r = this.sim.st.restaurant) {
    return !!(r.unlocked || r.shift?.active);
  }

  ensureShift(pid) {
    const r = this.sim.st.restaurant;
    if (!r.shift) r.shift = { active: false, by: '', startedAt: 0, served: 0, earned: 0, combo: 0, lastServeAt: 0 };
    if (!r.shift.active) this.shift(pid, { on: true, silent: false });
  }

  shift(pid, { on, silent = false } = {}) {
    const { sim } = this, st = sim.st, r = st.restaurant;
    r.shift ||= { active: false, by: '', startedAt: 0, served: 0, earned: 0, combo: 0, lastServeAt: 0 };
    const next = on !== undefined ? !!on : !r.shift.active;
    if (next) {
      const wasActive = r.shift.active;
      r.shift.active = true;
      r.shift.by = pid;
      if (!wasActive) {
        r.shift.startedAt = st.world.t;
        r.shift.combo = 0;
        r.shift.lastServeAt = st.world.t;
      }
      // Đảm bảo có khách vào bàn ngay khi bắt đầu ca làm thêm Ready, Set, Cook!
      const guestCount = Object.keys(r.guests).length;
      if (guestCount === 0) {
        this.spawnGuest(true);
        this.spawnGuest(false);
      } else if (guestCount === 1) {
        this.spawnGuest(false);
      }
      r.nextGuest = Math.min(r.nextGuest || st.world.t + 6, st.world.t + 6);
      sim.touch('restaurant');
      if (!silent && !wasActive) {
        sim.fx({
          k: 'banner',
          text: '👨‍🍳 CA LÀM THÊM: READY, SET, COOK!',
          sub: 'Lấy nguyên liệu ➔ Thái trên thớt ➔ Nấu trên bếp ➔ Phục vụ bàn khách!',
          tone: 'good',
        });
        sim.fx({ k: 'sfx', name: 'bell', x: REST.x, z: REST.z });
      }
      return ok({ active: true });
    } else {
      r.shift.active = false;
      sim.touch('restaurant');
      if (!silent) {
        sim.toast(
          pid,
          `👏 Nghỉ ca làm thêm! Đã phục vụ ${r.shift.served || 0} đĩa • Tổng lương & tip: +${r.shift.earned || 0} 🪙`,
          'good'
        );
      }
      return ok({ active: false });
    }
  }

  unlock(pid) {
    const { sim } = this, st = sim.st, r = st.restaurant;
    if (r.unlocked) return fail('Nhà hàng đã mở rồi!');
    if (st.farm.level < CFG.RESTAURANT_LEVEL) return fail(`Làm chủ Nhà Hàng mở ở Cấp nông trại ${CFG.RESTAURANT_LEVEL} (Bạn vẫn có thể Làm Thêm ngay từ Cấp 1!)`);
    const eco = sim.sys('economy'); if (!eco.pay(pid, CFG.RESTAURANT_COST, 'fund')) return eco.noMoney(CFG.RESTAURANT_COST, 'fund');
    r.unlocked = true; r.nextGuest = st.world.t + 4; sim.touch('restaurant');
    sim.fx({ k: 'banner', text: '🍽️ CHÍNH THỨC LÀM CHỦ NHÀ HÀNG!', sub: 'Doanh thu tự động về Quỹ Chung & mở khóa Bếp Trưởng Bo!', tone: 'level' }); sim.fx({ k: 'confetti' }); sim.fx({ k: 'sfx', name: 'levelup' });
    sim.sys('prog').addXp(pid, 100); sim.game({ type: 'rest_unlock', pid }); return ok();
  }

  upgrade(pid, { what }) {
    const { sim } = this, r = sim.st.restaurant; if (!r.unlocked) return fail('Mua quyền Làm chủ Nhà hàng trước đã (hoặc vào Làm thêm để kiếm xu!)');
    if (!RESTAURANT_UPGRADES[what]) return fail('Không hợp lệ');
    const info = upgradeInfo(r, what); if (info.cost == null) return fail('Đã tối đa!');
    const eco = sim.sys('economy'); if (!eco.pay(pid, info.cost, 'fund')) return eco.noMoney(info.cost, 'fund');
    if (what === 'tables') r.tables += 2; else r[what]++;
    sim.touch('restaurant'); sim.fx({ k: 'confetti' }); sim.fx({ k: 'sfx', name: 'levelup' });
    sim.toast(undefined, `${info.u.icon} ${info.u.name} đã nâng cấp!`, 'good'); sim.sys('prog').addXp(pid, 20); return ok();
  }

  auto(pid, { on }) { this.sim.st.restaurant.auto = !!on; this.sim.touch('restaurant'); return ok(); }

  speed(key) { return key === 'home' ? 1 : KITCHEN_SPEED[(this.sim.st.restaurant.kitchen || 1) - 1] || 1; }

  // ---------------- Cơ chế Ready, Set, Cook!: Thùng Nguyên Liệu -> Thớt -> Bếp -> Quầy Trả Món -> Bàn Khách -> Rửa Bát ----------------
  grabCrate(pid, { crate }) {
    const { sim } = this, st = sim.st, p = st.players[pid], def = RSC_CRATES[crate], cPos = REST.crates[crate];
    if (!def || !cPos) return fail('Thùng nguyên liệu không hợp lệ');
    if (!sim.near(pid, cPos.x, cPos.z, 4.5) && !sim.near(pid, REST.counter.x, REST.counter.z, 10)) return fail(`Lại gần ${cPos.name} trong bếp nhé!`);
    this.ensureShift(pid);
    p.carry = 'raw:' + crate;
    sim.touch('players.' + pid);
    sim.fx({ k: 'sfx', name: 'pop', x: cPos.x, z: cPos.z });
    sim.fx({ k: 'float', x: cPos.x, z: cPos.z, y: 2.4, text: `+1 ${def.icon} ${def.name} ➔ Đem thái trên Thớt 🔪`, color: '#b8ff9e', to: pid });
    return ok({ carry: p.carry });
  }

  useBoard(pid, { board } = {}) {
    const { sim } = this, st = sim.st, r = st.restaurant, p = st.players[pid], me = sim.pos(pid);
    this.ensureShift(pid);
    r.boards ||= {};
    const bKey = board && REST.boards[board] ? board : (Math.hypot(me.x - REST.boards.b0.x, me.z - REST.boards.b0.z) <= Math.hypot(me.x - REST.boards.b1.x, me.z - REST.boards.b1.z) ? 'b0' : 'b1');
    const bPos = REST.boards[bKey];
    if (!sim.near(pid, bPos.x, bPos.z, 4.5) && !sim.near(pid, REST.counter.x, REST.counter.z, 10)) return fail('Lại gần bàn Thớt Sơ Chế nhé!');
    const cur = r.boards[bKey];

    // 1. Trên thớt đã thái xong -> cầm lên tay
    if (cur && cur.state === 'ready') {
      const def = RSC_CRATES[cur.ing];
      p.carry = 'prep:' + cur.ing;
      delete r.boards[bKey];
      sim.touch('players.' + pid); sim.touch('restaurant');
      sim.fx({ k: 'sfx', name: 'pop', x: bPos.x, z: bPos.z });
      sim.fx({ k: 'float', x: bPos.x, z: bPos.z, y: 2.4, text: `${def.prepIcon} Đã sơ chế ${def.name} ➔ Bỏ vào Bếp 🍳`, color: '#ffe066', to: pid });
      return ok({ carry: p.carry });
    }
    // 2. Đang thái trên thớt -> bấm lần nữa để băm nhanh hoàn tất và cầm luôn!
    if (cur && cur.state === 'chopping') {
      const def = RSC_CRATES[cur.ing];
      p.carry = 'prep:' + cur.ing;
      delete r.boards[bKey];
      sim.touch('players.' + pid); sim.touch('restaurant');
      sim.fx({ k: 'sfx', name: 'swish', x: bPos.x, z: bPos.z });
      sim.fx({ k: 'burst', kind: 'sparkle', x: bPos.x, z: bPos.z, y: 1.5, n: 5 });
      sim.fx({ k: 'float', x: bPos.x, z: bPos.z, y: 2.5, text: `🔪 Thái xong ${def.icon}! Đem bỏ vào Bếp 🍳`, color: '#ffe066', to: pid });
      return ok({ carry: p.carry });
    }
    // 3. Thớt trống -> đặt nguyên liệu thô lên thái
    if (p.carry && p.carry.startsWith('raw:')) {
      const ing = p.carry.slice(4), def = RSC_CRATES[ing];
      if (!def) return fail('Nguyên liệu không hợp lệ');
      delete p.carry;
      r.boards[bKey] = { id: bKey, ing, state: 'chopping', t0: st.world.t, dur: 1.15 / this.speed(bKey), by: pid };
      sim.touch('players.' + pid); sim.touch('restaurant');
      sim.fx({ k: 'sfx', name: 'swish', x: bPos.x, z: bPos.z });
      sim.fx({ k: 'float', x: bPos.x, z: bPos.z, y: 2.3, text: `🔪 Đang thái ${def.icon} ${def.name}...`, color: '#fff', to: pid });
      return ok({ board: bKey, state: 'chopping' });
    }
    return fail('Hãy lấy nguyên liệu từ Thùng (🥦/🍗/🦐/🍅/🧀/🥔) đem lại Thớt sơ chế nhé!');
  }

  pickRecipeForIng(ing, added = [], preferredRecipe = '') {
    const r = this.sim.st.restaurant;
    const trial = [...added, ing];
    if (preferredRecipe && RECIPES[preferredRecipe] && isSubMultiset(trial, RECIPES[preferredRecipe].rsc || [])) {
      return preferredRecipe;
    }
    // Ưu tiên món mà khách đang ngồi chờ và chưa có bếp nào nấu
    const activeCooking = new Set(Object.values(r.stations).map((s) => s.recipe).filter(Boolean));
    const seatedDishes = Object.values(r.guests).filter((g) => g.state === 'seated' && g.dish).map((g) => g.dish);
    for (const d of seatedDishes) {
      if (!activeCooking.has(d) && isSubMultiset(trial, RECIPES[d]?.rsc || [])) return d;
    }
    for (const d of seatedDishes) {
      if (isSubMultiset(trial, RECIPES[d]?.rsc || [])) return d;
    }
    for (const d of RSC_MENU) {
      if (isSubMultiset(trial, RECIPES[d]?.rsc || [])) return d;
    }
    for (const d of RECIPE_LIST) {
      if (isSubMultiset(trial, RECIPES[d]?.rsc || [])) return d;
    }
    return null;
  }

  useStove(pid, { station = 's0', recipe = '' } = {}) {
    const { sim } = this, st = sim.st, r = st.restaurant, p = st.players[pid], me = sim.pos(pid);
    this.ensureShift(pid);
    let stKey = station && REST.stoves[station] ? station : 's0';
    let s = r.stations[stKey];
    const sPos = REST.stoves[stKey] || REST.counter;
    if (!sim.near(pid, sPos.x, sPos.z, 5.0) && !sim.near(pid, REST.counter.x, REST.counter.z, 10)) {
      return fail('Lại gần Bếp Nấu để thao tác nhé!');
    }

    // 1. Nếu bếp đang bốc cháy (burning) hoặc bị khét (burnt) -> Dập lửa & làm sạch chảo!
    if (s && (s.state === 'burning' || s.state === 'burnt')) {
      delete r.stations[stKey];
      if (p.carry === 'extinguisher') delete p.carry;
      sim.touch('restaurant'); sim.touch('players.' + pid);
      sim.fx({ k: 'burst', kind: 'splash', x: sPos.x, z: sPos.z, y: 1.5, n: 10 });
      sim.fx({ k: 'sfx', name: 'swish', x: sPos.x, z: sPos.z });
      sim.fx({ k: 'float', x: sPos.x, z: sPos.z, y: 2.6, text: '🧯 Đã dập lửa & làm sạch bếp!', color: '#7fd0ff' });
      return ok({ extinguished: true });
    }

    // 2. Nếu món trên bếp đã chín (ready) -> Lấy món ra đĩa!
    if (s && s.state === 'ready') {
      return this.collect(pid, { station: stKey });
    }

    // 3. Nếu người chơi đang cầm nguyên liệu đã sơ chế (prep:*) hoặc nguyên liệu thô (raw:*)
    if (p.carry && (p.carry.startsWith('prep:') || p.carry.startsWith('raw:'))) {
      const isPrep = p.carry.startsWith('prep:');
      const ing = p.carry.split(':')[1];
      if (!RSC_CRATES[ing]) return fail('Nguyên liệu không hợp lệ');

      // Nếu bếp hiện tại đang nấu dở món khác, tự động tìm bếp bên cạnh đang ghép dở hoặc còn trống
      if (s && s.state === 'cooking') {
        const alt = ['s0', 's1', 's2'].find((k) => {
          const stObj = r.stations[k];
          if (!stObj) return true;
          if (stObj.state === 'prep' && this.pickRecipeForIng(ing, stObj.added, stObj.recipe)) return true;
          return false;
        });
        if (!alt) return fail('Tất cả các bếp đều đang bận nấu!');
        stKey = alt;
        s = r.stations[stKey];
      }

      const curAdded = s?.state === 'prep' ? s.added || [] : [];
      const matchedRecipe = this.pickRecipeForIng(ing, curAdded, s?.recipe || recipe);
      if (!matchedRecipe) {
        const curName = s?.recipe ? RECIPES[s.recipe].name : 'món này';
        const needStr = s?.req ? s.req.map((k) => RSC_CRATES[k]?.icon).join(' + ') : '';
        return fail(`Nguyên liệu ${RSC_CRATES[ing].icon} không khớp với ${curName} ${needStr ? `(Cần ${needStr})` : ''}!`);
      }

      const def = RECIPES[matchedRecipe];
      const req = [...(def.rsc || ['veg', 'meat'])];
      if (!s || s.state !== 'prep') {
        s = r.stations[stKey] = {
          id: stKey,
          state: 'prep',
          recipe: matchedRecipe,
          req,
          added: [],
          prepped: 0,
          by: pid,
          t0: st.world.t,
          rsc: true,
        };
      } else {
        s.recipe = matchedRecipe;
        s.req = req;
      }

      s.added.push(ing);
      if (isPrep) s.prepped = (s.prepped || 0) + 1;
      delete p.carry;

      const prog = rscProgress(s);
      const progText = prog.map((x) => `${x.icon}${x.have}/${x.need}`).join(' ');

      if (s.added.length >= s.req.length) {
        // Đã đủ nguyên liệu (ví dụ 2/2) -> Bắt đầu nấu trên bếp!
        s.state = 'cooking';
        s.t0 = st.world.t;
        const prepSpeedBonus = s.prepped >= s.req.length ? 0.48 : 0.62;
        s.dur = Math.max(2.4, (def.time * prepSpeedBonus) / this.speed(stKey));
        sim.fx({ k: 'sfx', name: 'sizzle', x: sPos.x, z: sPos.z });
        sim.fx({ k: 'float', x: sPos.x, z: sPos.z, y: 2.6, text: `🍳 Đủ ${progText}! Đang nấu ${def.icon} ${def.name}`, color: '#ffd166' });
        sim.game({ type: 'cook_start', pid, recipe: s.recipe });
      } else {
        sim.fx({ k: 'sfx', name: 'pop', x: sPos.x, z: sPos.z });
        sim.fx({ k: 'float', x: sPos.x, z: sPos.z, y: 2.5, text: `🍲 Đã thêm ${RSC_CRATES[ing].icon} (${progText})`, color: '#fff' });
      }
      sim.touch('players.' + pid); sim.touch('restaurant');
      return ok({ station: stKey, state: s.state, recipe: s.recipe });
    }

    if (s && s.state === 'prep') {
      const prog = rscProgress(s).map((x) => `${x.icon}${x.have}/${x.need}`).join(' ');
      return fail(`Đang ghép ${RECIPES[s.recipe].icon} ${RECIPES[s.recipe].name} (${prog}) — hãy thêm nguyên liệu còn thiếu!`);
    }
    if (s && s.state === 'cooking') {
      return fail(`Đang nấu ${RECIPES[s.recipe].icon} ${RECIPES[s.recipe].name} (${Math.max(1, Math.ceil(s.t0 + s.dur - st.world.t))}s)...`);
    }
    return fail('Lấy nguyên liệu từ Thùng ➔ Thái trên Thớt 🔪 ➔ Bỏ vào Bếp nhé!');
  }

  usePass(pid) {
    const { sim } = this, st = sim.st, r = st.restaurant, p = st.players[pid];
    this.ensureShift(pid);
    r.pass ||= [];
    const pc = REST.passCounter;
    if (!sim.near(pid, pc.x, pc.z, 5.5) && !sim.near(pid, REST.counter.x, REST.counter.z, 10)) {
      return fail('Lại gần Quầy Trả Món màu đỏ cam nhé!');
    }
    // Nếu đang cầm đĩa thức ăn -> đặt lên Quầy Trả Món
    if (p.carry && p.carry.startsWith('dish_')) {
      const recipe = p.carry.slice(5);
      if ((sim.bag(pid)[p.carry] || 0) > 0) sim.takeItem(pid, p.carry, 1);
      delete p.carry;
      r.pass.push({ id: uid('ps'), recipe, by: pid, t0: st.world.t });
      sim.touch('players.' + pid); sim.touch('restaurant');
      sim.fx({ k: 'sfx', name: 'bell', x: pc.x, z: pc.z });
      sim.fx({ k: 'float', x: pc.x, z: pc.z, y: 2.6, text: `🛎️ Lên món ${RECIPES[recipe]?.icon || '🍽️'} tại Quầy Trả Món!`, color: '#ffd166' });
      return ok({ placed: recipe });
    }
    // Nếu tay rảnh và trên Quầy Trả Món có đĩa -> bưng đĩa đi phục vụ khách
    if (r.pass.length > 0) {
      const seatedDishes = new Set(Object.values(r.guests).filter((g) => g.state === 'seated').map((g) => g.dish));
      let idx = r.pass.findIndex((x) => seatedDishes.has(x.recipe));
      if (idx < 0) idx = 0;
      const item = r.pass.splice(idx, 1)[0];
      const key = 'dish_' + item.recipe;
      sim.addItem(pid, key, 1);
      p.carry = key;
      sim.touch('players.' + pid); sim.touch('restaurant');
      sim.fx({ k: 'sfx', name: 'pop', x: pc.x, z: pc.z });
      sim.fx({ k: 'float', x: pc.x, z: pc.z, y: 2.5, text: `🍽️ Bưng ${RECIPES[item.recipe]?.icon || ''} ra Bàn Ăn cho khách!`, color: '#b8ff9e' });
      return ok({ picked: item.recipe });
    }
    return fail('Quầy Trả Món đang trống — hãy nấu món rồi đặt lên đây hoặc bưng thẳng ra bàn khách!');
  }

  clearTable(pid, { table } = {}) {
    const { sim } = this, st = sim.st, r = st.restaurant, p = st.players[pid], me = sim.pos(pid);
    this.ensureShift(pid);
    r.dirtyTables ||= {};
    let tKey = table !== undefined && r.dirtyTables[table] ? table : Object.keys(r.dirtyTables).sort((a, b) => {
      const pa = REST.table(+a), pb = REST.table(+b);
      return Math.hypot(pa.x - me.x, pa.z - me.z) - Math.hypot(pb.x - me.x, pb.z - me.z);
    })[0];
    if (tKey === undefined || !r.dirtyTables[tKey]) return fail('Bàn này đã sạch sẽ rồi!');
    const tp = REST.table(+tKey);
    if (!sim.near(pid, tp.x, tp.z, 5.5) && !sim.near(pid, REST.ovalTable.x, REST.ovalTable.z, 6.5)) return fail('Lại gần bàn ăn để thu tiền tip & dọn đĩa bẩn nhé!');
    const info = r.dirtyTables[tKey];
    const tip = info.tip || 15;
    delete r.dirtyTables[tKey];
    p.carry = 'dirty_plate';
    sim.sys('economy').earn(pid, tip, { bonus: false });
    if (r.shift) r.shift.earned = (r.shift.earned || 0) + tip;
    sim.touch('players.' + pid); sim.touch('restaurant');
    sim.fx({ k: 'sfx', name: 'coin', x: tp.x, z: tp.z });
    sim.fx({ k: 'float', x: tp.x, z: tp.z, y: 2.6, text: `+${tip} 🪙 Tip dọn bàn! Đem đĩa bẩn tới Bồn Rửa 🚰`, color: '#ffc02e' });
    return ok({ tip, carry: 'dirty_plate' });
  }

  useSink(pid) {
    const { sim } = this, st = sim.st, r = st.restaurant, p = st.players[pid];
    this.ensureShift(pid);
    const sk = REST.sink;
    if (!sim.near(pid, sk.x, sk.z, 4.8) && !sim.near(pid, REST.counter.x, REST.counter.z, 10)) return fail('Lại gần Bồn Rửa Bát nhé!');
    const hasDirtyCarry = p.carry === 'dirty_plate';
    const dirtyTableKeys = Object.keys(r.dirtyTables || {});
    if (!hasDirtyCarry && (r.cleanPlates || 6) >= (r.maxPlates || 6) && !dirtyTableKeys.length) {
      return fail('Chồng đĩa đều đã sạch bong sáng bóng rồi! ✨');
    }
    if (hasDirtyCarry) delete p.carry;
    else if (dirtyTableKeys.length) delete r.dirtyTables[dirtyTableKeys[0]];
    r.cleanPlates = Math.min(r.maxPlates || 6, (r.cleanPlates ?? 5) + 1);
    const wage = 18;
    sim.sys('economy').earn(pid, wage, { bonus: false });
    if (r.shift) r.shift.earned = (r.shift.earned || 0) + wage;
    sim.sys('prog').addXp(pid, 8);
    sim.touch('players.' + pid); sim.touch('restaurant');
    sim.fx({ k: 'burst', kind: 'splash', x: sk.x, z: sk.z, y: 1.5, n: 8 });
    sim.fx({ k: 'sfx', name: 'pop', x: sk.x, z: sk.z });
    sim.fx({ k: 'float', x: sk.x, z: sk.z, y: 2.5, text: `🚰 Rửa sạch đĩa! +${wage} 🪙 (+1 🍽️)`, color: '#7fd0ff' });
    return ok({ cleanPlates: r.cleanPlates, wage });
  }

  useTrash(pid) {
    const { sim } = this, st = sim.st, p = st.players[pid], tr = REST.trash;
    if (!p.carry) return fail('Bạn đang không cầm đồ thừa nào trên tay.');
    const was = p.carry;
    if (was.startsWith('dish_') && (sim.bag(pid)[was] || 0) > 0) sim.takeItem(pid, was, 1);
    delete p.carry;
    sim.touch('players.' + pid);
    sim.fx({ k: 'sfx', name: 'swish', x: tr.x, z: tr.z });
    sim.fx({ k: 'float', x: tr.x, z: tr.z, y: 2.2, text: '🗑️ Đã bỏ vào thùng rác', color: '#ccc', to: pid });
    return ok();
  }

  // Trợ lý thao tác nhanh 1 chạm trên thanh công thức Ready, Set, Cook! (hoặc khi bấm vào thẻ đơn hàng)
  quickStep(pid, { guestId } = {}) {
    const { sim } = this, st = sim.st, r = st.restaurant, p = st.players[pid], me = sim.pos(pid);
    if (!inRest(me.x, me.z, 8)) return fail('Hãy đi tới Quán Ăn ở Làng để làm thêm nhé!');
    this.ensureShift(pid);
    // 1. Nếu có bếp đang cháy -> dập lửa ngay
    const burningKey = Object.keys(r.stations).find((k) => r.stations[k]?.state === 'burning' || r.stations[k]?.state === 'burnt');
    if (burningKey) return this.useStove(pid, { station: burningKey });

    // 2. Chọn khách mục tiêu
    const seated = Object.values(r.guests).filter((g) => g.state === 'seated').sort((a, b) => a.patience - b.patience);
    const g = (guestId && r.guests[guestId]?.state === 'seated') ? r.guests[guestId] : seated[0];

    // 3. Nếu đang cầm đúng món khách cần hoặc trong túi có sẵn -> phục vụ khách ngay!
    if (g && (p.carry === 'dish_' + g.dish || (sim.bag(pid)['dish_' + g.dish] || 0) > 0)) {
      return this.serve(pid, { guest: g.id, allowInsideRest: true });
    }
    // 4. Nếu trên Quầy Trả Món có đúng món khách cần -> lấy món
    if (g && (r.pass || []).some((x) => x.recipe === g.dish)) {
      return this.usePass(pid);
    }
    // 5. Nếu có bếp đã nấu chín -> thu món
    const readyStove = Object.keys(r.stations).find((k) => k !== 'home' && r.stations[k]?.state === 'ready');
    if (readyStove) return this.collect(pid, { station: readyStove });

    // 6. Nếu đang cầm nguyên liệu đã sơ chế -> bỏ vào bếp
    if (p.carry && p.carry.startsWith('prep:')) {
      const targetStove = ['s0', 's1', 's2'].find((k) => r.stations[k]?.state === 'prep') || ['s0', 's1', 's2'].find((k) => !r.stations[k]) || 's0';
      return this.useStove(pid, { station: targetStove, recipe: g?.dish });
    }
    // 7. Nếu trên thớt có nguyên liệu đang thái hoặc đã thái -> lấy hoặc thái xong
    const activeBoard = ['b0', 'b1'].find((k) => r.boards?.[k]);
    if (activeBoard) return this.useBoard(pid, { board: activeBoard });

    // 8. Nếu đang cầm nguyên liệu thô -> đặt lên thớt thái
    if (p.carry && p.carry.startsWith('raw:')) {
      const freeBoard = !r.boards?.b0 ? 'b0' : 'b1';
      return this.useBoard(pid, { board: freeBoard });
    }
    // 9. Nếu đang cầm đĩa bẩn -> rửa ở bồn
    if (p.carry === 'dirty_plate') return this.useSink(pid);

    // 10. Tự động lấy nguyên liệu tiếp theo cho món của khách đang chờ!
    const targetRecipe = g?.dish || 'broccoli_stir';
    const prepStove = ['s0', 's1', 's2'].map((k) => r.stations[k]).find((s) => s?.state === 'prep' && s.recipe === targetRecipe)
      || ['s0', 's1', 's2'].map((k) => r.stations[k]).find((s) => s?.state === 'prep');
    const rec = prepStove ? prepStove.recipe : targetRecipe;
    const prog = rscProgress(prepStove || { recipe: rec, req: RECIPES[rec]?.rsc || ['veg', 'veg'], added: [] });
    const missing = prog.find((x) => x.have < x.need);
    if (missing) return this.grabCrate(pid, { crate: missing.ing });
    return ok();
  }

  // ---------------- Nấu từ túi/rương (Bếp nhà & Nấu truyền thống) ----------------
  cook(pid, { recipe, station = 'home' }) {
    const { sim } = this, st = sim.st, r = st.restaurant, def = RECIPES[recipe], me = sim.pos(pid);
    if (!def) return fail('Công thức không hợp lệ');
    if (def.lvl > st.farm.level && !r.shift?.active) return fail(`Món này mở ở Cấp ${def.lvl}`);
    if (station === 'home') {
      if (me.area !== 'house' || !sim.near(pid, INTERIOR.ox + HOME_KITCHEN.x, INTERIOR.oz + HOME_KITCHEN.z, 5)) return fail('Lại gần bếp trong nhà nhé!');
    } else {
      if (!this.isOpen(r)) return fail('Chưa mở Nhà Hàng hoặc chưa bắt đầu Ca Làm Thêm');
      const idx = +station.slice(1);
      if (!(idx >= 0 && idx < stationCount(r.kitchen, r.shift?.active))) return fail('Bếp này chưa mở');
      if (!sim.near(pid, REST.counter.x, REST.counter.z, 10) && !inRest(me.x, me.z, 3)) return fail('Lại gần quầy bếp nhé!');
    }
    if (r.stations[station] && r.stations[station].state !== 'prep') return fail('Bếp đang bận!');
    const bags = [st.inventory.chest, sim.bag(pid)];
    if (!canCook(def, bags)) return fail('Thiếu nguyên liệu trong Rương/Túi! (Mẹo: Lấy nguyên liệu miễn phí tại 6 Thùng trong Bếp Làm Thêm 🥦🍗🦐)');
    for (const [k, n] of Object.entries(def.ing)) takeKey(bags, k, n);
    sim.touch('inventory.chest'); sim.touch('inventory.players.' + pid);
    r.stations[station] = { id: station, state: 'cooking', recipe, t0: st.world.t, dur: def.time / this.speed(station), by: pid };
    sim.touch('restaurant'); sim.fx({ k: 'sfx', name: 'sizzle', to: pid }); sim.game({ type: 'cook_start', pid, recipe });
    return ok();
  }

  collect(pid, { station }) {
    const { sim } = this, st = sim.st, r = st.restaurant, s = r.stations[station], me = sim.pos(pid);
    if (!s || s.state !== 'ready') return fail('Món chưa chín!');
    if (station !== 'home' && !sim.near(pid, REST.counter.x, REST.counter.z, 10) && !inRest(me.x, me.z, 3)) return fail('Lại gần quầy bếp nhé!');
    const def = RECIPES[s.recipe], p = st.players[pid];
    delete r.stations[station];
    if (station !== 'home' && r.cleanPlates > 0) r.cleanPlates--;
    sim.addItem(pid, 'dish_' + s.recipe, 1);
    p.carry = 'dish_' + s.recipe;
    p.stats.cook++;
    sim.touch('players.' + pid); sim.touch('restaurant');
    const pos = station === 'home' ? me : (REST.stoves[station] || REST.counter);
    sim.fx({ k: 'float', x: pos.x, z: pos.z, y: 2.8, text: `+1 ${def.icon} ${def.name} (Bưng ra bàn khách!)`, color: '#fff', to: pid });
    sim.fx({ k: 'sfx', name: 'pop', to: pid });
    sim.sys('prog').addXp(pid, Math.round(def.price / 16));
    sim.game({ type: 'cook', pid, recipe: s.recipe, n: 1 });
    return ok();
  }

  pay(guest, def, price, tipTo, comboMult = 1) {
    const { sim } = this, r = sim.st.restaurant, c = CUSTOMERS[guest.kind], deco = 1 + 0.12 * ((r.deco || 1) - 1);
    const left = Math.max(0, guest.patience) / c.patience, mult = guest.kind === 'fancy' ? 2 : 1;
    const base = Math.round(price * mult * (1 + 0.05 * ((r.stars || 1) - 1)));
    const tip = Math.round(base * c.tip * (0.55 + 0.95 * left) * deco * comboMult);
    // Quỹ chung luôn nhận doanh thu cơ bản của quán, và nếu người chơi đang làm thêm thì nhận thêm Lương làm thêm + Tip trực tiếp vào ví cá nhân!
    sim.sys('economy').toFund(base);
    let wage = 0;
    if (tipTo && tipTo !== 'chef') {
      wage = Math.round(base * (r.unlocked ? 0.35 : 0.65) * comboMult);
      sim.sys('economy').earn(tipTo, wage + tip, { bonus: false });
    } else if (tip) {
      sim.sys('economy').toFund(tip);
    }
    return { base, wage, tip };
  }

  serve(pid, { guest, allowInsideRest = false }) {
    const { sim } = this, st = sim.st, r = st.restaurant, g = r.guests[guest], me = sim.pos(pid);
    if (!g || g.state !== 'seated') return fail('Khách này không chờ món');
    const tp = REST.table(g.table);
    const nearTable = sim.near(pid, tp.x, tp.z, 5.5) || sim.near(pid, REST.ovalTable.x, REST.ovalTable.z, 6.2) || (allowInsideRest && inRest(me.x, me.z, 6));
    if (!nearTable) return fail('Lại gần bàn khách nhé!');

    const dishKey = 'dish_' + g.dish;
    const p = st.players[pid];
    let took = sim.takeItem(pid, dishKey);
    if (!took && p.carry === dishKey) {
      took = true;
    }
    if (!took && (r.pass || []).some((x) => x.recipe === g.dish)) {
      const idx = r.pass.findIndex((x) => x.recipe === g.dish);
      if (idx >= 0) { r.pass.splice(idx, 1); took = true; }
    }
    if (!took) return fail(`Khách muốn ${RECIPES[g.dish].icon} ${RECIPES[g.dish].name}!`);
    if (p.carry === dishKey) delete p.carry;

    // Tính chuỗi Combo Ready, Set, Cook!
    r.shift ||= { active: false, by: pid, startedAt: st.world.t, served: 0, earned: 0, combo: 0, lastServeAt: 0 };
    r.shift.combo = (st.world.t - (r.shift.lastServeAt || 0) <= 50) ? (r.shift.combo || 0) + 1 : 1;
    r.shift.lastServeAt = st.world.t;
    const comboMult = 1 + Math.min(1.0, (r.shift.combo - 1) * 0.18);

    const { base, wage, tip } = this.pay(g, RECIPES[g.dish], RECIPES[g.dish].price, pid, comboMult);
    r.shift.served = (r.shift.served || 0) + 1;
    r.shift.earned = (r.shift.earned || 0) + wage + tip;

    g.state = 'eating'; g.t0 = st.world.t; g.paid = base;
    p.stats.serve++; r.rep += 1; this.updateStars();

    // Tặng Mũ Đầu Bếp khi phục vụ đủ 3 món trong ca làm thêm!
    if (r.shift.served >= 3 && p.hats && !p.hats.includes('chef')) {
      p.hats.push('chef');
      p.char.hat = 'chef';
      sim.toast(pid, '👨‍🍳 Chúc mừng! Bạn được thưởng Mũ Đầu Bếp vì làm thêm xuất sắc!', 'good');
    }

    sim.touch('restaurant'); sim.touch('players.' + pid);
    const comboTag = r.shift.combo >= 2 ? ` 🔥Combo ×${r.shift.combo}` : '';
    sim.fx({
      k: 'float',
      x: tp.x, z: tp.z, y: 3.1,
      text: `+${wage + tip} 🪙 Lương&Tip (Quỹ +${base})${comboTag}`,
      color: '#ffc02e',
    });
    sim.fx({ k: 'burst', kind: 'hearts', x: tp.x, z: tp.z, y: 1.8, n: 6 });
    sim.fx({ k: 'sfx', name: 'coin', x: tp.x, z: tp.z });
    sim.sys('prog').addXp(pid, 14);
    sim.game({ type: 'serve', pid, recipe: g.dish });
    return ok({ base, wage, tip, combo: r.shift.combo });
  }

  updateStars() {
    const r = this.sim.st.restaurant, s = Math.max(1, Math.min(5, 1 + Math.floor(r.rep / 8)));
    if (s > r.stars) { r.stars = s; this.sim.fx({ k: 'banner', text: `🌟 Quán Ăn Làng đạt ${s} sao!`, tone: 'good' }); }
    else if (s < r.stars) r.stars = s;
  }

  chooseDish(kind) {
    const { sim } = this, st = sim.st, r = st.restaurant, lvl = st.farm.level, c = CUSTOMERS[kind], rng = sim.rng;
    // Khi làm thêm Ready, Set, Cook!, mở rộng thực đơn các món xào/nướng/súp hấp dẫn ngay từ Cấp 1
    let pool = r.shift?.active && !r.unlocked
      ? RSC_MENU.filter((k) => RECIPES[k].lvl <= Math.max(2, lvl))
      : RECIPE_LIST.filter((k) => RECIPES[k].lvl <= lvl);
    if (!pool.length) pool = ['fries', 'broccoli_stir', 'pancake'];
    if (c.likes) { const liked = pool.filter((k) => RECIPES[k].tags.includes(c.likes)); if (liked.length) pool = liked; }
    if (c.picky) pool = [...pool].sort((a, b) => RECIPES[b].price - RECIPES[a].price).slice(0, 3);
    return rng.pick(pool);
  }

  spawnGuest(immediateSeated = false) {
    const { sim } = this, st = sim.st, r = st.restaurant, t = st.world.t, rng = sim.rng;
    const guests = Object.values(r.guests);
    const maxSeats = r.shift?.active ? Math.max(4, r.tables + 2) : r.tables;
    const used = new Set(guests.map((g) => g.table));
    const free = [...Array(maxSeats).keys()].filter((i) => !used.has(i));
    if (!free.length || !sim.connected().length) return null;
    const kind = rng.pick(CUSTOMER_LIST), id = uid('g'), table = rng.pick(free);
    const dish = this.chooseDish(kind);
    r.guests[id] = {
      id,
      kind,
      table,
      state: immediateSeated ? 'seated' : 'walk_in',
      t0: t,
      dish: immediateSeated ? dish : '',
      patience: CUSTOMERS[kind].patience,
    };
    if (immediateSeated) {
      const tp = REST.table(table);
      sim.fx({ k: 'say', x: tp.x, z: tp.z, text: `${RECIPES[dish].icon} ${CUSTOMERS[kind].order}` });
    }
    sim.touch('restaurant');
    return r.guests[id];
  }

  tick(dt) {
    const { sim } = this, st = sim.st, r = st.restaurant, t = st.world.t, rng = sim.rng;
    const open = this.isOpen(r);
    if (!open) {
      for (const k in r.stations) if (k !== 'home') delete r.stations[k];
    }

    // 1. Tiến trình thái nguyên liệu trên Bàn Thớt (Cutting Boards)
    if (r.boards) {
      for (const bKey in r.boards) {
        const b = r.boards[bKey];
        if (b && b.state === 'chopping' && t >= b.t0 + b.dur) {
          b.state = 'ready';
          const bPos = REST.boards[bKey] || REST.counter;
          // Nếu người chơi đang đứng ngay cạnh thớt và tay đang trống, tự động cầm nguyên liệu đã thái lên tay cho mượt!
          const p = st.players[b.by];
          if (p && !p.carry && sim.near(b.by, bPos.x, bPos.z, 3.2)) {
            p.carry = 'prep:' + b.ing;
            delete r.boards[bKey];
            sim.touch('players.' + b.by);
            sim.fx({ k: 'float', x: bPos.x, z: bPos.z, y: 2.4, text: `${RSC_CRATES[b.ing]?.prepIcon || '🔪'} Đã thái xong! Đem tới Bếp 🍳`, color: '#ffe066', to: b.by });
          } else {
            sim.fx({ k: 'float', x: bPos.x, z: bPos.z, y: 2.3, text: `✨ Thái xong ${RSC_CRATES[b.ing]?.icon || ''}!`, color: '#ffe066' });
          }
          sim.fx({ k: 'sfx', name: 'pop', x: bPos.x, z: bPos.z });
          sim.touch('restaurant');
        }
      }
    }

    // 2. Tiến trình các Bếp Nấu (cooking -> ready -> cảnh báo cháy -> burning khi đang trong ca làm thêm)
    for (const key in r.stations) {
      const s = r.stations[key];
      const pos = key === 'home' ? { x: INTERIOR.ox + HOME_KITCHEN.x, z: INTERIOR.oz + HOME_KITCHEN.z } : (REST.stoves[key] || REST.counter);
      if (s.state === 'cooking' && t >= s.t0 + s.dur) {
        s.state = 'ready';
        s.readyAt = t;
        sim.touch('restaurant');
        sim.fx({ k: 'sfx', name: 'ding', x: pos.x, z: pos.z });
        sim.fx({ k: 'burst', kind: 'sparkle', x: pos.x, z: pos.z, y: 1.6, n: 8 });
        if (s.by === 'chef') this.chefServe(key, s);
      } else if (s.state === 'ready' && key !== 'home' && r.shift?.active && s.rsc) {
        const over = t - (s.readyAt || s.t0 + s.dur);
        if (over > 10 && !s.warned) {
          s.warned = true;
          sim.fx({ k: 'float', x: pos.x, z: pos.z, y: 2.6, text: `⚠️ Sắp khét! Lấy ${RECIPES[s.recipe]?.icon || '🍳'} ngay!`, color: '#ff7b54' });
          sim.fx({ k: 'sfx', name: 'alarm', x: pos.x, z: pos.z });
        }
        if (over > 20) {
          s.state = 'burning';
          s.burnAt = t;
          sim.touch('restaurant');
          sim.fx({ k: 'float', x: pos.x, z: pos.z, y: 2.8, text: '🔥 CHÁY BẾP! Lại gần bấm Dập Lửa 🧯!', color: '#ff3b30' });
        }
      } else if (s.state === 'burning' && t - (s.burnAt || t) > 18) {
        // Tự động dập sau 18s nếu không có ai quanh bếp để tránh kẹt
        delete r.stations[key];
        sim.touch('restaurant');
      }
    }

    // Tự động dọn đĩa bẩn quá lâu (sau 35s) để bàn không bị kẹt vĩnh viễn
    if (r.dirtyTables) {
      for (const tk in r.dirtyTables) {
        if (t - (r.dirtyTables[tk].t0 || 0) > 35) {
          delete r.dirtyTables[tk];
          r.cleanPlates = Math.min(r.maxPlates || 6, (r.cleanPlates || 0) + 1);
          sim.touch('restaurant');
        }
      }
    }

    if (!open) return;

    // 3. Khách hàng ra vào Quán Ăn (nhanh hơn khi đang trong ca làm thêm Ready, Set, Cook!)
    const guests = Object.values(r.guests);
    if (t >= r.nextGuest) {
      const baseWait = r.shift?.active ? rng.range(7, 13) : rng.range(14, 26);
      r.nextGuest = t + baseWait / (1 + 0.12 * ((r.stars || 1) - 1));
      this.spawnGuest(false);
    }

    for (const g of guests) {
      const c = CUSTOMERS[g.kind];
      if (g.state === 'walk_in' && t - g.t0 > 3.5) {
        g.state = 'seated'; g.t0 = t; g.dish = g.dish || this.chooseDish(g.kind); sim.touch('restaurant');
        const tp = REST.table(g.table);
        sim.fx({ k: 'say', x: tp.x, z: tp.z, text: `${RECIPES[g.dish].icon} ${c.order}` });
        sim.fx({ k: 'sfx', name: g.kind === 'cat' ? 'cat' : 'bell', x: tp.x, z: tp.z });
      } else if (g.state === 'seated') {
        g.patience -= dt;
        if (g.patience <= 0) {
          g.state = 'leaving'; g.t0 = t; g.angry = true;
          r.rep = Math.max(0, r.rep - 2);
          if (r.shift) r.shift.combo = 0;
          this.updateStars(); sim.touch('restaurant');
          const tp = REST.table(g.table);
          sim.fx({ k: 'say', x: tp.x, z: tp.z, text: c.angry });
          sim.fx({ k: 'burst', kind: 'stars', x: tp.x, z: tp.z, y: 2, n: 5 });
          sim.fx({ k: 'sfx', name: 'fail', x: tp.x, z: tp.z });
        }
      } else if (g.state === 'eating' && t - g.t0 > c.eat) {
        g.state = 'leaving'; g.t0 = t;
        r.dirtyTables ||= {};
        r.dirtyTables[g.table] = {
          table: g.table,
          tip: Math.round(14 + (RECIPES[g.dish]?.price || 100) * 0.08),
          t0: t,
        };
        sim.touch('restaurant');
        const tp = REST.table(g.table);
        sim.fx({ k: 'say', x: tp.x, z: tp.z, text: c.happy });
      } else if (g.state === 'leaving' && t - g.t0 > 3.5) {
        delete r.guests[g.id]; sim.touch('restaurant');
      }
    }

    // 4. Bếp Trưởng Bo tự nấu (khi đã mở khóa nhà hàng & cấp bếp ≥ 2): dùng nguyên liệu trong Rương Chung
    this.acc += dt;
    if (this.acc >= 2 && r.unlocked && r.auto && r.kitchen >= 2) {
      this.acc = 0;
      const waiting = Object.values(r.guests).filter((g) => g.state === 'seated' && !g.cook);
      for (const g of waiting) {
        const key = [...Array(stationCount(r.kitchen, r.shift?.active)).keys()].map((i) => 's' + i).find((k) => !r.stations[k]); if (!key) break;
        const def = RECIPES[g.dish], bags = [st.inventory.chest]; if (!canCook(def, bags)) continue;
        for (const [k, n] of Object.entries(def.ing)) takeKey(bags, k, n);
        g.cook = true; r.stations[key] = { id: key, state: 'cooking', recipe: g.dish, t0: t, dur: (def.time / this.speed(key)) * 1.4, by: 'chef', forGuest: g.id };
        sim.touch('inventory.chest'); sim.touch('restaurant');
      }
    }
  }

  chefServe(key, s) {
    const { sim } = this, r = sim.st.restaurant, g = r.guests[s.forGuest]; delete r.stations[key];
    if (g && g.state === 'seated') {
      const { base } = this.pay(g, RECIPES[g.dish], RECIPES[g.dish].price, 'chef');
      g.state = 'eating'; g.t0 = sim.st.world.t; r.rep += 1; this.updateStars();
      const tp = REST.table(g.table); sim.fx({ k: 'float', x: tp.x, z: tp.z, y: 3, text: `🧑‍🍳 +${base} 🪙`, color: '#ffc02e' }); sim.fx({ k: 'sfx', name: 'coin', x: tp.x, z: tp.z });
    } else sim.sys('items').drop('dish_' + s.recipe, 1, REST.counter.x - 1.5, REST.counter.z + 2);
    sim.touch('restaurant');
  }
}
