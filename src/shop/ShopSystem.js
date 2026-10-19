import { shopCatalog } from '../data/shops.js';
import { ANIMALS } from '../data/animals.js';
import { PENS, VILLAGE, SPOTS } from '../data/layout.js';
import { fail, ok } from '../core/result.js';
import { addTo } from '../inventory/Inventory.js';

export class ShopSystem {
  constructor(sim) { this.sim = sim; this.id = 'shop'; this.cmds = { buy: (p, c) => this.buy(p, c) }; }
  shopPos(shop) {
    if (VILLAGE.shops[shop]) return VILLAGE.shops[shop];
    if (shop === 'delivery') return this.sim.st.npcs.delivery || SPOTS.merchant;
    if (shop === 'merchant') return SPOTS.merchant;
    return null;
  }
  canAccessShop(pid, shop) {
    const { sim } = this;
    const pos = this.shopPos(shop);
    if (!pos) return false;
    if (sim.near(pid, pos.x, pos.z, 12)) return true;
    // Cho phép mua Chuồng Trại & Vật Nuôi trực tiếp khi đang đứng cạnh bất kỳ Chuồng nào ở Nông Trại!
    if (shop === 'animal') {
      const me = sim.pos(pid);
      if (me.area !== 'house') {
        for (const P of Object.values(PENS)) {
          const cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
          if (sim.near(pid, cx, cz, 14) || sim.near(pid, P.gate.x, P.gate.z, 10)) return true;
        }
      }
    }
    return false;
  }
  buy(pid, { shop, key, qty = 1 }) {
    const { sim } = this, st = sim.st, p = st.players[pid];
    if (!this.shopPos(shop)) return fail('Cửa hàng không tồn tại');
    if (shop === 'merchant' && !sim.eventActive('merchant')) return fail('Thương nhân đã rời đi rồi!');
    if (!this.canAccessShop(pid, shop)) return fail('Bạn đang ở quá xa cửa hàng hoặc chuồng trại!');
    const row = shopCatalog(shop, st).find((r) => r.key === key);
    if (!row) return fail('Món này không còn bán');
    if (row.locked) return fail(row.reason || 'Chưa mở khoá');
    qty = row.kind === 'seed' || row.kind === 'goods' ? Math.min(10, Math.max(1, qty | 0)) : 1;
    const cost = row.price * qty;
    // kiểm tra điều kiện TRƯỚC khi trừ tiền
    if (row.kind === 'pen' && st.buildings[row.ref]?.owned) return fail('Đã có chuồng này rồi!');
    if (row.kind === 'animal') {
      const pen = ANIMALS[row.ref].pen;
      if (!st.buildings[pen]?.owned) return fail(`Cần mua ${PENS[pen].name} trước!`);
      const n = Object.values(st.animals).filter((a) => a.pen === pen).length;
      if (n >= PENS[pen].cap) return fail(`Chuồng đầy rồi (${n}/${PENS[pen].cap})!`);
    }
    if (row.kind === 'hat' && p.hats.includes(row.ref)) { p.char.hat = row.ref; sim.touch('players.' + pid); return ok(); }
    const eco = sim.sys('economy'), paid = eco.pay(pid, cost, row.pay);
    if (!paid) return eco.noMoney(cost, row.pay);
    switch (row.kind) {
      case 'seed': sim.addItem(pid, 'seed_' + row.ref, qty); break;
      case 'goods': sim.addItem(pid, row.ref, row.qty * qty); break;
      case 'animal': sim.sys('animal').spawn(row.ref, { pen: ANIMALS[row.ref].pen, baby: true, owner: pid }); break;
      case 'pen':
        st.buildings[row.ref] = { owned: true, open: false }; sim.touch('buildings.' + row.ref);
        sim.fx({ k: 'banner', text: `${row.icon} ${row.name} đã xây xong!`, sub: 'Bấm vào chuồng để mua vật nuôi thả vào nhé!', tone: 'good' }); sim.fx({ k: 'confetti' });
        sim.sys('prog').addXp(pid, 25); break;
      case 'furn': addTo(st.inventory.stash, row.ref, 1); sim.touch('inventory.stash'); break;
      case 'hat': p.hats.push(row.ref); p.char.hat = row.ref; sim.touch('players.' + pid); break;
    }
    sim.fx({ k: 'sfx', name: 'buy', to: pid });
    sim.toast(pid, `Đã mua ${row.icon} ${row.name}${qty > 1 ? ' ×' + qty : ''}!${row.kind === 'furn' ? ' Mở 🔨 để đặt.' : ''}`, 'good');
    sim.game({ type: 'buy', pid, kind: row.kind, ref: row.ref, shop });
    return ok();
  }
}
