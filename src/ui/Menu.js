import { PRESETS } from '../data/characters.js';
import { esc } from '../core/util.js';
const $ = (s, r = document) => r.querySelector(s);
const rid = () => 'p' + Math.random().toString(36).slice(2, 9);
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'vừa xong' : m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`; };

export class Menu {
  constructor(ui) {
    this.ui = ui;
    this.el = $('#menu');
    this.preset = 0;
    this.msg = '';
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (b) this.act(b.dataset.m, b.dataset);
    });
  }
  bind(g) {
    this.g = g;
    const p = g.save.profile();
    this.profile = p || { id: rid(), name: 'Hiếu', preset: 0 };
    if (!this.profile.name || this.profile.name === 'Nông dân') {
      this.profile.name = this.profile.preset === 1 ? 'Huyền' : 'Hiếu';
    }
    this.preset = this.profile.preset || 0;
    this.show();
    const joinParam = new URLSearchParams(location.search).get('join');
    if (joinParam) {
      this.prefillCode = joinParam.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      this.render('join');
    }
  }
  show() {
    this.el.classList.remove('hidden');
    this.farms = this.g.save.list();
    this.render('main');
    this.g.save.syncFromServer?.().then((list) => {
      if (list && list.length) {
        this.farms = list;
        if (!this.el.classList.contains('hidden') && (this.screen === 'main' || this.screen === 'farms')) {
          this.render(this.screen);
        }
      }
    });
  }
  hide() { this.el.classList.add('hidden'); }
  card(inner) { return `<div class="mcard">${inner}</div>`; }
  coupleSwitchHtml() {
    const isHieu = this.profile.name === 'Hiếu' || (this.preset === 0 && this.profile.name !== 'Huyền');
    const isHuyen = this.profile.name === 'Huyền' || this.preset === 1;
    return `
      <div class="couplePickRow">
        <button class="coupleBtn hieu ${isHieu ? 'on' : ''}" data-m="pickChar" data-who="hieu">
          <span>👦💙</span><div><b>Mình là HIẾU</b><small>Soái Ca Nông Trại</small></div>
        </button>
        <button class="coupleBtn huyen ${isHuyen ? 'on' : ''}" data-m="pickChar" data-who="huyen">
          <span>👧💖</span><div><b>Mình là HUYỀN</b><small>Công Chúa Dâu Tây</small></div>
        </button>
      </div>
    `;
  }
  presetsHtml() {
    return `<div class="presets">${PRESETS.map((p) => `<button class="pc ${p.id === this.preset ? 'on' : ''}" data-m="preset" data-id="${p.id}"><span>${p.avatar}</span><small>${p.name}</small></button>`).join('')}</div>`;
  }
  render(screen) {
    this.screen = screen; const F = this.farms, g = this.g, last = F[0]; let h = '';
    if (screen === 'main') {
      h = `<div class="menuHero"><div class="title"><span class="tl1">HIẾU ❤️ HUYỀN</span><span class="tl2">FARM FAMILY PARTY</span><small>Trồng một khu vườn. Cùng nuôi một tổ ấm.</small><div class="menuDailyTag">🌱 Chăm ruộng • 🐔 Nuôi thú • 👨‍🍳 Cùng vào bếp</div></div>
      ${this.coupleSwitchHtml()}</div>
      <div class="mbtns">
        <button class="mb primary" data-m="${last ? 'resume' : 'create'}" data-code="${last?.code || ''}">${last ? `▶ TIẾP TỤC CHƠI (${esc(this.profile.name)})` : `▶ BẮT ĐẦU CHƠI (${esc(this.profile.name)})`}<small>${last ? `${esc(last.name)} • Ngày ${last.day} • Mã phòng: ${last.code} ☁️` : 'Vào Nông Trại Hiếu & Huyền 💕 ngay!'}</small></button>
        <button class="mb rscSpecial restaurantEntry" data-m="playRsc">👨‍🍳 BẾP CHƠI CHUNG<small>Nhận đơn, nấu món, phục vụ • Một ca cho cả nhà</small></button>
        <button class="mb arcadeEntry" data-m="playArcade">🎮 TRÒ CHƠI ĐÔI<small>Đập chuột • Hứng dâu • Lật thẻ • Đua thú</small></button>
        <div class="mGrid">
          <button class="mb smBtn" data-m="create">🌱 Tạo Farm</button>
          <button class="mb smBtn" data-m="join">👫 Vào Bạn Bè</button>
          <button class="mb smBtn" data-m="farms">📂 Đã Lưu (${F.length})</button>
          <button class="mb smBtn" data-m="settings">⚙️ Cài Đặt</button>
        </div></div>`;
    } else if (screen === 'farms') {
      h = this.card(`<h2>📂 Farm đã lưu (Đồng bộ Cloud ☁️)</h2><div class="flist">${F.length ? F.map((f) => `<div class="fi"><div><b>${esc(f.name)}</b><small>Ngày ${f.day} • ${esc((f.players || []).join(', '))} • ${ago(f.savedAt)}</small><span class="badge ${f.role}">${f.cloud ? '☁️ Cloud' : f.role === 'host' ? 'Chủ farm' : 'Khách'} • mã ${f.code}</span></div><button class="b sm" data-m="resume" data-code="${f.code}">Vào chơi</button><button class="b sm ghost" data-m="export" data-code="${f.code}" title="Tải file backup .json">💾</button><button class="b sm ghost" data-m="del" data-code="${f.code}">🗑</button></div>`).join('') : '<p class="empty">Chưa có bản lưu nào. Bạn có thể tạo mới hoặc nhập file backup (.json) bên dưới.</p>'}</div><div class="row wrap"><button class="mb smBtn" data-m="import">📤 Nhập File Backup (.json)</button><button class="mb ghost" data-m="back">← Quay lại</button></div>`);
    } else if (screen === 'create') {
      h = this.card(`<h2>🌱 Tạo Nông Trại Hiếu & Huyền</h2>${this.coupleSwitchHtml()}<label>Hoặc chọn trang phục</label>${this.presetsHtml()}<label>Tên nhân vật</label><input id="mName" maxlength="14" value="${esc(this.profile.name)}" placeholder="Hiếu hoặc Huyền"><label>Tên nông trại</label><input id="mFarm" maxlength="24" value="Nông Trại Hiếu & Huyền 💕"><div class="row"><button class="mb primary" data-m="doCreate">Tạo Farm Ngay</button><button class="mb ghost" data-m="back">← Quay lại</button></div>`);
    } else if (screen === 'join') {
      h = this.card(`<h2>👫 Vào Nông Trại Cùng Người Thương</h2>${this.coupleSwitchHtml()}<label>Trang phục</label>${this.presetsHtml()}<label>Tên nhân vật</label><input id="mName" maxlength="14" value="${esc(this.profile.name)}" placeholder="Hiếu hoặc Huyền"><label>Mã phòng (6 ký tự)</label><input id="mCode" maxlength="6" class="code" value="${esc(this.prefillCode || '')}" placeholder="ABC123" autocapitalize="characters">
        <small id="mMsg" class="${this.msg ? 'warnt' : ''}">${this.msg || 'Nhập mã phòng 1 lần là tự động lưu Cloud. Lần sau ai vào trước làm Chủ Phòng, người vào sau bấm Tiếp Tục là tự nối vào chơi chung!'}</small><div class="row"><button class="mb primary" data-m="doJoin">Vào Farm</button><button class="mb ghost" data-m="back">← Quay lại</button></div>`);
    } else if (screen === 'guestFail') {
      const e = this.pending.e; h = this.card(`<h2>☁️ Mở nông trại "${esc(e.name)}"</h2><p>${esc(this.msg)}</p><p><small>Máy kia hiện chưa bật game. Bạn có thể bấm <b>🏠 Mở làm chủ farm</b> để chơi tiếp ngay trên tiến độ Cloud mới nhất (Ngày ${e.day}) — khi người ấy online chỉ cần bấm Tiếp Tục là tự vào chung!</small></p><div class="row wrap"><button class="mb primary" data-m="hostCopy">🏠 Mở làm chủ farm ngay</button><button class="mb" data-m="retry">🔄 Thử kết nối lại</button><button class="mb ghost" data-m="back">← Quay lại</button></div>`);
    } else if (screen === 'settings') {
      const s = g.settings;
      const fov = Math.round(s.fov || 54), sens = Math.round((s.sens ?? 1.0) * 100), smooth = Math.round((s.smooth ?? 0.8) * 100);
      h = this.card(`<h2>⚙️ Cài đặt & Góc nhìn 3D</h2>
        <label>🎥 Độ rộng góc nhìn 3D Cận Cảnh & Độ mượt xoay</label>
        <label class="sl"><span>Góc nhìn (FOV)</span><input type="range" min="42" max="85" value="${fov}" data-cam="fov"><b id="mlbl_fov">${fov}°</b></label>
        <label class="sl"><span>Độ nhạy xoay</span><input type="range" min="30" max="200" value="${sens}" data-cam="sens"><b id="mlbl_sens">${sens}%</b></label>
        <label class="sl"><span>Độ mượt (Quán tính)</span><input type="range" min="10" max="100" value="${smooth}" data-cam="smooth"><b id="mlbl_smooth">${smooth}%</b></label>
        <label>✨ Chất lượng đồ hoạ</label><div class="chips">${[['auto', 'Tự cân bằng'], ['low', 'Nhẹ'], ['medium', 'Cân bằng'], ['high', 'Chi tiết']].map(([v, n]) => `<button class="b ${s.gfx === v ? 'on' : ''}" data-m="gfx" data-v="${v}">${n}</button>`).join('')}</div><small>Tự cân bằng sẽ điều chỉnh độ phân giải theo tốc độ máy.</small>
        <label>🔊 Âm thanh</label>
        ${[['master', 'Âm lượng tổng'], ['music', 'Nhạc nền'], ['sfx', 'Hiệu ứng']].map(([k, n]) => `<label class="sl"><span>${n}</span><input type="range" min="0" max="100" value="${Math.round(s[k] * 100)}" data-vol="${k}"></label>`).join('')}
        <div class="row"><button class="mb ghost" data-m="back">← Quay lại</button></div>`);
    } else if (screen === 'credits') {
      h = this.card('<h2>ℹ️ Giới thiệu</h2><p><b>Farm Family Party — Phiên bản đặc biệt dành cho Hiếu 💙 & Huyền 💖</b>.<br>✨ Góc nhìn 3D gần rõ nét, siêu mượt 60 FPS, tích hợp <b>Quán Pizza & Trà Sữa</b> cùng <b>Khu Trò Chơi Đôi Hiếu ❤️ Huyền</b>!</p><div class="row"><button class="mb ghost" data-m="back">← Quay lại</button></div>');
    }
    this.el.innerHTML = h; this.el.dataset.screen = screen;
    this.el.querySelectorAll('input[data-vol]').forEach((i) => i.addEventListener('input', () => { const v = +i.value / 100; g.settings[i.dataset.vol] = v; g.audio.setVol({ [i.dataset.vol]: v }); g.persistSettings(); }));
    this.el.querySelectorAll('input[data-cam]').forEach((i) => i.addEventListener('input', () => {
      const k = i.dataset.cam, raw = +i.value, val = k === 'fov' ? raw : raw / 100;
      g.setCamPref(k, val);
      const lb = this.el.querySelector(`#mlbl_${k}`);
      if (lb) lb.textContent = k === 'fov' ? `${raw}°` : `${raw}%`;
    }));
    $('#mCode')?.addEventListener('input', (e) => (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')));
  }
  grab() {
    const n = $('#mName');
    if (n && n.value.trim()) this.profile.name = n.value.trim();
    this.profile.preset = this.preset;
    if (!this.profile.name) this.profile.name = this.preset === 1 ? 'Huyền' : 'Hiếu';
    this.g.save.saveProfile(this.profile);
    return this.profile;
  }
  fullscreen() { const g = this.g; if (g.input?.mobile && !matchMedia('(display-mode: standalone)').matches) { try { document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); } catch { /* ignore */ } } }
  async resume(code) {
    const g = this.g;
    const p = { ...this.grab() };
    this.el.innerHTML = this.card('<h2>☁️ Đang tải dữ liệu nông trại...</h2><small>Đang đồng bộ tiến độ mới nhất từ Server & kết nối phòng...</small>');
    const state = await g.save.load(code);
    if (!state) { this.msg = 'Không đọc được bản lưu'; return this.render('main'); }
    const existingId = Object.keys(state.players || {}).find((k) => k === this.profile.id);
    const me = existingId ? { ...p, id: existingId } : p;
    if (state.players?.[me.id]) {
      state.players[me.id].name = me.name;
      state.players[me.id].char = { preset: me.preset, hat: PRESETS[me.preset]?.hat || 'straw' };
    }
    return g.startFarm({ profile: me, state });
  }
  async act(a, d) {
    const g = this.g; g.audio.init(); g.audio.sfx('click');
    if (['resume', 'doCreate', 'doJoin', 'hostCopy', 'retry', 'playRsc', 'playArcade'].includes(a)) this.fullscreen();
    if (a === 'back') this.show(); else if (a === 'create') this.render('create'); else if (a === 'join') { this.msg = ''; this.render('join'); } else if (a === 'settings') this.render('settings'); else if (a === 'credits') this.render('credits'); else if (a === 'farms') this.render('farms');
    else if (a === 'pickChar') {
      if (d.who === 'huyen') {
        this.preset = 1;
        this.profile.name = 'Huyền';
        this.profile.preset = 1;
      } else {
        this.preset = 0;
        this.profile.name = 'Hiếu';
        this.profile.preset = 0;
      }
      this.g.save.saveProfile(this.profile);
      this.render(this.screen);
    }
    else if (a === 'preset') {
      this.preset = +d.id;
      const def = PRESETS[this.preset];
      if (def?.defaultName) this.profile.name = def.defaultName;
      this.grab();
      this.render(this.screen);
    }
    else if (a === 'gfx') { g.setQuality(d.v); this.render('settings'); }
    else if (a === 'del') { await g.save.remove(d.code); this.farms = g.save.list(); this.render('farms'); }
    else if (a === 'export') { await g.save.exportFile(d.code); }
    else if (a === 'import') {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json,application/json';
      inp.onchange = async () => {
        if (!inp.files?.[0]) return;
        try {
          const st = await g.save.importFile(inp.files[0]);
          this.farms = g.save.list();
          this.render('farms');
          g.ui?.toast(`Đã nhập nông trại "${st.meta?.farmName || st.meta?.roomCode}" thành công!`, 'good');
        } catch (err) {
          g.ui?.toast('File không hợp lệ: ' + err.message, 'warn');
        }
      };
      inp.click();
    }
    else if (a === 'resume') await this.resume(d.code);
    else if (a === 'playRsc') {
      const last = this.farms[0];
      if (last) await this.resume(last.code);
      else await g.startFarm({ profile: { ...this.grab() }, farmName: 'Nông Trại Hiếu & Huyền 💕' });
      setTimeout(() => { g.ui?.close(); g.rsc2d?.open(); }, 250);
    }
    else if (a === 'playArcade') {
      const last = this.farms[0];
      if (last) await this.resume(last.code);
      else await g.startFarm({ profile: { ...this.grab() }, farmName: 'Nông Trại Hiếu & Huyền 💕' });
      setTimeout(() => { g.ui?.open('arcade'); }, 250);
    }
    else if (a === 'retry') await this.resume(this.pending.e.code);
    else if (a === 'hostCopy') { const { state, p } = this.pending; await g.startFarm({ profile: p, state }); }
    else if (a === 'doCreate') { const p = { ...this.grab() }; await g.startFarm({ profile: p, farmName: $('#mFarm').value.trim() || 'Nông Trại Hiếu & Huyền 💕' }); }
    else if (a === 'doJoin') {
      const p = { ...this.grab() }, code = $('#mCode').value.trim().toUpperCase();
      if (code.length < 4) { this.msg = 'Nhập mã phòng (6 ký tự) nhé!'; $('#mMsg').textContent = this.msg; $('#mMsg').className = 'warnt'; return; }
      $('#mMsg').className = ''; $('#mMsg').textContent = '⏳ Đang tìm phòng hoặc tải bản lưu Cloud...';
      try {
        await g.joinFarm(code, p);
      } catch (e) {
        const cloudState = await g.save.load(code);
        if (cloudState) {
          await g.startFarm({ profile: p, state: cloudState });
          g.ui?.toast('☁️ Đã tải nông trại từ Cloud Server! Bạn bè vào sau sẽ tự nối vào phòng bạn.', 'good');
          return;
        }
        this.msg = e.message;
        $('#mMsg').className = 'warnt';
        $('#mMsg').textContent = '⚠️ ' + e.message;
      }
    }
  }
  quickStart() { const p = { ...this.profile, name: 'Hiếu', preset: 0 }; return this.g.startFarm({ profile: p, farmName: 'Nông Trại Hiếu & Huyền 💕' }); }
}
