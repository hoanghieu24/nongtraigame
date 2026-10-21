import { CROPS, CROP_LIST } from '../data/crops.js';
import { ITEMS, PRODUCT_ITEMS } from '../data/items.js';
import { NPCS } from '../data/npcs.js';
import { FURN, FURN_LIST } from '../data/furniture.js';
import { RECIPE_LIST, RECIPES } from '../data/recipes.js';
import { FISH_LIST } from '../data/fish.js';
import { uid } from '../core/util.js';
import { fail, ok } from '../core/result.js';

const BASE = { harvest: 7, plant: 4, water: 3, feed: 6, pet: 4, collect: 9, fish: 14, sell: 4, cook: 22, deliver: 18, coop_water: 6, coop_harvest: 12, chase: 120 };

export const DAILY_REWARDS = [
  { day: 1, title: 'Khởi Đầu Tươi Mới', icon: '🥕', coins: 180, xp: 25, item: 'seed_carrot', qty: 6, desc: '+180🪙 • ×6 Hạt Cà Rốt' },
  { day: 2, title: 'Đàn Gà No Ấm', icon: '🐔', coins: 240, xp: 35, item: 'feed', qty: 8, desc: '+240🪙 • ×8 Thức Ăn Thú' },
  { day: 3, title: 'Cần Thủ Phát Tài', icon: '🎣', coins: 320, xp: 45, item: 'bait', qty: 6, spin: 1, desc: '+320🪙 • ×6 Mồi Câu • +1 Vé Quay' },
  { day: 4, title: 'Mùa Vụ Bội Thu', icon: '🍅', coins: 400, xp: 55, item: 'seed_tomato', qty: 5, fund: 200, desc: '+400🪙 • ×5 Cà Chua • +200🏦' },
  { day: 5, title: 'Vườn Dâu Ngọt Ngào', icon: '🍓', coins: 520, xp: 70, item: 'seed_strawberry', qty: 4, extraItem: 'golden_egg', extraQty: 1, desc: '+520🪙 • ×4 Dâu Tây • 🥚Trứng Vàng' },
  { day: 6, title: 'Tổ Ấm Lung Linh', icon: '🛋️', coins: 680, xp: 90, item: 'seed_pumpkin', qty: 4, furn: 'lamp', desc: '+680🪙 • ×4 Bí Ngô • 💡Đèn Ấm' },
  { day: 7, title: 'Đại Tiệc Cuối Tuần', icon: '👑', coins: 1200, xp: 150, item: 'golden_egg', qty: 2, spin: 2, desc: '+1.200🪙 • ×2 Trứng Vàng • +2 Vé Quay!' },
];

export const DAILY_WHEEL = [
  { id: 'coins_big', icon: '💰', name: 'Túi Vàng Lớn', desc: '+350 🪙 vào ví', coins: 350, xp: 25, color: '#f39c12' },
  { id: 'golden_egg', icon: '🥚', name: 'Trứng Vàng Quý Hiếm', desc: '×1 Trứng Vàng + 150 🪙', coins: 150, xp: 40, item: 'golden_egg', qty: 1, color: '#f1c40f' },
  { id: 'seeds_pack', icon: '🍓', name: 'Giỏ Hạt Giống Quý', desc: '×4 Hạt Dâu Tây + ×4 Hạt Cà Chua', coins: 80, xp: 30, item: 'seed_strawberry', qty: 4, item2: 'seed_tomato', qty2: 4, color: '#2ecc71' },
  { id: 'fund_boost', icon: '🏦', name: 'Tài Trợ Quỹ Gia Đình', desc: '+450 🪙 Quỹ Chung + 100 🪙', coins: 100, fund: 450, xp: 45, color: '#3498db' },
  { id: 'farm_care', icon: '⚡', name: 'Combo Chăm Trang Trại', desc: '×8 Thức Ăn + ×5 Mồi Câu + 60 XP', coins: 120, xp: 60, item: 'feed', qty: 8, item2: 'bait', qty2: 5, color: '#9b59b6' },
  { id: 'jackpot', icon: '👑', name: 'Độc Đắc Nông Trại!', desc: '+800 🪙 + 120 ⭐XP!', coins: 800, xp: 120, color: '#e74c3c' },
];

export const DAILY_CHESTS = [
  { pts: 25, icon: '📦', name: 'Rương Đồng', desc: '+150🪙 • ×4 Hạt Cà Chua', coins: 150, xp: 30, item: 'seed_tomato', qty: 4 },
  { pts: 60, icon: '🥈', name: 'Rương Bạc', desc: '+320🪙 • ×6 Thức Ăn • +50 XP', coins: 320, xp: 50, item: 'feed', qty: 6 },
  { pts: 100, icon: '👑', name: 'Rương Vàng Hôm Nay', desc: '+650🪙 • 🥚Trứng Vàng • +1🎡 Vé Quay', coins: 650, xp: 100, item: 'golden_egg', qty: 1, spin: 1 },
];

export const DAILY_FORTUNES = [
  { icon: '🌟', title: 'Quẻ Đại Cát — Mùa Vụ Bội Thu', desc: 'Mỗi lần thu hoạch có 25% cơ hội nhận thêm 1 nông sản!' },
  { icon: '🍕', title: 'Quẻ Thực Thần — Quán Ăn Đông Khách', desc: 'Phần thưởng ca làm thêm nhà hàng tăng 20% hôm nay!' },
  { icon: '🎣', title: 'Quẻ Thuỷ Tinh — Cá Lớn Cắn Câu', desc: 'Cơ hội gặp cá hiếm tăng 25% hôm nay!' },
  { icon: '🐔', title: 'Quẻ Lục Súc — Chuồng Trại Sung Túc', desc: 'Vật nuôi tạo sản phẩm nhanh hơn 20% hôm nay!' },
  { icon: '💎', title: 'Quẻ Tài Lộc — Vận May Rực Rỡ', desc: 'Mỗi lượt quay hôm nay nhận thêm 100 xu!' },
];

// Cùng một mốc 00:00 Việt Nam cho host ở bất kỳ múi giờ nào.
const dateKey = (now) => new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
const previousDateKey = (key) => new Date(Date.parse(key + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
const weekKey = (key) => { const monday = new Date(key + 'T00:00:00Z'); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7)); return monday.toISOString().slice(0, 10); };

export const WEEKLY_GOALS = [
  { id: 'harvest', title: 'Thu hoạch nông sản', icon: '🌾', target: 24, coins: 360, xp: 35, fund: 180, item: 'seed_carrot', qty: 5, desc: '+360🪙 • +180🏦 • ×5 Hạt Cà Rốt' },
  { id: 'collect', title: 'Thu sản phẩm vật nuôi', icon: '🥚', target: 10, coins: 440, xp: 40, fund: 220, item: 'feed', qty: 5, desc: '+440🪙 • +220🏦 • ×5 Thức Ăn' },
  { id: 'feed', title: 'Cho vật nuôi ăn', icon: '🐔', target: 14, coins: 320, xp: 30, fund: 160, item: 'feed', qty: 6, desc: '+320🪙 • +160🏦 • ×6 Thức Ăn' },
];

// Nhiệm vụ cả nhà (chung) + yêu cầu của hàng xóm + nhiệm vụ co-op + Điểm Danh & Vòng Quay Hằng Ngày.
export class QuestSystem {
  constructor(sim) {
    this.sim = sim; this.id = 'quest';
    this.cmds = {
      deliver: (p, c) => this.deliver(p, c),
      tut: (p, c) => this.tut(p, c),
      dailyClaim: (p) => this.dailyClaim(p),
      dailySpin: (p) => this.dailySpin(p),
      dailyChest: (p, c) => this.dailyChest(p, c),
    };
    sim.bus.on('game', (e) => this.onGame(e));
  }
  newDay() {
    const { sim } = this, st = sim.st, rng = sim.rng, lvl = st.farm.level, many = sim.connected().length >= 2;
    this.refreshCalendar();
    const crops = CROP_LIST.filter((k) => !CROPS[k].rare && !CROPS[k].event && !CROPS[k].only && CROPS[k].lvl <= lvl);
    const hasAnimals = Object.values(st.animals).some((a) => a.type !== 'dog');
    const list = [];
    const mk = (kind, n, extra = {}) => {
      const per = BASE[kind] * n * (1 + lvl * 0.1), coins = Math.round(per), q = { id: uid('q'), kind, n, have: 0, per: {}, done: false, reward: { coins, xp: Math.round(coins / 4) + 5 }, ...extra };
      return q;
    };
    list.push(mk('harvest', rng.int(4, 7) + Math.floor(lvl / 2), { item: rng.pick(crops) }));
    list.push(hasAnimals ? mk(rng.pick(['feed', 'collect', 'pet']), rng.int(3, 5)) : mk('water', rng.int(8, 14)));
    list.push(mk(rng.pick(['fish', 'sell', 'plant', 'water', ...(lvl >= 2 ? ['cook'] : [])]), 0));
    const third = list[2]; third.n = { fish: rng.int(2, 3), sell: rng.int(6, 10), plant: rng.int(8, 12), water: rng.int(10, 16), cook: rng.int(1, 2) }[third.kind];
    third.reward.coins = Math.round(BASE[third.kind] * third.n * (1 + lvl * 0.1)); third.reward.xp = Math.round(third.reward.coins / 4) + 5;
    if (many) {
      const k = rng.pick(['coop_water', 'coop_harvest']), n = k === 'coop_water' ? 20 : 12;
      list.push(mk(k, n, { coop: true })); list[list.length - 1].reward.coins = Math.round(BASE[k] * n * (1 + lvl * 0.1) * 1.4);
    }
    // phần thưởng vật phẩm / nội thất
    for (const q of list) {
      if (rng.chance(0.35)) { const r = rng.pick(['bait', 'feed', 'seed']); q.reward.item = r === 'seed' ? 'seed_' + rng.pick(crops) : r; q.reward.qty = r === 'bait' ? 3 : r === 'feed' ? 6 : 3; }
    }
    const lastQ = list[list.length - 1], cheap = FURN_LIST.filter((k) => !FURN[k].rare && FURN[k].price <= 120 + lvl * 40 && FURN[k].lvl <= lvl);
    if ((many || rng.chance(0.4)) && cheap.length) lastQ.reward.furn = rng.pick(cheap);
    // yêu cầu hàng xóm ("Giúp hàng xóm")
    const npcs = ['grandma', 'farmer', 'fisherman', 'chef'].filter((k) => k !== 'chef' || st.restaurant.unlocked);
    for (const npc of rng.int(0, 1) ? npcs.slice(0, 2) : [rng.pick(npcs)]) {
      const pool = npc === 'fisherman' ? FISH_LIST.filter((f) => f !== 'boot' && FISH_LIST.indexOf(f) < 4) : npc === 'chef' ? ['egg', 'milk', 'tomato', 'wheat'] : npc === 'grandma' ? [...PRODUCT_ITEMS.slice(0, 3), 'carrot', 'potato'] : crops;
      const item = rng.pick(pool), n = rng.int(2, 4), val = ITEMS[item].sell || 20;
      const q = mk('deliver', n, { item, npc }); q.reward.coins = Math.round(val * n * 1.8) + 15; q.reward.xp = 10 + n * 3; list.push(q);
    }
    st.quests = { day: st.world.day, list }; sim.touch('quests');
  }
  onNewDay() { this.newDay(); this.sim.toast(undefined, '📜 Bảng nhiệm vụ đã có việc mới cho cả nhà!', 'good'); }

  refreshCalendar() {
    const { sim } = this, st = sim.st;
    const d = (st.daily ??= { streak: 1, claimedDay: 0, claimDate: '', calendarDate: '', spinTickets: 1, activity: 0, activityTicketClaimed: false, chests: [false, false, false], fortune: 0, lastPrize: '', lastWheelIdx: -1 });
    const today = dateKey(sim.now()), yesterday = previousDateKey(today);
    // Đổi đồng hồ máy về ngày cũ không mở lại phần thưởng đã nhận.
    if (d.calendarDate && today < d.calendarDate) return;
    if (!Array.isArray(d.chests)) d.chests = [false, false, false];
    if (d.calendarDate !== today) {
      if (d.calendarDate) {
        d.streak = d.claimDate === yesterday ? (d.streak || 1) + 1 : 1;
        if ((d.spinTickets || 0) < 5) d.spinTickets = (d.spinTickets || 0) + 1;
      } else d.streak = d.claimDate === yesterday ? Math.max(1, d.streak || 1) : 1;
      d.calendarDate = today;
      d.activity = 0;
      d.activityTicketClaimed = false;
      d.chests = [false, false, false];
      d.arcadeRewards = {};
      d.loveGifts = 0;
      d.fortune = sim.rng.int(0, DAILY_FORTUNES.length - 1);
      sim.touch('daily');
    }
    const week = weekKey(today);
    if (!st.weekly || st.weekly.week !== week || !st.weekly.progress || !Array.isArray(st.weekly.claimed)) {
      st.weekly = { week, progress: { harvest: 0, collect: 0, feed: 0 }, claimed: [], bonusClaimed: false };
      sim.touch('weekly');
    }
  }

  addActivity(points) {
    const { sim } = this, d = sim.st.daily;
    const before = d.activity || 0;
    if (before >= 100) return;
    d.activity = Math.min(100, before + points);
    if (d.activity >= 100 && !d.activityTicketClaimed) {
      d.activityTicketClaimed = true;
      d.spinTickets = (d.spinTickets || 0) + 1;
      sim.fx({ k: 'banner', text: '🎡 Đạt 100 Năng Động!', sub: '+1 vé quay thưởng cho cả nhà', tone: 'good' });
    }
    sim.touch('daily');
  }

  trackWeekly(e) {
    const { sim } = this, st = sim.st;
    const goal = WEEKLY_GOALS.find((g) => g.id === e.type);
    if (!goal || !e.pid) return;
    const w = st.weekly;
    const have = Math.min(goal.target, w.progress[goal.id] || 0);
    if (have >= goal.target) return;
    w.progress[goal.id] = Math.min(goal.target, have + Math.max(1, e.n | 0));
    if (w.progress[goal.id] >= goal.target && !w.claimed.includes(goal.id)) {
      w.claimed.push(goal.id);
      if (goal.fund) { st.economy.fund += goal.fund; sim.touch('economy'); }
      for (const p of Object.values(st.players)) {
        sim.sys('economy').earn(p.id, goal.coins, { bonus: false });
        sim.sys('prog').addXp(p.id, goal.xp);
        sim.addItem(p.id, goal.item, goal.qty);
      }
      sim.fx({ k: 'banner', text: `🏅 Cả nhà hoàn thành: ${goal.title}!`, sub: goal.desc, tone: 'good' });
      sim.fx({ k: 'sfx', name: 'quest' });
      if (WEEKLY_GOALS.every((g) => w.claimed.includes(g.id)) && !w.bonusClaimed) {
        w.bonusClaimed = true;
        for (const p of Object.values(st.players)) {
          sim.sys('economy').earn(p.id, 800, { bonus: false });
          sim.sys('prog').addXp(p.id, 100);
          sim.addItem(p.id, 'golden_egg', 1);
        }
        st.economy.fund += 500; sim.touch('economy');
        sim.fx({ k: 'banner', text: '👑 Hội Chợ Cuối Tuần: đủ bộ!', sub: '+800🪙 +100 XP +🥇 Trứng Vàng cho mỗi người • +500🏦 Quỹ Chung', tone: 'level' });
        sim.fx({ k: 'confetti' });
      }
    }
    sim.touch('weekly');
  }

  dailyClaim(pid) {
    const { sim } = this, st = sim.st;
    this.refreshCalendar();
    const d = st.daily;
    if (d.claimDate === d.calendarDate) return fail('Bạn đã nhận quà điểm danh hôm nay rồi!');
    const idx = ((d.streak || 1) - 1) % DAILY_REWARDS.length;
    const rw = DAILY_REWARDS[idx];
    const streakBonus = Math.round(rw.coins * Math.min(0.35, ((d.streak || 1) - 1) * 0.05));
    const totalCoins = rw.coins + streakBonus;
    d.claimedDay = st.world.day;
    d.claimDate = d.calendarDate;
    if (rw.spin) d.spinTickets = (d.spinTickets || 0) + rw.spin;
    if (rw.fund) { st.economy.fund += rw.fund; sim.touch('economy'); }
    for (const p of Object.values(st.players)) {
      sim.sys('economy').earn(p.id, totalCoins, { bonus: false });
      sim.sys('prog').addXp(p.id, rw.xp);
      if (rw.item) sim.addItem(p.id, rw.item, rw.qty || 1);
      if (rw.extraItem) sim.addItem(p.id, rw.extraItem, rw.extraQty || 1);
    }
    if (rw.furn) { st.inventory.stash[rw.furn] = (st.inventory.stash[rw.furn] || 0) + 1; sim.touch('inventory.stash'); }
    this.addActivity(15);
    sim.touch('daily');
    sim.fx({ k: 'banner', text: `🎁 Điểm Danh Ngày ${rw.day}: ${rw.title}!`, sub: `+${totalCoins} 🪙 +${rw.xp} XP • 🔥 Chuỗi ${d.streak} ngày`, tone: 'good', to: pid });
    sim.fx({ k: 'sfx', name: 'quest', to: pid });
    sim.fx({ k: 'confetti', to: pid });
    return ok();
  }

  dailySpin(pid) {
    const { sim } = this, st = sim.st;
    this.refreshCalendar();
    const d = st.daily;
    if ((d.spinTickets || 0) <= 0) return fail('Hết vé quay hôm nay! Hãy làm nhiệm vụ đạt 100⚡ Năng Động hoặc sang ngày mới nhé.');
    d.spinTickets -= 1;
    const idx = sim.rng.int(0, DAILY_WHEEL.length - 1);
    const pr = DAILY_WHEEL[idx];
    const fortuneBonus = d.fortune === 4 ? 100 : 0;
    d.lastWheelIdx = idx;
    d.lastPrize = `${pr.icon} ${pr.name} (${pr.desc})`;
    if (pr.fund) { st.economy.fund += pr.fund; sim.touch('economy'); }
    for (const p of Object.values(st.players)) {
      if (pr.coins || fortuneBonus) sim.sys('economy').earn(p.id, (pr.coins || 0) + fortuneBonus, { bonus: false });
      if (pr.xp) sim.sys('prog').addXp(p.id, pr.xp);
      if (pr.item) sim.addItem(p.id, pr.item, pr.qty || 1);
      if (pr.item2) sim.addItem(p.id, pr.item2, pr.qty2 || 1);
    }
    sim.touch('daily');
    sim.fx({ k: 'banner', text: `🎡 Trúng thưởng: ${pr.icon} ${pr.name}!`, sub: `${pr.desc}${fortuneBonus ? ' • Quẻ Tài Lộc +100🪙' : ''}`, tone: 'level', to: pid });
    sim.fx({ k: 'sfx', name: 'levelup', to: pid });
    sim.fx({ k: 'confetti', to: pid });
    return ok({ idx, prize: pr });
  }

  dailyChest(pid, { idx }) {
    const { sim } = this, st = sim.st;
    this.refreshCalendar();
    const d = st.daily;
    const i = +idx;
    const ch = DAILY_CHESTS[i];
    if (!ch) return fail('Rương không hợp lệ');
    if (!Array.isArray(d.chests)) d.chests = [false, false, false];
    if (d.chests[i]) return fail('Đã mở rương này rồi!');
    if ((d.activity || 0) < ch.pts) return fail(`Cần đạt ${ch.pts}⚡ Điểm Năng Động (hiện có ${d.activity || 0}⚡)`);
    d.chests[i] = true;
    if (ch.spin) d.spinTickets = (d.spinTickets || 0) + ch.spin;
    for (const p of Object.values(st.players)) {
      sim.sys('economy').earn(p.id, ch.coins, { bonus: false });
      sim.sys('prog').addXp(p.id, ch.xp);
      if (ch.item) sim.addItem(p.id, ch.item, ch.qty || 1);
    }
    sim.touch('daily');
    sim.fx({ k: 'banner', text: `${ch.icon} Mở ${ch.name}!`, sub: ch.desc, tone: 'good', to: pid });
    sim.fx({ k: 'sfx', name: 'quest', to: pid });
    sim.fx({ k: 'confetti', to: pid });
    return ok();
  }

  progress(q, pid, n) {
    q.have += n; q.per[pid] = (q.per[pid] || 0) + n;
    let done = q.have >= q.n;
    if (done && q.coop) done = Object.values(q.per).filter((v) => v >= Math.ceil(q.n * 0.2)).length >= 2;
    if (done) this.finish(q);
  }
  finish(q, only = null) {
    const { sim } = this; q.done = true;
    const who = only ? [sim.st.players[only]] : sim.connected();
    for (const p of who) {
      sim.sys('economy').earn(p.id, q.reward.coins, { bonus: !only });
      sim.sys('prog').addXp(p.id, q.reward.xp);
      if (q.reward.item) sim.addItem(p.id, q.reward.item, q.reward.qty || 1);
    }
    if (q.reward.furn) { sim.st.inventory.stash[q.reward.furn] = (sim.st.inventory.stash[q.reward.furn] || 0) + 1; sim.touch('inventory.stash'); }
    if (sim.st.daily) {
      this.addActivity(15);
    }
    sim.fx({ k: 'banner', text: q.coop ? '🤝 Nhiệm vụ co-op hoàn thành!' : '✅ Nhiệm vụ hoàn thành!', sub: `+${q.reward.coins} 🪙 +${q.reward.xp} XP${q.reward.furn ? ` +${FURN[q.reward.furn].icon}` : ''}`, tone: 'good', to: only || undefined });
    sim.fx({ k: 'sfx', name: 'quest', to: only || undefined }); sim.fx({ k: 'confetti', to: only || undefined });
    sim.touch('quests'); sim.game({ type: 'quest_done', id: q.id });
  }
  onGame(e) {
    const { sim } = this, st = sim.st; this.refreshCalendar(); this.tutor(e); this.trackWeekly(e);
    const actPts = { harvest: 8, plant: 5, water: 4, feed: 7, pet: 6, collect: 8, fish: 14, sell: 6, cook: 16, deliver: 18, chase: 20 }[e.type];
    if (actPts && e.pid && st.daily) this.addActivity(actPts);
    const map = { harvest: ['harvest', 'coop_harvest'], plant: ['plant'], water: ['water', 'coop_water'], feed: ['feed'], pet: ['pet'], collect: ['collect'], fish: ['fish'], sell: ['sell'], cook: ['cook'], chase: ['chase'] }[e.type];
    if (!map || !e.pid) return;
    let touched = false;
    for (const q of st.quests.list) {
      if (q.done || !map.includes(q.kind)) continue;
      if (q.item && q.kind !== 'deliver' && q.item !== e.item) continue;
      this.progress(q, e.pid, e.n || 1); touched = true;
    }
    if (touched) sim.touch('quests');
  }
  deliver(pid, { id }) {
    const { sim } = this, q = sim.st.quests.list.find((x) => x.id === id);
    if (!q || q.kind !== 'deliver' || q.done) return fail('Yêu cầu này không còn');
    const npc = sim.st.npcs[q.npc]; if (!npc || !sim.near(pid, npc.x, npc.z, 6)) return fail(`Lại gần ${NPCS[q.npc].name} nhé!`);
    if (!sim.takeItem(pid, q.item, q.n)) return fail(`Bạn cần ${q.n} ${ITEMS[q.item].icon} ${ITEMS[q.item].name}`);
    q.have = q.n; this.finish(q, pid);
    sim.fx({ k: 'burst', kind: 'hearts', x: npc.x, z: npc.z, y: 2.2, n: 8 }); sim.game({ type: 'deliver', pid, npc: q.npc });
    return ok();
  }
  // ---- hướng dẫn ngắn: 0 di chuyển, 1 cuốc+gieo, 2 tưới, 3 thu hoạch, 4 bán, 5 chăm thú, 6 xong ----
  tutor(e) {
    // Linh hoạt: làm "nhảy bước" vẫn được tính (vd gieo hạt trước khi bấm di chuyển)
    const m = this.sim.st.meta, t = m.tut;
    if (t >= 6) return;
    const step = { plant: 2, water: 3, harvest: 4, sell: 5 }[e.type];
    if (step && t < step) this.advance(step);
    else if (['feed', 'pet', 'collect'].includes(e.type) && t === 5) this.advance(6, true);
  }
  advance(n, reward = false) {
    const { sim } = this, m = sim.st.meta; m.tut = n; sim.touch('meta');
    if (reward) {
      for (const p of sim.connected()) { sim.sys('economy').earn(p.id, 100, { bonus: false }); sim.addItem(p.id, 'seed_tomato', 3); sim.addItem(p.id, 'feed', 5); }
      sim.fx({ k: 'banner', text: '🎓 Hướng dẫn xong rồi!', sub: '+100 🪙, hạt cà chua, thức ăn cho thú. Chúc cả nhà vui!', tone: 'good' }); sim.fx({ k: 'confetti' });
    }
  }
  tut(pid, { step, skip }) {
    const m = this.sim.st.meta;
    if (skip) { m.tut = 6; this.sim.touch('meta'); return ok(); }
    if (step === 1 && m.tut === 0) this.advance(1);
    return ok();
  }
}
