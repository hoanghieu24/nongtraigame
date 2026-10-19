import { CFG } from '../core/Config.js';
import { ITEMS, isSellable } from '../data/items.js';
import { CROPS } from '../data/crops.js';
import { SPOTS } from '../data/layout.js';
import { fail, ok } from '../core/result.js';
import { takeFrom } from '../inventory/Inventory.js';

export class EconomySystem {
  constructor(sim) {
    this.sim = sim; this.id = 'economy';
    this.cmds = {
      sell: (p, c) => this.sell(p, c),
      donate: (p, c) => this.donate(p, c),
      arcadeReward: (p, c) => this.arcadeReward(p, c),
      sendLoveGift: (p, c) => this.sendLoveGift(p, c),
    };
  }
  arcadeReward(pid, { coins = 0, xp = 8, love = 10, label = 'Trò chơi đôi' } = {}) {
    const st = this.sim.st, p = st.players[pid];
    if (!p) return fail('Không tìm thấy người chơi');
    const c = Math.max(0, Math.min(1200, Math.round(coins)));
    if (c > 0) this.earn(pid, c, { bonus: true });
    st.economy.loveXp = (st.economy.loveXp || 0) + Math.max(0, love);
    this.sim.touch('economy');
    this.sim.sys('prog')?.addXp(pid, Math.max(2, xp));
    this.sim.fx({ k: 'sfx', name: 'coin' });
    this.sim.toast(
      undefined,
      `🎮 ${p.name} vừa chơi "${label}" nhận +${c} 🪙 & +${love} 💕 Tình Yêu!`,
      'good'
    );
    return ok({ coins: c, love: st.economy.loveXp });
  }
  sendLoveGift(pid, { msg = 'Gửi ngàn trái tim tới người ấy! 💖', love = 20, giftCoins = 100 } = {}) {
    const st = this.sim.st, p = st.players[pid];
    if (!p) return fail('Không tìm thấy người chơi');
    st.economy.loveXp = (st.economy.loveXp || 0) + love;
    st.economy.fund = (st.economy.fund || 0) + giftCoins;
    for (const pl of Object.values(st.players)) {
      if (pl.id !== pid) {
        pl.money = (pl.money || 0) + giftCoins;
        this.sim.touch('players.' + pl.id);
      }
    }
    this.sim.touch('economy');
    const pose = this.sim.poses?.[pid];
    if (pose) {
      this.sim.fx({ k: 'burst', kind: 'hearts', x: pose.x, z: pose.z, y: 2.6, n: 12 });
    }
    this.sim.fx({ k: 'confetti' });
    this.sim.fx({ k: 'sfx', name: 'levelup' });
    this.sim.fx({
      k: 'banner',
      text: `💖 ${p.name}: "${msg}"`,
      sub: `+${love} 💕 Điểm Tình Yêu • +${giftCoins} 🪙 vào Quỹ Chung Hiếu & Huyền!`,
      tone: 'good',
    });
    return ok();
  }
  canPay(pid, cost, mode = 'self') { const st = this.sim.st; return (mode === 'fund' ? st.economy.fund : 0) + st.players[pid].money >= cost; }
  // mode 'fund': dùng Quỹ Chung trước, thiếu thì lấy ví cá nhân. Trả về null nếu không đủ.
  pay(pid, cost, mode = 'self') {
    const st = this.sim.st, p = st.players[pid];
    if (!this.canPay(pid, cost, mode)) return null;
    let fromFund = 0;
    if (mode === 'fund') { fromFund = Math.min(st.economy.fund, cost); st.economy.fund -= fromFund; }
    p.money -= cost - fromFund;
    this.sim.touch('players.' + pid); this.sim.touch('economy');
    return { fund: fromFund, self: cost - fromFund };
  }
  noMoney(cost, mode) { return fail(mode === 'fund' ? `Quỹ chung + ví của bạn chưa đủ ${cost} 🪙` : `Chưa đủ ${cost} 🪙 rồi!`); }
  earn(pid, coins, { bonus = true } = {}) {
    const st = this.sim.st; st.players[pid].money += coins;
    if (bonus) st.economy.fund += Math.round(coins * CFG.FAMILY_BONUS);
    this.sim.touch('players.' + pid); this.sim.touch('economy');
  }
  toFund(coins) { this.sim.st.economy.fund += coins; this.sim.touch('economy'); }
  price(id, at = 'crate') {
    const base = ITEMS[id]?.sell || 0, hot = this.sim.st.economy.hot === id ? 1.5 : 1;
    return Math.round(base * hot * (at === 'market' ? 1.1 : at === 'fisher' ? 1.15 : 1));
  }
  where(at) {
    if (at === 'market') return SPOTS.market;
    if (at === 'fisher') return this.sim.st.npcs.fisherman || { x: 4.6, z: 21.4 };
    return SPOTS.crate;
  }
  sell(pid, { items = 'all', at = 'crate' } = {}) {
    const sim = this.sim, bag = sim.bag(pid), w = this.where(at);
    if (!sim.near(pid, w.x, w.z, 6)) return fail(at === 'crate' ? 'Lại gần thùng bán hàng nhé!' : at === 'market' ? 'Ra quầy chợ ở Làng nhé!' : 'Lại gần Ông Sáu nhé!');
    const ids = items === 'all' ? Object.keys(bag).filter((id) => isSellable(id) && ITEMS[id].cat !== 'dish') : Object.keys(items);
    let total = 0, count = 0;
    for (const id of ids) {
      if (!isSellable(id)) continue; if (at === 'fisher' && ITEMS[id].cat !== 'fish') continue;
      const n = items === 'all' ? (bag[id] || 0) : Math.min(items[id] | 0, bag[id] || 0); if (n <= 0) continue;
      total += this.price(id, at) * n; count += n; takeFrom(bag, id, n); sim.game({ type: 'sell', pid, item: id, n });
    }
    if (!count) return fail(at === 'fisher' ? 'Ông Sáu chỉ mua cá thôi nè!' : 'Không có gì để bán');
    this.earn(pid, total); sim.st.players[pid].stats.sell += count;
    sim.touch('inventory.players.' + pid);
    sim.fx({ k: 'burst', kind: 'coins', x: w.x, z: w.z, y: 1.6, n: Math.min(24, 6 + count) });
    sim.fx({ k: 'float', x: w.x, z: w.z, y: 2.4, text: `+${total} 🪙`, color: '#ffc02e', to: pid });
    sim.fx({ k: 'sfx', name: 'coin', x: w.x, z: w.z });
    sim.toast(pid, `Đã bán ${count} món được ${total} 🪙 (+${Math.round(total * CFG.FAMILY_BONUS)} vào Quỹ Chung)`, 'good');
    sim.sys('prog').addXp(pid, Math.min(25, Math.floor(total / 30)));
    return ok({ total });
  }
  donate(pid, { amount }) {
    const p = this.sim.st.players[pid], n = Math.min(p.money, Math.max(1, amount | 0));
    if (n <= 0) return fail('Ví trống trơn rồi!');
    p.money -= n; this.toFund(n); this.sim.touch('players.' + pid);
    this.sim.toast(undefined, `${p.name} góp ${n} 🪙 vào Quỹ Chung!`, 'good');
    return ok();
  }
  newDay() {
    const st = this.sim.st;
    const pool = [...Object.keys(CROPS).filter((k) => !CROPS[k].rare && !CROPS[k].event), 'egg', 'milk', 'wool'];
    st.economy.hot = this.sim.rng.pick(pool); st.economy.hotDay = st.world.day; this.sim.touch('economy');
  }
  onNewDay() { this.newDay(); }
}
