import { CFG } from '../core/Config.js';
import { fail, ok } from '../core/result.js';
import { ITEMS } from '../data/items.js';

const MAX = 100;
const FOOD = {
  egg: { food: 12, hp: 3 }, milk: { food: 14, hp: 4 }, cheese: { food: 18, hp: 6 },
  truffle: { food: 20, hp: 6 }, golden_egg: { food: 28, hp: 12 }, clover: { food: 8, hp: 2 },
  berry: { food: 14, hp: 3 },
};

export function foodValue(id) {
  const item = ITEMS[id];
  if (!item) return null;
  if (item.cat === 'dish') return { food: 32, hp: 10 };
  if (item.cat === 'crop') return { food: 18, hp: 3 };
  if (item.cat === 'fish' && id !== 'boot') return { food: 20, hp: 5 };
  return FOOD[id] || null;
}

export class VitalsSystem {
  constructor(sim) {
    this.sim = sim; this.id = 'vitals'; this.hitAt = new Map();
    this.cmds = { eat: (pid, c) => this.eat(pid, c.item) };
  }
  eat(pid, id) {
    const sim = this.sim, p = sim.st.players[pid], value = foodValue(id);
    if (!value) return fail('Món này không ăn được.');
    if (!sim.hasItem(pid, id)) return fail('Bạn không còn món này trong túi.');
    const food = Math.max(0, p.food ?? MAX), hp = Math.max(1, p.hp ?? MAX);
    if (food >= MAX && hp >= MAX) return fail('Bạn đang no và khỏe rồi!');
    if (!sim.takeItem(pid, id)) return fail('Không thể lấy món ăn khỏi túi.');
    p.food = Math.min(MAX, food + value.food);
    p.hp = Math.min(MAX, hp + value.hp);
    this.hitAt.delete(pid);
    sim.touch('players.' + pid);
    sim.fx({ k: 'sfx', name: 'munch', to: pid });
    sim.toast(pid, `Đã ăn ${ITEMS[id].name} 🍽️`, 'good');
    return ok();
  }
  damage(pid, amount = 15) {
    const p = this.sim.st.players[pid];
    if (!p || p.sleeping) return;
    p.hp = Math.max(1, (p.hp ?? MAX) - amount);
    this.hitAt.set(pid, this.sim.st.world.t);
    this.sim.touch('players.' + pid);
  }
  sleepRecovery(pid) {
    const p = this.sim.st.players[pid];
    if (!p) return;
    p.food = Math.min(MAX, (p.food ?? MAX) + 25);
    p.hp = Math.min(MAX, (p.hp ?? MAX) + 60);
    this.hitAt.delete(pid);
  }
  tick(dt) {
    const now = this.sim.st.world.t;
    for (const p of this.sim.connected()) {
      const beforeFood = Math.floor(p.food ?? MAX), beforeHp = Math.floor(p.hp ?? MAX);
      p.food = Math.max(0, (p.food ?? MAX) - dt * MAX / CFG.DAY_SECONDS);
      if (p.food <= 0) p.hp = Math.max(1, (p.hp ?? MAX) - dt * 0.5);
      else if (now - (this.hitAt.get(p.id) ?? -Infinity) > 4) p.hp = Math.min(MAX, (p.hp ?? MAX) + dt * 1.5);
      if (beforeFood !== Math.floor(p.food) || beforeHp !== Math.floor(p.hp)) this.sim.touch('players.' + p.id);
    }
  }
}
