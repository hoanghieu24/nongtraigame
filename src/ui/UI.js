import * as THREE from 'three';
import { fmt, hhmm, esc, clamp } from '../core/util.js';
import { CFG } from '../core/Config.js';
import { ITEMS, CATS, isSellable } from '../data/items.js';
import { CROPS, SEASONS, SEASON_ICONS, fmtGrow, fmtEta, cropEtaSec } from '../data/crops.js';
import { SHOPS, shopCatalog } from '../data/shops.js';
import { FURN, FURN_CATS, FLOORS, WALLS, LIGHTS, HOUSE_LEVELS, RESTAURANT_UPGRADES } from '../data/furniture.js';
import { RECIPES, RECIPE_LIST, RSC_CRATES, RSC_CRATE_LIST } from '../data/recipes.js';
import { FISH, FISH_LIST, RARITY_COLOR, RARITY_NAME } from '../data/fish.js';
import { NPCS, CUSTOMERS } from '../data/npcs.js';
import { WEAPONS } from '../data/weapons.js';
import { HATS, PRESETS } from '../data/characters.js';
import { EVENTS } from '../data/events.js';
import { ANIMALS, STARVE } from '../data/animals.js';
import { questText, QUEST_ICON } from '../data/quests.js';
import { DAILY_REWARDS, DAILY_WHEEL, DAILY_CHESTS, DAILY_FORTUNES, WEEKLY_GOALS } from '../quests/QuestSystem.js';
import { levelProgress } from '../data/levels.js';
import { interiorRoom, REST, inRest, PLOT, plotPos, PENS } from '../data/layout.js';
import { INCUBATE_SECONDS } from '../animals/AnimalSystem.js';
import { countKey, canCook } from '../inventory/Inventory.js';
import { upgradeInfo, stationCount, rscProgress } from '../restaurant/RestaurantSystem.js';
import { expandCost } from '../farming/FarmingSystem.js';
import { guide } from './Guide.js';
import { TOOLS } from '../player/PlayerView.js';
import { Menu } from './Menu.js';
import { CoupleArcade } from './CoupleArcade.js';
import { WEATHER } from '../data/weather.js';
import { VP } from '../core/Viewport.js';
import { foodValue } from '../player/VitalsSystem.js';

const $ = (s, r = document) => r.querySelector(s);
const btn = (a, label, d = '', cls = '') => `<button class="b ${cls}" data-a="${a}" ${d}>${label}</button>`;
const bar = (p, cls = '') => `<i class="bar ${cls}"><u style="width:${clamp(p, 0, 1) * 100}%"></u></i>`;
const _projV = new THREE.Vector3();
const PANEL_TITLES = { arcade: '🎮 Khu Vui Chơi Đôi: Hiếu ❤️ Huyền', daily: '🎁 Điểm Danh & Vòng Quay Mỗi Ngày', emote: '😘 Cảm xúc', pack: '🎒 Túi đồ', shop: '🛒 Cửa hàng', sell: '💰 Bán hàng', quests: '📜 Nhiệm vụ & Năng động', chest: '📦 Rương chung', kitchen: '👨‍🍳 Quán Ăn Làng: Ready, Set, Cook!', house: '🏠 Nâng cấp Nhà & Ruộng', build: '🔨 Xây dựng & Trang trí', settings: '⚙️ Cài đặt & Góc nhìn', chat: '💬 Trò chuyện', dialog: '💬', seeds: '🌱 Chọn hạt giống', room: '🔗 Mời bạn bè' };

const fmtCarry = (c) => {
  if (!c) return 'Tay trống';
  if (c.startsWith('raw:')) { const d = RSC_CRATES[c.slice(4)]; return `${d?.icon || '🥦'} ${d?.name || ''} (Đem thái 🔪)`; }
  if (c.startsWith('prep:')) { const d = RSC_CRATES[c.slice(5)]; return `${d?.prepIcon || '🥗'} ${d?.name || ''} đã thái (Cho vào Bếp 🍳)`; }
  if (c.startsWith('dish_')) { const d = RECIPES[c.slice(5)]; return `${d?.icon || '🍽️'} ${d?.name || ''} (Bưng ra bàn!)`; }
  if (c === 'dirty_plate') return '🍽️💨 Đĩa bẩn (Đem ra Bồn Rửa 🚰)';
  return c;
};

export class UI {
  constructor() {
    this.panel = null; this.params = {}; this.tab = ''; this.sel = ''; this.filter = 'all'; this.lastHtml = ''; this.toastN = 0; this.floatPool = []; this.chatLog = []; this.guideT = 0; this.cropT = 0; this.cache = {}; this.lastSell = null; this.dialogNpc = null; this.dockCollapsed = false; this.spinning = false;
    this.root = $('#app'); this.panelEl = $('#panel'); this.floats = $('#floats'); this.menu = new Menu(this); this.fish = new FishGame(this); this.arcade = new CoupleArcade(this);
    this.panelEl.addEventListener('click', (e) => { const el = e.target.closest('[data-a]'); if (!el || el.disabled) return; if (el.classList.contains('slot') && e.target.closest('.pop')) return; this.act(el.dataset.a, el.dataset, el); });
    this.panelEl.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.vol) {
        this.g.settings[t.dataset.vol] = +t.value / 100;
        this.g.audio.setVol({ [t.dataset.vol]: +t.value / 100 });
        this.g.persistSettings();
      } else if (t.dataset.cam) {
        const k = t.dataset.cam, raw = +t.value;
        const val = k === 'fov' ? raw : raw / 100;
        this.g.setCamPref(k, val);
        const lb = this.panelEl.querySelector(`#lbl_${k}`);
        if (lb) lb.textContent = k === 'fov' ? `${raw}°` : `${raw}%`;
      }
    });
    this.panelEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'chatIn') this.act('send'); });
  }
  bind(g) { this.g = g; this.menu.bind(g); this.buildHud(); }
  typing() { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); }
  // ---------------- HUD ----------------
  buildHud() {
    const h = $('#hud'); h.innerHTML = `
    <div id="hudL">
      <div id="me" class="pill hudCap" data-h="arcade" title="Hồ sơ Hiếu ❤️ Huyền & Khu Vui Chơi Đôi">
        <span id="vAv">🙂</span><b id="vName" class="hidePhone"></b>
        <span class="lvlTag" id="pLvl"><b id="vLvl">Cấp 1</b>${bar(0, 'xp').replace('<i class="bar xp">', '<i class="bar xp" id="vXp">')}</span>
        <small id="vPl" class="hidden"></small><em id="vCoop"></em>
      </div>
      <div class="pill hudCap money" title="Xu cá nhân & Quỹ chung gia đình">
        <span>🪙</span><b id="vMoney">0</b><i class="vSep"></i><span>🏦</span><b id="vFund" class="fundTxt">0</b>
      </div>
      <div class="pill hudCap time" data-h="daily" title="Thời gian & Chuỗi ngày chăm chỉ (Bấm mở Quà Mỗi Ngày)">
        <span id="vWx">☀️</span><b id="vTime">07:00</b><small id="vDay"></small><i class="vSep"></i><span class="streakChip">🔥<b id="vStreak">1</b></span>
      </div>
    </div>
    <div id="vitals" class="pill hudVital" title="Độ no và sức khỏe"><span>🍗</span><i class="bar food"><u id="vFood"></u></i><span>❤️</span><i class="bar hp"><u id="vHp"></u></i></div>
    <div id="hudR">
      <button class="ib giftBtn" data-h="arcade" title="Khu Vui Chơi Đôi Hiếu ❤️ Huyền"><span>🎮</span></button>
      <button class="ib giftBtn" data-h="daily" title="Quà Điểm Danh & Vòng Quay May Mắn"><u id="dDot" class="hidden"></u><span>🎁</span></button>
      <button class="ib" data-h="view" title="Đổi góc nhìn (V)">🎥</button>
      <button class="ib" data-h="zoom" title="Đổi cự ly Camera Gần/Vừa/Xa">🔍</button>
      <button class="ib" data-h="emote" title="Cảm xúc">😊</button>
      <button class="ib" data-h="snd" title="Âm thanh">🔊</button>
      <button class="ib" data-h="set" title="Cài đặt & Góc nhìn">⚙️</button>
      <button class="ib dockTog" id="btnDockTog" data-h="dockTog" title="Thu gọn / Mở rộng thanh nút">▾</button>
    </div>
    <div id="hudStatus"><div id="guide" class="pill hidden" data-h="quests"><span id="gIc">📍</span><b id="gTx"></b><i class="chev">›</i></div><div id="alert" class="pill warn hidden"></div><div id="contest" class="pill hidden"></div></div>
    <div id="dock">
      <button class="ib dk dkGift" data-h="arcade"><span>🎮</span><small>Trò Chơi</small></button>
      <button class="ib dk dkGift" data-h="daily"><u id="dDot2" class="hidden"></u><span>🎁</span><small>Quà</small></button>
      <button class="ib dk" data-h="quests"><u id="qDot" class="hidden"></u><span>📜</span><small>Việc</small></button>
      <button class="ib dk" data-h="pack"><span>🎒</span><small>Túi</small></button>
      <button class="ib dk" data-h="rsc2d"><span>🍕</span><small>Quán</small></button>
      <button class="ib dk" data-h="house"><span>🏠</span><small>Nhà</small></button>
      <button class="ib dk" data-h="build"><span>🔨</span><small>Xây</small></button>
      <button class="ib dk" data-h="chat"><span>💬</span><small>Chat</small></button>
    </div>
    <div id="cropTimers"></div><div id="rscBar" class="rscBar hidden"></div><div id="toolName" class="pill hidden"></div>
    <div id="hotbar">${TOOLS.map((t, i) => `<button class="tool" data-t="${i}"><kbd>${i + 1}</kbd><span id="tool${i}"></span></button>`).join('')}</div><div id="seedChip" class="pill hidden" data-h="seeds"></div>
    <div id="acts">
      <button id="btnInt" class="act2 hidden"><span id="intIc">📦</span><small id="intLb"></small></button>
      <div class="actRow">
        <div class="subActs">
          <button id="btnJump" class="actSub jump" title="Nhảy (Space)"><span>🦘</span><small>Nhảy</small></button>
          <button id="btnSprint" class="actSub sprint" title="Chạy nhanh (Shift)"><span>⚡</span><small>Chạy</small></button>
        </div>
        <button id="btnAct" class="act1"><span>✊</span><small>Làm</small></button>
      </div>
    </div>`;
    h.addEventListener('click', (e) => {
      const rscEl = e.target.closest('[data-rsc]');
      if (rscEl) {
        this.g.audio.sfx('click'); this.buzz();
        const act = rscEl.dataset.rsc;
        if (act === 'panel') this.open('kitchen', { station: 'rest' });
        else if (act === 'shift') this.g.rsc2d?.open();
        else if (act === 'quick') { this.g.local.play('harvest', 0.45); this.send({ type: 'rest.quickStep', guestId: rscEl.dataset.gid || '' }); }
        return;
      }
      const el = e.target.closest('[data-h]'); if (!el) return; const k = el.dataset.h, g = this.g; this.g.audio.sfx('click'); this.buzz();
      if (k === 'dockTog') {
        this.dockCollapsed = !this.dockCollapsed;
        $('#dock')?.classList.toggle('collapsed', this.dockCollapsed);
        el.textContent = this.dockCollapsed ? '☰' : '▾';
        return;
      }
      if (k === 'zoom') g.cycleZoom();
      else if (k === 'view') g.cycleView();
      else if (k === 'rsc2d') g.rsc2d?.open();
      else if (k === 'snd') { g.audio.muted = !g.audio.muted; g.audio.master.gain.value = g.audio.muted ? 0 : g.settings.master; el.textContent = g.audio.muted ? '🔇' : '🔊'; }
      else if (k === 'set') this.toggle('settings');
      else if (k === 'build') g.toggleBuild();
      else if (k === 'emote') this.toggle('emote');
      else if (k === 'daily') this.toggle('daily');
      else if (k === 'arcade') this.toggle('arcade');
      else this.toggle(k);
    });
    $('#hotbar').addEventListener('pointerdown', (e) => { const el = e.target.closest('[data-t]'); if (el) { e.preventDefault(); this.buzz(); this.g.setTool(+el.dataset.t); } });
    $('#sleep').addEventListener('click', (e) => {
      const btnEl = e.target.closest('[data-sleep]');
      if (!btnEl) return;
      this.buzz();
      if (btnEl.dataset.sleep === 'dream') this.g.local.startDream();
      else this.g.local.wakeUp();
    });
    const A = $('#btnAct'); A.addEventListener('pointerdown', (e) => { e.preventDefault(); this.buzz(); this.g.actionHeld = true; this.g.cb_action(); }); addEventListener('pointerup', () => { this.g.actionHeld = false; if (this.g.local) this.g.local.sprintHeld = false; });
    $('#btnInt').addEventListener('pointerdown', (e) => { e.preventDefault(); this.buzz(); this.g.local.interact(); });
    $('#btnJump').addEventListener('pointerdown', (e) => { e.preventDefault(); this.buzz(); this.g.local.jump(); });
    const spBtn = $('#btnSprint');
    spBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.buzz(); this.g.local.sprintHeld = true; this.g.local.toggleSprint(); });
    this.g.cb_action = () => this.g.mode === 'play' && (this.g.build.on ? this.g.placeBuild() : this.g.local.action());
  }
  buzz() { if (this.g.input.mobile) navigator.vibrate?.(9); }
  flashTool(i) {
    const me = this.g.local.me, w = WEAPONS[me?.weapon] || WEAPONS.slipper, names = [['⛏️', 'Cuốc đất'], ['💧', 'Tưới nước'], [CROPS[me?.sel]?.icon || '🌱', 'Gieo hạt'], ['🥣', 'Cho thú ăn'], ['🎣', 'Câu cá'], [w.icon, w.name]], el = $('#toolName');
    el.textContent = `${names[i][0]} ${names[i][1]}`; el.classList.remove('hidden'); clearTimeout(this.tnT); this.tnT = setTimeout(() => el.classList.add('hidden'), 1700);
  }
  enterGame() {
    this.menu.hide(); $('#hud').classList.remove('hidden'); $('#app').classList.add('playing'); this.refreshHotbar(); this.refreshView(); this.close();
    const st = this.g.store.state;
    if (st.daily && (!st.daily.calendarDate || st.daily.claimDate !== st.daily.calendarDate)) {
      setTimeout(() => { if (!this.panel && !this.g.rsc2d?.active) this.open('daily'); }, 650);
    } else if (this.g.session.role === 'host') {
      setTimeout(() => { if (!this.panel && !this.g.rsc2d?.active) this.open('room'); }, 600);
    }
  }
  exitGame() { $('#hud').classList.add('hidden'); $('#app').classList.remove('playing'); this.close(); this.menu.show(); }
  fade() { const f = $('#fade'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 260); }
  refreshView() { const b = $('[data-h="view"]'); if (b) b.textContent = { '3D': '🎥', FP: '👁️', '2D': '🗺️' }[this.g.view]; $('#app').dataset.view = this.g.view; }
  refreshSprint() { const b = $('#btnSprint'); if (b) b.classList.toggle('on', !!(this.g.local?.sprint || this.g.input?.keys.has('Shift'))); }
  refreshHotbar() {
    const g = this.g, me = g.local.me; if (!me) return; const w = WEAPONS[me.weapon] || WEAPONS.slipper, ic = ['⛏️', '💧', CROPS[me.sel]?.icon || '🌱', '🥣', '🎣', w.icon];
    const names = ['Cuốc đất', 'Tưới nước', 'Gieo hạt', 'Cho thú ăn', 'Câu cá', w.name];
    ic.forEach((x, i) => { const el = $('#tool' + i); if (el && el.textContent !== x) el.textContent = x; });
    document.querySelectorAll('.tool').forEach((el, i) => {
      el.classList.toggle('on', g.local.tool === i);
      el.setAttribute('aria-pressed', String(g.local.tool === i));
      el.setAttribute('aria-label', names[i]); el.title = `${names[i]} (${i + 1})`;
    });
    const action = $('#btnAct'), actionLabel = action?.querySelector('small'), actionIcon = action?.querySelector('span');
    const ripe = g.local.plot?.c?.s === 'ripe' && g.local.tool < 3;
    const label = ripe ? 'Thu hoạch' : ['Cuốc', 'Tưới', 'Gieo', 'Cho ăn', 'Thả câu', 'Đánh'][g.local.tool];
    if (actionLabel && actionLabel.textContent !== label) actionLabel.textContent = label;
    if (actionIcon) { const icon = ripe ? '🧺' : ic[g.local.tool]; if (actionIcon.textContent !== icon) actionIcon.textContent = icon; }
    const chip = $('#seedChip'); chip.classList.toggle('hidden', g.local.tool !== 2); const selCrop = CROPS[me.sel];
    const chipText = `🌱 ${selCrop?.name || ''} (${selCrop ? '⏱️' + fmtGrow(selCrop.grow) : ''}) ×${(g.store.state.inventory.players[me.id] || {})['seed_' + me.sel] || 0} ▾`;
    if (chip.textContent !== chipText) chip.textContent = chipText;
  }
  update(dt, ti) {
    const g = this.g, st = g.store.state, me = g.local.me; if (g.mode !== 'play' || !me) return;
    // The kitchen draws its own HUD; the hidden farm HUD does not need DOM work.
    if (g.rsc2d?.active) return;
    const set = (id, v) => { if (this.cache[id] !== v) { this.cache[id] = v; const el = $('#' + id); if (el) el.textContent = v; } };
    const setBar = (id, value) => { const pct = Math.round(clamp(value, 0, 100)); if (this.cache[id] !== pct) { this.cache[id] = pct; const el = $('#' + id); if (el) el.style.width = pct + '%'; } };
    set('vMoney', fmt(me.money)); set('vFund', fmt(st.economy.fund)); const lp = levelProgress(st.farm.xp); set('vLvl', 'Cấp ' + st.farm.level);
    const xpPct = Math.round(lp.pct * 100); if (this.cache.xpPct !== xpPct) { this.cache.xpPct = xpPct; const xp = $('#vXp u'); if (xp) xp.style.width = Math.max(2, xpPct) + '%'; }
    setBar('vFood', me.food ?? 100); setBar('vHp', me.hp ?? 100);
    set('vTime', hhmm(ti.hour)); set('vDay', `N${ti.hour < 6 ? ti.day : ti.day} ${SEASON_ICONS[ti.season]}`); set('vWx', st.world.weather !== 'clear' ? WEATHER[st.world.weather].icon : ti.night ? '🌙' : '☀️'); set('vAv', me.avatar); set('vName', me.name + ((me.sleeping || g.local.inBed) ? ' 💤' : '')); set('vPl', 'Cấp ' + me.level);
    set('vStreak', st.daily?.streak || 1);
    const online = Object.values(st.players).filter((p) => p.connected).length; set('vCoop', online > 1 ? `👥${online}` : '');
    const t = g.local.target, bi = $('#btnInt'); if (t && t.pri < 9) { bi.classList.remove('hidden'); set('intIc', t.icon); set('intLb', t.label); } else bi.classList.add('hidden');
    $('#btnAct').classList.toggle('fishing', !!me.fishing); this.refreshSprint();
    const isLying = !!(g.local.inBed || me.sleeping);
    const sl = $('#sleep'); sl.classList.toggle('hidden', !isLying);
    if (isLying) {
      const active = Object.values(st.players).filter((p) => p.connected);
      const aw = active.filter((p) => !p.sleeping).length;
      set('sleepInfo', aw > 0 ? `Đang ngủ say... Đợi ${aw} người nữa cùng lên giường để qua đêm 🌙` : 'Cả hai đều đang ngủ ngon giấc, trời sắp sáng... ☀️');
    }
    this.guideT -= dt; if (this.guideT <= 0) { this.guideT = 0.35; this.updateGuide(st, me); this.updateAlert(st); this.refreshHotbar(); this.updateContest(st); this.qDot(st); this.updateRscHud(st, me); }
    $('#app').classList.toggle('building', g.build.on); this.marker();
    this.cropT -= dt;
    if (this.cropT <= 0) {
      this.cropT = 0.25;
      this.updateCropTimers(dt, st, ti);
    }
    this.arcade.update(dt);
    if (this.panel && this.panel !== 'arcade') this.livePanel(dt);
    this.fish.update(dt);
    this.updateBuildStat();
  }

  // Thanh Đơn Hàng & Công Thức màu xanh bên dưới màn hình theo đúng giao diện "Ready, Set, Cook!" trên Facebook
  updateRscHud(st, me) {
    const el = $('#rscBar'); if (!el) return;
    const l = this.g.local, r = st.restaurant;
    const nearRest = l.area === 'out' && inRest(l.x, l.z, 6.5);
    const show = (nearRest || r.shift?.active) && !this.g.build.on && !l.inBed;
    el.classList.toggle('hidden', !show);
    if (!show) return;

    const shiftOn = !!r.shift?.active;
    // Chỉ 1 nút nhỏ gọn ở góc màn hình: chạm để vào quán chơi
    const html = `<button class="rscMini ${shiftOn ? 'on' : ''}" data-rsc="shift">👨‍🍳 ${shiftOn ? `+${fmt(r.shift?.earned || 0)}🪙` : 'Vào Quán'}</button>`;
    if (el._last !== html) { el._last = html; el.innerHTML = html; }
  }

  updateGuide(st, me) {
    const g = this.g, l = g.local, r = guide(st, me, l.x, l.z, st.world.t); this.guideTarget = r && r.x != null ? r : null; const el = $('#guide');
    if (!r || g.build.on || l.inBed) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); el.classList.toggle('urgent', !!r.urgent); $('#gIc').textContent = r.icon; $('#gTx').textContent = g.input.mobile ? r.text.replace(/\s*\(phím \d\)/g, '').replace(/phím \d/g, 'nút dụng cụ').replace('Space', 'Hành động') : r.text;
  }
  updateAlert(st) {
    const el = $('#alert'), an = Object.values(st.animals).filter((a) => a.type !== 'dog'), hungry = an.filter((a) => a.hunger > STARVE.hungry), star = an.filter((a) => a.starving > 0).sort((a, b) => b.starving - a.starving)[0];
    if (!hungry.length) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); el.classList.toggle('crit', !!star);
    el.textContent = star ? `🚨 ${star.name} chết đói sau ${Math.max(0, Math.ceil(STARVE.grace - star.starving))}s!` : `🍽️ ${hungry.length} con đang đói — cho ăn nhé`;
  }
  updateContest(st) { const el = $('#contest'), c = st.events.contest, p = st.events.party; const w = c || p; if (!w || st.world.t > w.until) { el.classList.add('hidden'); return; } const sc = Object.entries(w.scores || {}).sort((a, b) => b[1] - a[1]).map(([id, v]) => `${esc(st.players[id]?.name || '?')}: ${v}`).join(' • '); el.classList.remove('hidden'); el.textContent = `${c ? '🎣 Thi câu cá' : '🐔 Bắt gà'} ${Math.max(0, Math.ceil(w.until - st.world.t))}s  ${sc}`; }
  qDot(st) {
    const d = $('#qDot');
    const n = st.quests.list.filter((q) => !q.done).length;
    if (d) { d.classList.toggle('hidden', n === 0); d.textContent = n; }
    const dl = st.daily || {};
    const canClaim = !dl.calendarDate || dl.claimDate !== dl.calendarDate ? 1 : 0;
    const spins = dl.spinTickets || 0;
    const readyChests = DAILY_CHESTS.filter((c, i) => (dl.activity || 0) >= c.pts && !(dl.chests && dl.chests[i])).length;
    const dn = canClaim + spins + readyChests;
    for (const id of ['dDot', 'dDot2']) {
      const el = $('#' + id);
      if (el) { el.classList.toggle('hidden', dn === 0); el.textContent = dn; }
    }
  }
  // Chỉ hiển thị Thanh Tiến Trình + Thời Gian cho cây trồng & tưới nước (tối giản 100% chống lag)
  updateCropTimers(dt, st, ti) {
    const box = $('#cropTimers'); if (!box) return;
    const g = this.g, l = g.local;
    if (g.mode !== 'play' || l.area !== 'out' || g.build.on || l.inBed) {
      if (box.childElementCount > 0) box.innerHTML = '';
      return;
    }
    const cx = PLOT.x0 + PLOT.sp, cz = PLOT.z0 + (st.farm.plotRows - 1) * PLOT.sp * 0.5;
    if (Math.hypot(l.x - cx, l.z - cz) > 15) {
      if (box.childElementCount > 0) box.innerHTML = '';
      return;
    }
    const rain = st.world.weather === 'rain' || st.world.weather === 'storm', wt = st.world.t;
    const maxCropDist = g.input.mobile ? 6.5 : 10.5;
    const activeIds = [];
    for (const id in st.crops) {
      const c = st.crops[id];
      if (!c || !c.crop) continue;
      const p = plotPos(c.r, c.c);
      const d = Math.hypot(p.x - l.x, p.z - l.z);
      const isFocused = l.plot && l.plot.id === id;
      if (d > maxCropDist && !isFocused) continue;
      const scr = this.projectXYZ(p.x, 0.72, p.z);
      if (!scr || scr.x < 20 || scr.x > VP.vw - 20 || scr.y < 30 || scr.y > VP.vh - 30) continue;
      activeIds.push(id);
      let el = box.querySelector(`[data-cid="${id}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'cropTimer';
        el.dataset.cid = id;
        box.appendChild(el);
      }
      const wet = (c.w > wt) || rain;
      const pct = Math.min(100, Math.floor((c.g || 0) * 100));
      el.style.transform = `translate3d(${Math.round(scr.x)}px,${Math.round(scr.y)}px,0) translate(-50%,-100%)`;
      el.classList.toggle('focus', !!isFocused);
      el.classList.toggle('ripe', c.s === 'ripe');
      el.classList.toggle('dry', c.s !== 'ripe' && !wet);
      let html;
      if (c.s === 'ripe') {
        html = `<span class="ctEta ripe">✨ Chín!</span><i class="ctBar"><u style="width:100%"></u></i>`;
      } else {
        const eta = fmtEta(cropEtaSec(c, st, ti));
        html = `<span class="ctEta">⏱️ ${eta} ${wet ? '💧' : '☀️'}</span><i class="ctBar"><u style="width:${pct}%"></u></i>`;
      }
      if (el._last !== html) { el._last = html; el.innerHTML = html; }
    }
    for (let i = box.children.length - 1; i >= 0; i--) {
      const child = box.children[i];
      if (!activeIds.includes(child.dataset.cid)) child.remove();
    }
  }
  marker() {
    const m = $('#marker'), t = this.guideTarget, g = this.g; if (!t || g.build.on || g.mode !== 'play' || g.local.inBed) { m.classList.add('hidden'); return; }
    const v = _projV.set(t.x, 2.6, t.z).project(g.rig.cam), behind = v.z > 1; let x = v.x, y = v.y; if (behind) { x = -x; y = -y; }
    const on = !behind && Math.abs(x) < 0.92 && Math.abs(y) < 0.86; m.classList.remove('hidden'); m.classList.toggle('edge', !on);
    if (!on) { const k = Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.82, 1e-3); x /= k; y /= k; m.style.setProperty('--rot', Math.atan2(-y, x) + 'rad'); } m.style.left = (x * 0.5 + 0.5) * VP.vw + 'px'; m.style.top = (-y * 0.5 + 0.5) * VP.vh + 'px';
    m.textContent = on ? '👇' : '➤';
  }
  // ---------------- toast / banner / float ----------------
  toast(text, tone = 'info') {
    const box = $('#toasts'); if (!box) return; const el = document.createElement('div'); el.className = 'toast ' + tone; el.textContent = text; box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove(); setTimeout(() => el.classList.add('out'), 3600); setTimeout(() => el.remove(), 4000);
  }
  banner(text, sub = '', tone = 'event') { const b = $('#banner'); b.className = 'banner show ' + tone; b.innerHTML = `<b>${esc(text)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`; clearTimeout(this.bt); this.bt = setTimeout(() => b.classList.remove('show'), tone === 'alarm' ? 4800 : 3800); if (tone === 'alarm') this.g.audio.sfx('alarm'); }
  floatEl() { let el = this.floatPool.pop(); if (!el) { if (this.floats.children.length > 36) return null; el = document.createElement('div'); el.className = 'float'; this.floats.appendChild(el); } return el; }
  floatFree(el) { el.style.display = 'none'; this.floatPool.push(el); }
  canvasHeight() { return this.g?.canvas.height || 720; }
  projectXYZ(x, y, z) { const p = _projV.set(x, y, z).project(this.g.rig.cam); if (p.z > 1) return null; return { x: (p.x * 0.5 + 0.5) * VP.vw, y: (-p.y * 0.5 + 0.5) * VP.vh }; }
  project(v) { return this.projectXYZ(v.x, v.y, v.z); }
  chatAdd(m) {
    this.chatLog.push(m); if (this.chatLog.length > 60) this.chatLog.shift(); const f = $('#chatfeed'); const el = document.createElement('div'); el.innerHTML = `<b>${esc(m.name)}</b> ${esc(m.text)}`; f.appendChild(el); while (f.children.length > 4) f.firstChild.remove(); setTimeout(() => el.remove(), 7000);
    if (this.panel === 'chat') this.render(); if (m.from !== this.g.myId) this.g.audio.sfx('pop');
  }
  focusChat() { this.open('chat'); setTimeout(() => $('#chatIn')?.focus(), 50); }
  // ---------------- panel framework ----------------
  open(name, params = {}) {
    this.g.audio.sfx('click'); if (name === 'build' && !this.g.build.on) { this.g.openBuild(); return; }
    if (this.panel === name && JSON.stringify(params) === JSON.stringify(this.params) && name !== 'dialog') { this.close(); return; }
    this.panel = name; this.params = params; this.tab = params.tab || ''; this.sel = ''; this.lastHtml = ''; if (name === 'shop') { const p = params.pen; this.tab = params.tab || (p && !this.g.store.state.buildings[p]?.owned ? 'pens' : SHOPS[params.shop].tabs[0][0]); } if (name === 'kitchen' && params.station === 'rest') this.restTab = params.tab || 'rsc';
    this.panelEl.className = 'panel open p-' + name + (name === 'build' ? ' low' : ''); this.render(true); if (name !== 'chat') $('#chatIn')?.blur();
  }
  toggle(name) { if (name === 'build') return this.g.toggleBuild(); this.panel === name ? this.close() : this.open(name); }
  close() { if (!this.panel) return; const was = this.panel; this.panel = null; this.panelEl.className = 'panel'; this.panelEl.innerHTML = ''; this.lastHtml = ''; if (was === 'build' && this.g.build.on) this.g.closeBuild(); }
  render(force) { if (!this.panel) return; const st = this.g.store.state, me = this.g.local.me; if (!me) return; const fn = this['p_' + this.panel], body = fn ? fn.call(this, st, me) : ''; const title = this.panel === 'dialog' ? `${NPCS[this.dialogNpc]?.icon || ''} ${NPCS[this.dialogNpc]?.name || ''}` : this.panel === 'shop' ? `${SHOPS[this.params.shop].icon} ${SHOPS[this.params.shop].name}` : PANEL_TITLES[this.panel];
    const html = `<div class="ph"><b>${title}</b><span class="coins">🪙 ${fmt(me.money)}</span><button class="x" data-a="close">✕</button></div><div class="pb">${body}</div>`;
    if (html === this.lastHtml && !force) return; this.lastHtml = html; const old = this.panelEl.querySelector('.pb, .strip'), top = old?.scrollTop || 0, left = this.panelEl.querySelector('.strip')?.scrollLeft || 0;
    this.panelEl.innerHTML = html; const nb = this.panelEl.querySelector('.pb'); if (nb) nb.scrollTop = top; const ns = this.panelEl.querySelector('.strip'); if (ns) ns.scrollLeft = left;
  }
  livePanel(dt) { this.pt = (this.pt || 0) - dt; if (this.pt > 0) return; this.pt = 0.35; if (this.panel === 'chat' || this.panel === 'settings' || document.activeElement?.tagName === 'INPUT') return; this.render(); }
  send(c) { return this.g.session.send(c); }
  act(a, d, el) {
    const g = this.g, st = g.store.state, me = g.local.me; g.audio.sfx('click');
    switch (a) {
      case 'slot': this.sel = this.sel === d.key ? '' : d.key; this.render(true); return;
      case 'close': this.close(); break; case 'tab': this.tab = d.v; this.sel = ''; this.render(true); break; case 'filter': this.filter = d.v; this.render(true); break; case 'sel': this.sel = this.sel === d.id ? '' : d.id; this.render(true); break;
      case 'buy': { const r = this.send({ type: 'shop.buy', shop: d.shop, key: d.key, qty: +d.q || 1 }); if (d.key?.startsWith('pen:')) this.tab = 'animals'; break; }
      case 'sellAnimal': this.send({ type: 'shop.sellAnimal', id: d.id }); break;
      case 'incubate': this.send({ type: 'animal.incubate', pen: d.pen || 'coop', animalId: d.aid || null }); break;
      case 'pengate': this.send({ type: 'animal.gate', pen: d.pen || 'coop' }); break;
      case 'sellall': this.send({ type: 'economy.sell', items: 'all', at: this.params.at }); break; case 'sell': this.send({ type: 'economy.sell', items: { [d.id]: +d.n }, at: this.params.at }); break;
      case 'donate': this.send({ type: 'economy.donate', amount: +d.n }); break;
      case 'dep': this.send({ type: 'items.deposit', item: d.id, qty: d.q === 'all' ? 'all' : +d.q || 1 }); this.sel = ''; break; case 'wd': this.send({ type: 'items.withdraw', item: d.id, qty: +d.q || 1 }); this.sel = ''; break; case 'depall': this.send({ type: 'items.deposit', item: 'all' }); break;
      case 'eat': this.send({ type: 'vitals.eat', item: d.id }); this.sel = ''; break;
      case 'seedpick': this.send({ type: 'items.seed', crop: d.id }); this.sel = ''; this.close(); setTimeout(() => this.refreshHotbar(), 120); break;
      case 'weapon': this.send({ type: 'items.weapon', id: d.id }); break; case 'hat': this.send({ type: 'items.hat', id: d.id }); break;
      case 'cook': this.send({ type: 'rest.cook', recipe: d.r, station: d.st }); break; case 'collect': this.send({ type: 'rest.collect', station: d.st }); break;
      case 'unlock': this.send({ type: 'rest.unlock' }); break; case 'upg': this.send({ type: 'rest.upgrade', what: d.w }); break; case 'auto': this.send({ type: 'rest.auto', on: d.on === '1' }); break; case 'rtab': this.restTab = d.v; this.render(true); break;
      case 'shift': g.rsc2d?.open(); this.close(); return;
      case 'grabcrate': g.local.play('harvest', 0.45); this.send({ type: 'rest.grabCrate', crate: d.c }); break;
      case 'useboard': g.local.play('till', 0.45); this.send({ type: 'rest.useBoard', board: d.b }); break;
      case 'usestove': g.local.play('plant', 0.45); this.send({ type: 'rest.useStove', station: d.st, recipe: d.r || '' }); break;
      case 'usepass': g.local.play('carry', 0.45); this.send({ type: 'rest.usePass' }); break;
      case 'usesink': g.local.play('water', 0.5); this.send({ type: 'rest.useSink' }); break;
      case 'usetrash': this.send({ type: 'rest.useTrash' }); break;
      case 'cleartable': g.local.play('harvest', 0.45); this.send({ type: 'rest.clearTable', table: d.tb !== undefined ? +d.tb : undefined }); break;
      case 'serveguest': g.local.play('carry', 0.55); this.send({ type: 'rest.serve', guest: d.g, allowInsideRest: true }); break;
      case 'quickstep': g.local.play('harvest', 0.45); this.send({ type: 'rest.quickStep', guestId: d.g || '' }); break;
      case 'startshift': g.rsc2d?.open(); this.close(); return;
      case 'expand': this.send({ type: 'farm.expand' }); break;
      case 'houseup': this.send({ type: 'furn.upgradeHouse' }); break;
      case 'style': this.send({ type: 'furn.style', kind: d.k, value: d.v }); break;
      case 'openbuild': this.close(); g.openBuild(); break;
      case 'openhouse': if (g.build.on) g.closeBuild(); this.open('house'); return;
      case 'gohouse': if (g.local.area !== 'house') g.local.enterHouse(); else g.local.exitHouse(); this.close(); return;
      case 'cat': this.tab = d.v; this.render(true); break; case 'pick': g.pickBuildItem(d.id); break; case 'rot': g.rotateBuild(); break; case 'place': g.placeBuild(); break; case 'cancel': g.cancelBuild(); break; case 'done': g.closeBuild(); break; case 'move': g.moveSel(); break; case 'remove': g.removeSel(); break;
      case 'gfx': g.setQuality(d.v); this.render(true); break; case 'view': g.setView(d.v); this.render(true); break;
      case 'zoomcam': g.cycleZoom(); this.render(true); return;
      case 'resetcam': g.resetCamPrefs(); this.toast('Đã đặt lại góc nhìn gần & độ mượt chuẩn HD!', 'good'); this.render(true); return;
      case 'copy': navigator.clipboard?.writeText(g.session.code).then(() => this.toast('Đã chép mã phòng: ' + g.session.code, 'good')); break;
      case 'copylink': {
        const link = `${location.origin}${location.pathname}?join=${g.session.code}`;
        navigator.clipboard?.writeText(link).then(() => this.toast('🔗 Đã chép Link Mời Bạn Bè! Gửi qua Zalo/Messenger nhé!', 'good'));
        break;
      }
      case 'exportjson': g.persist(false); g.save.exportFile(g.session.code); this.toast('💾 Đã tải file backup (.json) về máy!', 'good'); break;
      case 'dev': this.send({ type: 'event.debug', ev: d.t }); break; case 'sellfisher': this.send({ type: 'economy.sell', items: 'all', at: 'fisher' }); break;
      case 'savenow': g.persist(false); this.toast('☁️ Đã lưu nông trại lên Cloud & Máy!', 'good'); break; case 'menu': g.backToMenu(); break; case 'full': g.fullscreen(); break; case 'skiptut': this.send({ type: 'quest.tut', skip: true }); break;
      case 'send': { const i = $('#chatIn'); if (i && i.value.trim()) { g.session.sendChat(i.value.trim()); i.value = ''; } break; }
      case 'emote': g.local.doEmote(d.anim, 2.4); g.session.sendChat(d.e); if (this.panel === 'emote') this.close(); break;
      case 'deliver': this.send({ type: 'quest.deliver', id: d.id }); break; case 'shopOpen': this.open('shop', { shop: d.shop }); break;
      case 'dailyClaim': this.send({ type: 'quest.dailyClaim' }); this.qDot(st); break;
      case 'dailyChest': this.send({ type: 'quest.dailyChest', idx: +d.idx }); this.qDot(st); break;
      case 'dailySpin': {
        if (this.spinning) return;
        this.spinning = true;
        let step = 0;
        const cards = this.panelEl.querySelectorAll('.wheelCard');
        const spinIv = setInterval(() => {
          cards.forEach((c, idx) => c.classList.toggle('spinHi', idx === step % Math.max(1, cards.length)));
          g.audio.sfx('click');
          step++;
          if (step >= 10) {
            clearInterval(spinIv);
            this.spinning = false;
            this.send({ type: 'quest.dailySpin' });
            this.qDot(st);
            setTimeout(() => this.render(true), 80);
          }
        }, 65);
        return;
      }
      case 'switchChar': {
        const who = d.who;
        const newName = who === 'huyen' ? 'Huyền' : 'Hiếu';
        const preset = who === 'huyen' ? 1 : 0;
        const p = g.save.profile() || {};
        p.name = newName;
        p.preset = preset;
        g.save.saveProfile(p);
        if (me) {
          me.name = newName;
          me.char = { preset, hat: who === 'huyen' ? 'flower' : 'cap' };
          g.store.state.players[me.id].name = newName;
          g.store.state.players[me.id].char = me.char;
          g.store.touch('players.' + me.id);
        }
        this.toast(`Đã đổi nhân vật thành ${newName} ${who === 'huyen' ? '💖' : '💙'}!`, 'good');
        this.render(true);
        return;
      }
      case 'openDaily': this.open('daily'); return;
      case 'openQuests': this.open('quests'); return;
      case 'openArcade': this.open('arcade'); return;
      case 'talk': this.dialogLine = null; this.render(true); break;
      default:
        if (a && a.startsWith('arc')) {
          if (this.arcade.act(a, d)) return;
        }
        break;
    }
    setTimeout(() => this.render(true), 90);
  }
  p_arcade(st, me) {
    return this.arcade.render(st, me);
  }
  // ---------------- nội dung panel ----------------
  p_pack(st, me) {
    const bag = st.inventory.players[me.id] || {}, tab = this.tab || 'items', tabs = [['items', 'Đồ'], ['dex', 'Sổ cá'], ['gear', 'Mũ & vũ khí']];
    let h = `<div class="tabs">${tabs.map(([k, n]) => btn('tab', n, `data-v="${k}"`, tab === k ? 'on' : '')).join('')}</div>`;
    if (tab === 'dex') { h += `<div class="dex">${FISH_LIST.map((id) => { const f = FISH[id], n = me.dex[id]; return `<div class="card ${n ? '' : 'dim'}"><span class="ti big">${n ? f.icon : '❓'}</span><b>${n ? f.name : '???'}</b><small style="color:${RARITY_COLOR[f.rarity]}">${RARITY_NAME[f.rarity]}</small><small>${n ? `Bắt ${n} lần • ${f.value}🪙` : 'Chưa bắt được'}</small></div >`; }).join('')}</div>`; return h; }
    if (tab === 'gear') return h + `<h4>Vũ khí đuổi trộm (phím 6)</h4><div class="row wrap">${me.weapons.map((w) => `<button class="card pick ${me.weapon === w ? 'on' : ''}" data-a="weapon" data-id="${w}"><span class="ti big">${WEAPONS[w].icon}</span><b>${WEAPONS[w].name}</b><small>Tầm ${WEAPONS[w].reach} • choáng ${WEAPONS[w].stun}s</small></button>`).join('')}</div><h4>Mũ nón</h4><div class="row wrap">${me.hats.map((x) => `<button class="card pick ${me.char.hat === x ? 'on' : ''}" data-a="hat" data-id="${x}"><span class="ti big">${HATS[x].icon}</span><b>${HATS[x].name}</b></button>`).join('')}</div><small class="hint">Mua thêm mũ ở Tạp Hóa Cô Mai hoặc phục vụ 3 món ở Quán Ăn Làng để nhận Mũ Đầu Bếp 👨‍🍳!</small>`;
    h += `<div class="mc"><h5>🎒 Túi đồ <small>🔥 hôm nay: ${ITEMS[st.economy.hot]?.icon || ''} ${ITEMS[st.economy.hot]?.name || ''} ×1.5</small></h5>${this.slotsHtml(this.stacks(bag), 'bag', st, me)}</div><small class="hint">Chạm vào một ô để mở menu thao tác (bật lên phía trên ô).</small>`;
    return h;
  }
  stacks(bag) {
    const out = [], ids = Object.keys(bag).filter((k) => ITEMS[k] && bag[k] > 0).sort((a, b) => (ITEMS[a].cat === ITEMS[b].cat ? (a > b ? 1 : -1) : ITEMS[a].cat > ITEMS[b].cat ? 1 : -1));
    for (const id of ids) { let n = bag[id]; while (n > 0) { out.push({ id, n: Math.min(n, 99), total: bag[id] }); n -= 99; } } return out;
  }
  slotsHtml(stacks, src, st, me, min = 27) {
    const total = Math.max(min, Math.ceil(stacks.length / 9) * 9); let h = '<div class="slots">';
    for (let i = 0; i < total; i++) {
      const s = stacks[i], row = Math.floor(i / 9), col = i % 9, cls = `slot${s ? '' : ' empty'}${row === 0 ? ' r0' : ''} c${col}`;
      if (!s) { h += `<div class="${cls}"></div>`; continue; }
      const key = `${src}:${s.id}:${i}`, sel = this.sel === key;
      h += `<div class="${cls}${sel ? ' sel' : ''}" data-a="slot" data-key="${key}"><span>${ITEMS[s.id].icon}</span>${ITEMS[s.id].sub ? `<em>${ITEMS[s.id].sub}</em>` : ''}${s.n > 1 ? `<i>${s.n}</i>` : ''}${sel ? this.popHtml(s, src, st) : ''}</div>`;
    }
    return h + '</div>';
  }
  popHtml(s, src, st) {
    const it = ITEMS[s.id], hot = st.economy.hot === s.id, info = it.cat === 'seed' && CROPS[it.crop] ? `⏱️ Chín: ${fmtGrow(CROPS[it.crop].grow)} • Bán ${CROPS[it.crop].sell}🪙` : isSellable(s.id) ? `Bán ~${Math.round(it.sell * (hot ? 1.5 : 1))}🪙${hot ? ' 🔥' : ''}` : it.desc || '';
    let b;
    if (this.panel === 'chest') b = src === 'bag' ? ['1', '10', 'all'].map((q) => `<button class="b sm" data-a="dep" data-id="${s.id}" data-q="${q}">→ Rương ${q === 'all' ? 'hết' : '×' + q}</button>`).join('') : ['1', '10', String(s.total)].map((q, i) => `<button class="b sm" data-a="wd" data-id="${s.id}" data-q="${q}">← Lấy ${i === 2 ? 'hết' : '×' + q}</button>`).join('');
    else b = `${it.cat === 'seed' ? `<button class="b sm" data-a="seedpick" data-id="${it.crop}">🌱 Chọn để gieo</button>` : ''}${src === 'bag' && foodValue(s.id) ? `<button class="b sm go" data-a="eat" data-id="${s.id}">🍴 Ăn ×1</button>` : ''}<button class="b sm ghost" data-a="dep" data-id="${s.id}" data-q="all">📦 Gửi vào rương</button>`;
    return `<div class="pop"><b>${it.icon} ${it.name}</b><small>×${s.total} ${info}</small>${b}</div>`;
  }
  p_seeds(st, me) {
    const bag = st.inventory.players[me.id] || {}, ids = Object.keys(bag).filter((k) => k.startsWith('seed_') && bag[k] > 0);
    if (!ids.length) return '<p class="empty">Hết hạt giống! Mua ở Cửa hàng Hạt Giống (Làng) hoặc Tí Shipper 🛵</p>';
    return `<div class="note">⏱️ Chọn loại hạt giống bên dưới để xem thời gian chín và gieo trồng (tưới nước đầy đủ cây sẽ chín đúng giờ):</div><div class="cards">${ids.map((k) => {
      const cid = ITEMS[k].crop, c = CROPS[cid], inSeason = !c.seasons || c.seasons.includes(st.world.season);
      return `<button class="card pick ${me.sel === cid ? 'on' : ''}" data-a="seedpick" data-id="${cid}"><span class="ti big">${c.icon}</span><b>${c.name} (×${bag[k]})</b><small class="okc">⏱️ Chín: ${fmtGrow(c.grow)}${inSeason ? ' 🌸' : ''}</small><small>Thu hoạch bán: 🪙${c.sell}${c.regrow ? ' • Mọc lại' : ''}</small></button>`;
    }).join('')}</div>`;
  }
  p_shop(st, me) {
    const shop = this.params.shop, def = SHOPS[shop], rows = shopCatalog(shop, st), tab = this.tab || def.tabs[0][0];
    let h = `<div class="tabs">${def.tabs.map(([k, n]) => btn('tab', n, `data-v="${k}"`, tab === k ? 'on' : '')).join('')}</div>${shop === 'seed' ? '<div class="note">' + SEASONS[st.world.season] + ' ' + SEASON_ICONS[st.world.season] + ' — cây đúng mùa lớn nhanh hơn</div>' : ''}`;
    if (shop === 'animal' && tab !== 'sell') {
      const focusPen = this.params.pen || 'coop';
      const P = PENS[focusPen] || PENS.coop, b = st.buildings[focusPen] || {};
      const allAn = Object.values(st.animals), inPen = allAn.filter((a) => a.pen === focusPen);
      const coopB = st.buildings.coop || {}, coopAn = allAn.filter((a) => a.pen === 'coop');
      const readyHens = coopAn.filter((a) => a.ready), babyChicks = coopAn.filter((a) => (a.growth ?? 1) < 0.85);
      const bag = st.inventory.players[me.id] || {}, bagEggs = (bag.egg || 0) + (bag.golden_egg || 0) + (st.inventory.chest.egg || 0) + (st.inventory.chest.golden_egg || 0);
      const canInc = !coopB.inc && coopAn.length < PENS.coop.cap && (readyHens.length > 0 || bagEggs > 0);
      h += `<div class="mc"><h5>🐣 Chuồng Gà & Lồng Ấp Trứng <small>(${coopAn.length}/${PENS.coop.cap} con • ${babyChicks.length} gà con 🐥 • Cửa: ${coopB.open ? 'Đang mở 🔓' : 'Đang đóng 🔒 (Gà ở trong chuồng)'})</small></h5>`;
      if (coopB.inc) {
        const incLeft = Math.max(0, coopB.inc.t ?? coopB.inc.left ?? 0);
        const incDur = Math.max(1, coopB.inc.max || coopB.inc.dur || INCUBATE_SECONDS);
        const pct = clamp(1 - incLeft / incDur, 0, 1);
        h += `<div class="note">🐣 <b>Lồng ấp đèn sưởi đang ấp trứng:</b> nở ra Gà Con sau <b>${Math.ceil(incLeft)}s</b> ${bar(pct)}</div>`;
      } else {
        h += `<small>Gà ăn no (🥣) sẽ đẻ trứng vào ổ rơm (🥚 đang có <b>${readyHens.length}</b> ổ trứng mới đẻ, <b>${bagEggs}</b> trứng trong túi/rương). Bạn có thể lấy trứng bán hoặc <b>ấp nở thành Gà Con</b>!</small>`;
      }
      const incBtnLeft = Math.ceil(Math.max(0, coopB.inc?.t ?? coopB.inc?.left ?? 0));
      h += `<div class="row wrap">${btn('incubate', coopB.inc ? `🐣 Đang ấp (${incBtnLeft}s)...` : `🐣 Ấp trứng nở Gà Con (${INCUBATE_SECONDS}s)`, 'data-pen="coop"', canInc ? 'sm go' : 'sm off')}${btn('pengate', coopB.open ? '🔒 Đóng cửa Chuồng Gà' : '🔓 Mở cửa thả gà dạo sân', 'data-pen="coop"', 'sm ghost')}</div></div>`;
      if (focusPen !== 'coop' && PENS[focusPen]) {
        h += `<div class="note">📍 Bạn đang đứng cạnh <b>${P.name}</b>: ${b.owned ? `Đã mở (${inPen.length}/${P.cap} con) • Cửa ${b.open ? 'Đang mở 🔓' : 'Đang đóng 🔒'} ${btn('pengate', b.open ? '🔒 Đóng cửa' : '🔓 Mở cửa', `data-pen="${focusPen}"`, 'sm ghost')}` : 'Chưa mở khóa — bấm mua ở tab 🏠 Xây Chuồng bên dưới để sử dụng ngay!'}</div>`;
      }
    }
    if (shop === 'animal' && tab === 'sell') h += '<div class="note">🐾 Bán vật nuôi tại Cửa Hàng Thú Cưng trong Làng. Thú con giá thấp hơn; thú Vàng và thú được chăm tốt có giá cao hơn.</div>';
    h += '<div class="cards">';
    const visibleRows = rows.filter((x) => x.tab === tab);
    if (shop === 'animal' && tab === 'sell' && !visibleRows.length) h += '<p class="empty">Chưa có vật nuôi để bán. Mua thú hoặc ấp trứng để nuôi thêm nhé!</p>';
    for (const r of visibleRows) {
      const animalSell = r.kind === 'animalSell', itemName = animalSell ? esc(r.name) : r.name;
      const can = animalSell || (!r.locked && !r.owned && (r.pay === 'fund' ? st.economy.fund + me.money >= r.price : me.money >= r.price)), multi = r.kind === 'seed' || r.kind === 'goods';
      const isFocus = this.params.pen && (r.key === 'pen:' + this.params.pen || r.pen === this.params.pen);
      h += `<div class="card shopc ${r.locked ? 'dim' : ''} ${isFocus ? 'on' : ''}"><span class="ti big">${r.icon}</span><b>${itemName}</b><small>${r.desc || ''}</small>${r.note ? `<small class="warnt">${r.note}</small>` : ''}<div class="price">${animalSell ? `Nhận ${fmt(r.price)} 🪙` : r.owned ? '✔ Đã mở' : `${fmt(r.price)} 🪙${r.pay === 'fund' ? ' (Quỹ+Ví) 🏦' : ''}`}</div>${r.locked ? `<small class="lock">🔒 ${r.reason}</small>` : r.owned ? '' : animalSell ? `<div class="row">${btn('sellAnimal', 'Đem bán', `data-id="${esc(r.ref)}"`, 'go')}</div>` : `<div class="row">${btn('buy', 'Mua ngay', `data-shop="${shop}" data-key="${r.key}" data-q="1"`, can ? 'go' : 'off')}${multi && can ? btn('buy', '×5', `data-shop="${shop}" data-key="${r.key}" data-q="5"`, 'ghost') : ''}</div>`}</div>`;
    }
    h += '</div>'; if (shop === 'animal' && tab === 'animals') h += '<small class="hint">💡 Mẹo: Khi đóng cửa chuồng (🔒), gà và thú sẽ ở yên trong chuồng không chạy ra ngoài. Cho gà ăn no để đẻ trứng và ấp nở Gà Con!</small>'; if (shop === 'animal' && tab === 'sell') h += '<small class="hint">Cần đứng gần Cửa Hàng Thú Cưng ở Làng để hoàn tất giao dịch. Cún đồng hành không bán được.</small>'; return h;
  }
  p_sell(st, me) {
    const at = this.params.at, bag = st.inventory.players[me.id] || {}, mult = at === 'market' ? 1.1 : 1, ids = Object.keys(bag).filter((id) => isSellable(id)), hot = st.economy.hot;
    let tot = 0; for (const id of ids) if (ITEMS[id].cat !== 'dish') tot += Math.round(ITEMS[id].sell * (id === hot ? 1.5 : 1) * mult) * bag[id];
    let h = `<div class="note">${at === 'market' ? 'Quầy chợ trả +10%' : 'Quầy Cửa hàng trước nhà'} • mỗi lần bán, Quỹ Chung nhận thêm 15% 🏦</div>${btn('sellall', `Bán tất cả (~${fmt(tot)} 🪙)`, '', tot ? '' : 'off')}<div class="list">`;
    for (const id of ids) { const it = ITEMS[id], p = Math.round(it.sell * (id === hot ? 1.5 : 1) * mult); h += `<div class="li"><span class="ti">${it.icon}</span><b>${it.name}${id === hot ? ' 🔥' : ''}</b><small>×${bag[id]} • ${p}🪙</small>${btn('sell', 'Bán 1', `data-id="${id}" data-n="1"`, 'sm')}${bag[id] > 1 ? btn('sell', 'Hết', `data-id="${id}" data-n="${bag[id]}"`, 'sm ghost') : ''}</div>`; }
    return h + (ids.length ? '' : '<p class="empty">Chưa có nông sản để bán</p>') + '</div>';
  }
  p_chest(st, me) {
    const bag = st.inventory.players[me.id] || {}, chest = st.inventory.chest, cs = this.stacks(chest);
    return `<div class="mc"><h5>📦 Rương chung <small>${cs.length} ô dùng</small></h5>${this.slotsHtml(cs, 'chest', st, me)}</div><div class="mc"><h5>🎒 Túi của bạn</h5>${this.slotsHtml(this.stacks(bag), 'bag', st, me)}</div>
      <div class="row">${btn('depall', '📥 Gửi hết đồ vào rương', '', 'sm')}</div><small class="hint">Chạm ô để chọn số lượng chuyển. Nguyên liệu trong rương dùng chung để nấu ăn (⚠️ trộm cũng nhòm ngó rương).</small>
      <div class="fundbox"><b>🏦 Quỹ chung: ${fmt(st.economy.fund)} 🪙</b><small>Xây chuồng, nâng nhà, mở rộng ruộng, mở nhà hàng</small><div class="row">${[50, 200, 1000].map((n) => btn('donate', `+${n}`, `data-n="${n}"`, me.money >= n ? 'sm' : 'sm off')).join('')}</div></div>`;
  }
  p_emote() {
    const E = [['😘', 'kiss', 'Hôn gió'], ['💋', 'kiss', 'Hôn'], ['❤️', 'wave', 'Yêu'], ['🥰', 'celebrate', 'Mê quá'], ['😍', 'surprised', 'Wow'], ['💕', 'wave', 'Tim tim'], ['🤗', 'hug', 'Ôm'], ['🫂', 'hug', 'Ôm nhau'], ['😂', 'celebrate', 'Haha'], ['😭', 'sad', 'Hu hu'], ['😮', 'surprised', 'Ồ'], ['👍', 'celebrate', 'Tuyệt'], ['🎉', 'celebrate', 'Ăn mừng']];
    return `<div class="emotes">${E.map(([e, a, n]) => `<button class="emo" data-a="emote" data-e="${e}" data-anim="${a}"><span>${e}</span><small>${n}</small></button>`).join('')}</div><small class="hint">Gửi cho người chơi cùng — hiện trên đầu nhân vật.</small>`;
  }

  // ---------------- Bảng Điểm Danh 7 Ngày, Vòng Quay May Mắn & Rương Năng Động ----------------
  weeklyBoard(st) {
    const w = st.weekly || { progress: {}, claimed: [], bonusClaimed: false };
    const cards = WEEKLY_GOALS.map((g) => {
      const have = clamp(w.progress?.[g.id] || 0, 0, g.target), done = (w.claimed || []).includes(g.id);
      return `<div class="weeklyGoal ${done ? 'done' : ''}"><span>${done ? '✅' : g.icon}</span><div><b>${g.title} <small>${have}/${g.target}</small></b>${bar(have / g.target, 'xp')}<small>${g.desc}</small></div></div>`;
    }).join('');
    const finished = WEEKLY_GOALS.every((g) => (w.claimed || []).includes(g.id));
    return `<section class="weeklyBoard"><div class="weeklyHead"><b>🏅 Hội Chợ Cuối Tuần</b><small>Cả nhà cùng góp tiến độ • đổi mục tiêu vào thứ Hai</small></div><div class="weeklyGrid">${cards}</div><div class="weeklyBonus ${w.bonusClaimed ? 'done' : ''}">${w.bonusClaimed ? '👑 Đã nhận quà lớn tuần này!' : finished ? '🎁 Đang trao quà cuối tuần...' : '🎁 Đủ 3 mốc: mỗi người nhận Trứng Vàng + 800🪙, Quỹ Chung +500🏦'}</div></section>`;
  }

  p_daily(st) {
    const d = st.daily || { streak: 1, claimedDay: 0, spinTickets: 1, activity: 0, chests: [false, false, false], fortune: 0, lastPrize: '', lastWheelIdx: -1 };
    const streak = d.streak || 1;
    const claimedToday = !!d.calendarDate && d.claimDate === d.calendarDate;
    const curIdx = (streak - 1) % DAILY_REWARDS.length;
    const fort = DAILY_FORTUNES[(d.fortune || 0) % DAILY_FORTUNES.length];
    const bonusPct = Math.min(35, (streak - 1) * 5);
    const hotItem = ITEMS[st.economy.hot];

    let h = `<div class="tabs">${btn('openDaily', '🎁 Điểm Danh & Vòng Quay', '', 'on')}${btn('openQuests', '📜 Nhiệm Vụ Hôm Nay', '', 'ghost')}</div>`;

    // 1. Banner Chuỗi Ngày & Quẻ Lộc Hôm Nay
    h += `<div class="dailyHero">
      <div class="dhLeft">
        <span class="dhFire">🔥</span>
        <div>
          <b>Chuỗi ${streak} Ngày Chăm Chỉ! ${bonusPct > 0 ? `<span class="dhBonus">+${bonusPct}% Xu Thưởng</span>` : ''}</b>
          <small>${fort.icon} <b>${fort.title}:</b> ${fort.desc}</small>
          ${hotItem ? `<small class="dhHot">🔥 Nông sản giá cao hôm nay: <b>${hotItem.icon} ${hotItem.name} (Bán ×1.5 giá!)</b></small>` : ''}
        </div>
      </div>
      ${btn('dailyClaim', claimedToday ? '✅ Đã Điểm Danh' : `🎁 Nhận Quà Ngày ${(curIdx + 1)}!`, '', claimedToday ? 'sm off' : 'go pulseBtn')}
    </div>`;

    h += this.weeklyBoard(st);

    // 2. Lịch Điểm Danh 7 Ngày
    h += `<h4>📅 Lịch Quà Điểm Danh 7 Ngày <small>(Vào chơi mỗi ngày để nhận đủ bộ quà Chủ Nhật 👑)</small></h4>`;
    h += `<div class="dailyGrid">${DAILY_REWARDS.map((r, idx) => {
      const isPast = idx < curIdx || (idx === curIdx && claimedToday);
      const isToday = idx === curIdx && !claimedToday;
      const isDay7 = idx === 6;
      return `<div class="dCard ${isPast ? 'claimed' : ''} ${isToday ? 'today' : ''} ${isDay7 ? 'day7' : ''}" ${isToday ? 'data-a="dailyClaim"' : ''}>
        <small class="dDay">Ngày ${r.day}</small>
        <span class="dIcon">${isPast ? '✅' : r.icon}</span>
        <b>${r.title}</b>
        <small class="dDesc">${r.desc}</small>
        ${isToday ? '<span class="dBadge">NHẬN NGAY!</span>' : isPast ? '<span class="dBadge ok">Đã nhận</span>' : ''}
      </div>`;
    }).join('')}</div>`;

    // 3. Rương Năng Động Hằng Ngày (25⚡ / 60⚡ / 100⚡)
    const actPts = clamp(d.activity || 0, 0, 100);
    h += `<h4>⚡ Điểm Năng Động Hôm Nay: <b>${actPts}/100⚡</b> <small>(Trồng cây, chăm thú, câu cá, nấu ăn để mở 3 Rương)</small></h4>`;
    h += `<div class="actTrack">${bar(actPts / 100, 'xp')}<div class="chestRow">${DAILY_CHESTS.map((ch, i) => {
      const opened = d.chests && d.chests[i];
      const ready = actPts >= ch.pts && !opened;
      return `<button class="chestCard ${opened ? 'opened' : ''} ${ready ? 'ready' : ''}" data-a="dailyChest" data-idx="${i}" ${!ready ? 'disabled' : ''}>
        <span class="chIc">${opened ? '✅' : ch.icon}</span>
        <div><b>${ch.name} (${ch.pts}⚡)</b><small>${ch.desc}</small></div>
        <span class="chBtn">${opened ? 'Đã mở' : ready ? '🎁 MỞ!' : `${actPts}/${ch.pts}⚡`}</span>
      </button>`;
    }).join('')}</div></div>`;

    // 4. Vòng Quay May Mắn Hằng Ngày
    const spins = d.spinTickets || 0;
    h += `<h4>🎡 Vòng Quay May Mắn <small>(Còn <b>${spins}</b> vé quay • Đạt 100⚡ hoặc 2⭐ Quán Ăn để nhận thêm vé!)</small></h4>`;
    h += `<div class="wheelWrap">
      <div class="wheelGrid">${DAILY_WHEEL.map((w, idx) => `
        <div class="wheelCard ${d.lastWheelIdx === idx ? 'won' : ''}" style="--wc:${w.color}">
          <span class="wIc">${w.icon}</span>
          <b>${w.name}</b>
          <small>${w.desc}</small>
        </div>`).join('')}
      </div>
      <div class="wheelFoot">
        ${btn('dailySpin', spins > 0 ? `🎡 QUAY THƯỞNG NGAY (Còn ${spins} vé)` : '🔒 Hết vé quay (Làm nhiệm vụ nhận thêm vé!)', '', spins > 0 ? 'go wide pulseBtn' : 'off wide')}
        ${d.lastPrize ? `<small class="lastPrize">🎉 Giải vừa trúng: <b>${esc(d.lastPrize)}</b></small>` : ''}
      </div>
    </div>`;
    return h;
  }

  p_quests(st, me) {
    const d = st.daily || {};
    const actPts = clamp(d.activity || 0, 0, 100);
    const canClaim = !d.calendarDate || d.claimDate !== d.calendarDate || (d.spinTickets || 0) > 0 || DAILY_CHESTS.some((c, i) => actPts >= c.pts && !(d.chests && d.chests[i]));
    const topTabs = `<div class="tabs">${btn('openQuests', '📜 Nhiệm Vụ Hôm Nay', '', 'on')}${btn('openDaily', `🎁 Điểm Danh & Vòng Quay ${canClaim ? '🔴' : ''}`, '', 'ghost')}</div>`;
    const actBanner = `<div class="note" style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span>🔥 Chuỗi <b>${d.streak || 1} ngày</b> • ⚡ Năng động: <b>${actPts}/100⚡</b></span>${btn('openDaily', '🎁 Mở Rương & Quay Thưởng', '', 'sm go')}</div>`;
    const tut = st.meta.tut < 6 ? `<div class="note">🎓 Hướng dẫn: bước ${st.meta.tut + 1}/6 ${btn('skiptut', 'Bỏ qua', '', 'sm ghost')}</div>` : '', bag = st.inventory.players[me.id] || {};
    const list = st.quests.list.map((q) => { const p = q.have / q.n, rw = q.reward; return `<div class="quest ${q.done ? 'done' : ''}"><span class="ti">${q.done ? '✅' : QUEST_ICON[q.kind] || '📜'}</span><div><b>${questText(q)}${q.coop ? ' 🤝' : ''}</b>${bar(p)}<small>${Math.min(q.have, q.n)}/${q.n} • thưởng 🪙${rw.coins} ⭐${rw.xp}${rw.item ? ' ' + ITEMS[rw.item].icon + '×' + rw.qty : ''}${rw.furn ? ' ' + FURN[rw.furn].icon : ''}</small></div>${q.kind === 'deliver' && !q.done ? btn('deliver', `Giao ${ITEMS[q.item].icon}`, `data-id="${q.id}"`, (bag[q.item] || 0) >= q.n ? 'sm' : 'sm off') : ''}</div>`; }).join('');
    return topTabs + actBanner + this.weeklyBoard(st) + tut + (list || '<p class="empty">Chưa có nhiệm vụ</p>') + '<small class="hint">Nhiệm vụ làm chung cả nhà; 🤝 co-op cần ít nhất 2 người cùng làm. Mỗi sáng có nhiệm vụ mới.</small>';
  }

  // ---------------- Bảng Điều Khiển Quán Ăn Làng: Ready, Set, Cook! ----------------
  p_kitchen(st, me) {
    const r = st.restaurant, home = this.params.station === 'home', bag = st.inventory.players[me.id] || {}, bags = [st.inventory.chest, bag], lvl = st.farm.level;
    let h = '';
    if (!home) {
      const tab = this.restTab || 'rsc';
      h += `<div class="tabs">${[
        ['rsc', '👨‍🍳 Bếp chơi chung'],
        ['cook', '🍳 Nấu Nông Sản'],
        ['up', '👑 Làm Chủ & Nâng Cấp'],
      ].map(([k, n]) => btn('rtab', n, `data-v="${k}"`, tab === k ? 'on' : '')).join('')}</div>`;

      if (tab === 'rsc') {
        const online = Object.values(st.players).filter((p) => p.connected);
        const names = online.map((p) => esc(p.name)).join(' & ');
        return h + `<div class="kitchenLobby"><span class="ti huge">👨‍🍳</span><b>Bếp của cả nhà</b><p>Một ca 3 phút. Cùng chia việc và phục vụ thật nhiều khách để đạt 3 sao.</p><div class="note">👥 ${names} • ${online.length} người trong phòng</div>${btn('shift', '▶ Vào bếp chơi chung', '', 'go')}<ol><li>Chạm vào khách hoặc phiếu đơn để nhận món.</li><li>Lấy nguyên liệu, mang đến thớt để sơ chế.</li><li>Ghép đúng công thức trên đĩa; pizza cần nướng.</li><li>Bưng món tới đúng khách, dọn đĩa bẩn rồi rửa.</li></ol><small class="hint">Chạm trạm để tự đi tới, hoặc dùng WASD / cần điều khiển. Cả nhà dùng chung đơn, bếp và thời gian ca.</small></div>`;
      }

      if (tab === 'up') {
        let upH = '';
        if (!r.unlocked) {
          upH += `<div class="card big1"><span class="ti big">👑</span><b>Mua Quyền Làm Chủ Nhà Hàng Gia Đình</b><small>Bạn luôn có thể <b>Làm Thêm miễn phí từ Cấp 1</b>. Khi đạt <b>Cấp ${CFG.RESTAURANT_LEVEL}</b> và mua quyền Làm Chủ, toàn bộ doanh thu bàn ăn sẽ cộng vào Quỹ Chung và mở khóa <b>Bếp Trưởng Bo tự nấu</b>!</small><div class="price">${fmt(CFG.RESTAURANT_COST)} 🪙 🏦</div>${btn('unlock', 'Mua quyền Làm Chủ Nhà Hàng', '', lvl >= CFG.RESTAURANT_LEVEL && st.economy.fund + me.money >= CFG.RESTAURANT_COST ? 'go' : 'off')}${lvl < CFG.RESTAURANT_LEVEL ? `<small class="lock">🔒 Cần Cấp nông trại ${CFG.RESTAURANT_LEVEL} (hiện Cấp ${lvl})</small>` : ''}</div>`;
        } else {
          upH += `<div class="note">👑 Gia đình bạn đã Làm Chủ Nhà Hàng (${'⭐'.repeat(r.stars)} • ${r.tables} bàn • bếp cấp ${r.kitchen})</div>`;
          upH += Object.entries(RESTAURANT_UPGRADES).map(([k, u]) => { const i = upgradeInfo(r, k); return `<div class="li"><span class="ti">${u.icon}</span><div><b>${u.name} (${i.cur}/${i.max})</b><small>${u.desc}</small></div>${i.cost == null ? '<small>Tối đa</small>' : btn('upg', `${fmt(i.cost)}🪙`, `data-w="${k}"`, st.economy.fund + me.money >= i.cost ? 'sm' : 'sm off')}</div>`; }).join('');
          upH += `<div class="li"><span class="ti">🧑‍🍳</span><div><b>Bếp Trưởng Bo tự nấu</b><small>Cần bếp cấp 2. Tự động dùng nguyên liệu trong Rương Chung.</small></div>${btn('auto', r.auto ? 'Đang bật' : 'Đang tắt', `data-on="${r.auto ? 0 : 1}"`, 'sm')}</div>`;
        }
        return h + upH;
      }
    }

    const st0 = home ? ['home'] : [...Array(stationCount(r.kitchen, r.shift?.active)).keys()].map((i) => 's' + i);
    h += `<h4>${home ? 'Bếp trong nhà' : 'Các bếp nấu nông sản'}</h4><div class="stations">${st0.map((k) => { const s = r.stations[k]; return `<div class="station ${s ? s.state : ''}"><b>${s ? RECIPES[s.recipe]?.icon || '🍳' : '🔥'}</b>${s ? (s.state === 'cooking' ? `<small>${Math.max(0, Math.ceil(s.t0 + s.dur - st.world.t))}s</small>` : s.state === 'ready' ? btn('collect', 'Lấy', `data-st="${k}"`, 'sm') : '<small>đang sơ chế</small>') : '<small>rảnh</small>'}</div>`; }).join('')}</div>`;
    const free = st0.find((k) => !r.stations[k]);
    h += `<h4>Công thức nấu từ nông sản trong Túi / Rương</h4>` + RECIPE_LIST.filter((k) => RECIPES[k].lvl <= lvl).map((k) => { const d = RECIPES[k], ok = canCook(d, bags); return `<div class="li"><span class="ti">${d.icon}</span><div><b>${d.name}</b><small>${Object.entries(d.ing).map(([i, n]) => { const have = countKey(bags, i), ic = i === 'fish' ? '🐟' : ITEMS[i].icon; return `<span class="${have >= n ? 'okc' : 'nc'}">${ic}${have}/${n}</span>`; }).join(' ')} • ${d.time}s • ${d.price}🪙</small></div>${btn('cook', 'Nấu', `data-r="${k}" data-st="${free || st0[0]}"`, ok && free ? 'sm' : 'sm off')}</div>`; }).join('');
    return h + '<small class="hint">Nguyên liệu lấy từ Rương Chung + túi của bạn.</small>';
  }
  p_house(st, me) {
    const L = st.farm.houseLevel, cur = HOUSE_LEVELS[L - 1], nxt = HOUSE_LEVELS[L], room = interiorRoom(L), nr = nxt ? interiorRoom(L + 1) : null;
    const rows = st.farm.plotRows, curPlots = rows * PLOT.cols, canExpand = rows < PLOT.maxRows, expCost = canExpand ? expandCost(rows) : 0;
    const totalMoney = st.economy.fund + me.money;
    const inHouse = this.g.local.area === 'house';
    let h = `<div class="row wrap">${btn('gohouse', inHouse ? '🚪 Ra ngoài sân' : '🏠 Đi vào trong nhà', '', 'sm go')}${btn('openbuild', '🔨 Mua & Bày trí Nội Thất', '', 'sm')}</div>`;
    h += `<div class="card big1"><span class="ti big">🏠</span><b>Cấp ${L}: ${cur.name}</b><small>Diện tích trong nhà hiện tại: <b>${room.w}×${room.d} ô</b> (có đủ 4 bức tường, lò sưởi, bếp & nội thất)</small>`;
    if (nxt) {
      const canUp = st.farm.level >= nxt.lvl && totalMoney >= nxt.cost;
      h += `<div class="note">⬆️ Nâng lên <b>${nxt.name}</b>: mở rộng phòng lên <b>${nr.w}×${nr.d} ô</b> + kiến trúc mái mới!</div><div class="price">${fmt(nxt.cost)} 🪙 (Ví + Quỹ chung 🏦)</div>${btn('houseup', `⬆️ Nâng cấp lên ${nxt.name}`, '', canUp ? '' : 'off')}${st.farm.level < nxt.lvl ? `<small class="lock">🔒 Cần Cấp nông trại ${nxt.lvl} (hiện Cấp ${st.farm.level})</small>` : ''}`;
    } else {
      h += '<small class="okc">🎉 Ngôi nhà đã đạt cấp Biệt Thự tối đa!</small>';
    }
    h += '</div>';
    h += `<div class="card big1"><span class="ti big">🌾</span><b>Ruộng Canh Tác: ${curPlots} ô đất</b><small>Đang mở ${rows} hàng × ${PLOT.cols} cột (${curPlots} ô)</small>`;
    if (canExpand) {
      const canExp = totalMoney >= expCost;
      h += `<div class="note">⬆️ Mở rộng thêm <b>+${PLOT.cols} ô đất mới</b> (lên ${curPlots + PLOT.cols} ô)</div><div class="price">${fmt(expCost)} 🪙 (Ví + Quỹ chung 🏦)</div>${btn('expand', `🌾 Mở rộng ruộng (+${PLOT.cols} ô)`, '', canExp ? '' : 'off')}`;
    } else {
      h += '<small class="okc">🎉 Ruộng đã mở rộng tối đa (24 ô)!</small>';
    }
    h += '</div>';
    const style = (k, T) => `<h4>${{ floor: '🪵 Sàn nhà', wall: '🎨 Màu tường (4 bức tường)', light: '💡 Ánh đèn trong nhà' }[k]} ${!inHouse ? '<small>(Vào nhà để đổi)</small>' : ''}</h4><div class="chips">${Object.entries(T).map(([id, v]) => btn('style', `${v.name}${v.price ? ' ' + v.price + '🪙' : ''}`, `data-k="${k}" data-v="${id}"`, st.house[k] === id ? 'on' : '')).join('')}</div>`;
    return h + style('floor', FLOORS) + style('wall', WALLS) + style('light', LIGHTS);
  }
  p_build(st, me) {
    const g = this.g, b = g.build, area = g.local.area === 'house' ? 'house' : 'farm', cats = FURN_CATS.filter(([k]) => Object.values(FURN).some((f) => f.cat === k && f.areas.includes(area))), tab = this.tab && cats.some(([k]) => k === this.tab) ? this.tab : cats[0][0], stash = st.inventory.stash;
    const L = st.farm.houseLevel, nxt = HOUSE_LEVELS[L], rows = st.farm.plotRows, curPlots = rows * PLOT.cols;
    let h = `<div class="row between"><div class="tabs">${cats.map(([k, n, ic]) => btn('cat', `${ic} ${n}`, `data-v="${k}"`, tab === k ? 'on' : '')).join('')}</div><div class="row">${btn('openhouse', `🏠 Nâng cấp Nhà${nxt ? ` (${fmt(nxt.cost)}🪙)` : ''}`, '', 'sm go')}${rows < PLOT.maxRows ? btn('expand', `🌾 +${PLOT.cols} ô ruộng (${fmt(expandCost(rows))}🪙)`, '', 'sm') : ''}${btn('done', 'Xong', '', 'sm ghost')}</div></div>`;
    if (b.item) { const d = FURN[b.item]; h += `<div class="bctl"><span class="ti">${d.icon}</span><b>${d.name}</b><span id="bStat" class="bstat"></span>${btn('rot', '⟳ Xoay (R)', '', 'sm')}${btn('place', '✓ Đặt', '', 'sm go')}${btn('cancel', '✕', '', 'sm ghost')}</div><small class="hint">${g.input.mobile ? 'Chạm lên sàn để chọn chỗ, rồi bấm ✓ Đặt.' : 'Rê chuột để chọn chỗ, nhấp chuột hoặc Space để đặt.'} ${b.moving ? '' : (stash[b.item] ? `Đang dùng 1 món trong kho (còn ${stash[b.item]}).` : `Giá ${d.price}🪙 trừ vào ví khi đặt.`)}</small>`; }
    else if (b.sel && st.furniture[b.sel]) { const f = st.furniture[b.sel], d = FURN[f.item]; h += `<div class="bctl"><span class="ti">${d.icon}</span><b>${d.name}</b>${btn('move', '↔ Di chuyển', '', 'sm')}${btn('rot', '⟳ Xoay', '', 'sm')}${btn('remove', '🗑 Cất', '', 'sm ghost')}</div>`; }
    else h += `<small class="hint">Chọn món bên dưới để đặt • chạm đồ đã đặt để di chuyển/xoay/cất • bấm <b>🏠 Nâng cấp Nhà</b> để mở rộng nhà (${curPlots} ô ruộng).</small>`;
    h += '<div class="strip">' + Object.entries(FURN).filter(([, f]) => f.cat === tab && f.areas.includes(area)).map(([id, f]) => { const lock = f.lvl > st.farm.level && !stash[id], n = stash[id] || 0; return `<button class="card mini ${b.item === id ? 'on' : ''} ${lock ? 'dim' : ''}" data-a="${lock ? 'noop' : 'pick'}" data-id="${id}"><span class="ti">${f.icon}</span><b>${f.name}</b><small>${n ? `Kho ×${n}` : lock ? `🔒 Cấp ${f.lvl}` : `${fmt(f.price)}🪙`}</small></button>`; }).join('') + '</div>';
    return h;
  }
  updateBuildStat() { const s = $('#bStat'); if (!s) return; const b = this.g.build; s.textContent = b.valid ? '✔ đặt được' : '✖ vướng'; s.className = 'bstat ' + (b.valid ? 'ok' : 'bad'); }
  p_settings(st, me) {
    const g = this.g, S = g.settings, ses = g.session, code = ses.code, online = Object.values(st.players).filter((p) => p.connected);
    const seg = (a, cur, opts) => `<div class="chips">${opts.map(([v, n]) => btn(a, n, `data-v="${v}"`, cur === v ? 'on' : '')).join('')}</div>`;
    const fov = Math.round(S.fov || 54), sens = Math.round((S.sens ?? 1.0) * 100), smooth = Math.round((S.smooth ?? 0.8) * 100);
    const curDist = Math.round(g.rig?.tDist || 14);
    let h = `<h4>🎥 Góc nhìn • ${Math.round(g.gfx?.fps || 60)} FPS</h4>`;
    h += `${seg('view', g.view, [['3D', '🎥 3D'], ['FP', '👁️ Thứ nhất'], ['2D', '🗺️ Nhìn từ trên']])}`;
    h += `<div class="row wrap">${btn('zoomcam', `🔍 Đổi Cự Ly Camera (Hiện: ${curDist}m)`, '', 'sm go')}${btn('resetcam', '↺ Đặt lại góc nhìn chuẩn', '', 'sm ghost')}</div>`;
    h += `<label class="sl"><span>Độ rộng góc nhìn (FOV)</span><input type="range" min="42" max="85" value="${fov}" data-cam="fov"><b id="lbl_fov">${fov}°</b></label>`;
    h += `<label class="sl"><span>Độ nhạy xoay màn hình</span><input type="range" min="30" max="200" value="${sens}" data-cam="sens"><b id="lbl_sens">${sens}%</b></label>`;
    h += `<label class="sl"><span>Độ mượt khi xoay (Quán tính)</span><input type="range" min="10" max="100" value="${smooth}" data-cam="smooth"><b id="lbl_smooth">${smooth}%</b></label>`;
    h += `<h4>✨ Chất lượng đồ hoạ</h4>${seg('gfx', S.gfx, [['auto', `Tự cân bằng (${g.gfx.level})`], ['low', 'Nhẹ'], ['medium', 'Cân bằng'], ['high', 'Chi tiết']])}<small class="hint">Tự cân bằng điều chỉnh độ phân giải khi tốc độ máy giảm.</small>`;
    h += `<h4>🔊 Âm thanh</h4>${[['master', 'Tổng'], ['music', 'Nhạc'], ['sfx', 'Hiệu ứng']].map(([k, n]) => `<label class="sl"><span>${n}</span><input type="range" min="0" max="100" value="${Math.round(S[k] * 100)}" data-vol="${k}"></label>`).join('')}`;
    h += `<h4>👤 Đổi Nhân Vật Nhanh (Hiếu 💙 / Huyền 💖)</h4>`;
    h += `<div class="row wrap">${btn('switchChar', '👦 Đổi thành Hiếu 💙', 'data-who="hieu"', me.name === 'Hiếu' ? 'go' : '')}${btn('switchChar', '👧 Đổi thành Huyền 💖', 'data-who="huyen"', me.name === 'Huyền' ? 'go' : '')}</div>`;
    h += `<h4>🔗 Mời bạn bè chơi cùng (2 Máy / 2 Địa Điểm)</h4><div class="room"><b class="code">${code}</b>${btn('copy', '📋 Chép mã', '', 'sm')}${btn('copylink', '🔗 Chép Link Mời', '', 'sm go')}</div><small class="hint">Đang chơi: ${online.map((p) => esc(p.name)).join(', ')} • Tự động đồng bộ Cloud ☁️</small>`;
    h += `<div class="row wrap">${btn('savenow', '☁️ Lưu Cloud ngay', '', 'sm go')}${btn('exportjson', '💾 Tải File Backup (.json)', '', 'sm')}${btn('full', '⛶ Toàn màn hình', '', 'sm ghost')}${btn('menu', '🏠 Về menu', '', 'sm ghost')}</div>`;
    if (ses.role === 'host') h += `<h4>🎲 Thử sự kiện (chủ farm)</h4><div class="chips">${Object.entries(EVENTS).map(([k, e]) => `<button class="b sm ghost" data-a="dev" data-t="${k}">${e.icon} ${e.name}</button>`).join('')}</div>`;
    return h;
  }
  p_room(st) { const ses = this.g.session; return `<div class="card big1"><span class="ti big">👫</span><b>Mời người yêu / bạn bè vào farm (Khác mạng / Khác nơi)</b><div class="room"><b class="code">${ses.code}</b>${btn('copy', '📋 Chép mã', '', 'sm')}${btn('copylink', '🔗 Chép Link Mời', '', 'sm go')}</div><small>Gửi <b>Link Mời</b> qua Zalo/Messenger hoặc nhập mã này ở mục <b>Vào Bạn Bè</b>. Tối đa ${CFG.MAX_PLAYERS} người • Tiến độ tự động lưu Cloud ☁️ trên cả 2 máy! ${ses.status.peer === 'open' ? '✔ Online sẵn sàng' : ses.status.peer === 'connecting' ? '⏳ Đang mở phòng online...' : ''}</small>${btn('close', 'Vào chơi thôi!', '', '')}</div>`; }
  p_chat(st, me) {
    return `<div class="chatlog">${this.chatLog.map((m) => `<div><b>${esc(m.name)}</b> ${esc(m.text)}</div>`).join('') || '<small class="empty">Chưa có tin nhắn</small>'}</div><div class="row"><input id="chatIn" maxlength="100" placeholder="Nhắn gì đó..." autocomplete="off">${btn('send', 'Gửi', '', 'sm')}</div><div class="chips">${[['😘', 'kiss'], ['🤗', 'hug'], ['😀', 'celebrate'], ['❤️', 'wave'], ['👍', 'wave'], ['😭', 'sad'], ['😮', 'surprised'], ['🎉', 'celebrate']].map(([e, a]) => `<button class="b sm ghost" data-a="emote" data-e="${e}" data-anim="${a}">${e}</button>`).join('')}</div>`;
  }
  openDialog(npcId) {
    const g = this.g, def = NPCS[npcId], st = g.store.state; this.dialogNpc = npcId; const l = [...def.lines]; if (st.world.weather === 'rain') l.push(def.rain); if (Object.keys(st.thieves).length) l.push(def.thief);
    this.line = l[(Math.random() * l.length) | 0]; this.open('dialog', { npc: npcId, n: Math.random() }); g.audio.sfx('pop');
  }
  p_dialog(st, me) {
    const id = this.dialogNpc, def = NPCS[id], bag = st.inventory.players[me.id] || {}, qs = st.quests.list.filter((q) => q.kind === 'deliver' && q.npc === id && !q.done);
    return `<div class="dlg"><span class="ti huge">${def.icon}</span><div><small>${def.role}</small><p>“${this.line}”</p></div></div><div class="row wrap">${def.shop ? btn('shopOpen', `🛒 ${SHOPS[def.shop].name}`, `data-shop="${def.shop}"`) : ''}${id === 'chef' ? btn('startshift', '👨‍🍳 Vào Làm Thêm: Ready, Set, Cook!', '', 'go') : ''}${id === 'fisherman' ? btn('sellfisher', '🐟 Bán cá (+15%)', '', 'ghost') : ''}${qs.map((q) => btn('deliver', `🎁 Giao ${q.n} ${ITEMS[q.item].icon} (${bag[q.item] || 0}) → 🪙${q.reward.coins}`, `data-id="${q.id}"`, (bag[q.item] || 0) >= q.n ? '' : 'off')).join('')}${btn('close', 'Tạm biệt', '', 'ghost')}</div>`;
  }
}
// ---------------- mini-game câu cá ----------------
class FishGame {
  constructor(ui) { this.ui = ui; this.on = false; this.el = $('#fish'); }
  start(diff, done) { this.on = true; this.diff = diff; this.done = done; this.zone = 0.3; this.zv = 0; this.fish = 0.5; this.ft = 0.5; this.prog = 0.35; this.time = 26; this.el.classList.remove('hidden'); this.el.innerHTML = '<div class="track"><div class="zone"></div><div class="fi">🐟</div></div><div class="pr"><u></u></div><small>Giữ <b>Hành động</b> để nâng vùng xanh!</small>'; }
  stop() { this.on = false; this.el.classList.add('hidden'); }
  update(dt) {
    if (!this.on) return; const g = this.ui.g, hold = g.input.keys.has(' ') || g.actionHeld, zh = 0.26 - this.diff * 0.1;
    this.zv += (hold ? 1.5 : -1.3) * dt * 2.2; this.zv *= 0.94; this.zone = clamp(this.zone + this.zv * dt, 0, 1 - zh); if (this.zone <= 0 || this.zone >= 1 - zh) this.zv *= -0.3;
    this.ft -= dt; if (this.ft <= 0) { this.ft = 0.5 + Math.random() * (1.1 - this.diff * 0.6); this.ftarget = Math.random(); } this.fish += ((this.ftarget ?? 0.5) - this.fish) * dt * (1.6 + this.diff * 3.5);
    const inz = this.fish > this.zone && this.fish < this.zone + zh; this.prog += (inz ? 0.24 : -0.17 - this.diff * 0.1) * dt; this.time -= dt;
    const t = this.el.querySelector('.track'); if (t) { const z = t.querySelector('.zone'), f = t.querySelector('.fi'); z.style.height = zh * 100 + '%'; z.style.bottom = this.zone * 100 + '%'; f.style.bottom = this.fish * 100 + '%'; f.classList.toggle('in', inz); this.el.querySelector('.pr u').style.height = clamp(this.prog, 0, 1) * 100 + '%'; }
    if (this.prog >= 1) this.finish(true); else if (this.prog <= 0 || this.time <= 0) this.finish(false);
  }
  finish(win) { this.on = false; this.el.classList.add('hidden'); this.done?.(win); }
}
