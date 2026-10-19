import { VP, toLocal, lookDelta } from './Viewport.js';
// Input: bàn phím + chuột + cảm ứng đa điểm chuẩn FPS/TPS (ngón trái di chuyển Joystick + ngón phải xoay camera độc lập cùng lúc).
export class Input {
  constructor(canvas) {
    this.canvas = canvas; this.keys = new Set(); this.cb = {}; this.look = { x: 0, y: 0 }; this.pointers = new Map();
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, fixed: false };
    this.mobile = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    this.pinch = 0; this.fp = false; this.blocked = false;
    this.joyEl = document.getElementById('joy'); this.knob = document.getElementById('joyKnob');
    this.fixEl = document.getElementById('joyFix'); this.fixKnob = document.getElementById('joyFixKnob');
    addEventListener('keydown', (e) => this.key(e, true)); addEventListener('keyup', (e) => this.key(e, false));
    addEventListener('blur', () => { this.keys.clear(); this.resetTouch(); });
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointermove', (e) => this.moveEv(e), { passive: false });
    addEventListener('pointerup', (e) => this.up(e));
    addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.cb.zoom?.(e.deltaY > 0 ? 1.08 : 0.92); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) { const d = lookDelta(e.movementX, e.movementY); this.look.x += d.x; this.look.y += d.y; } });
  }
  resetTouch() {
    this.pointers.clear(); this.pinch = 0;
    this.joy.id = null; this.joy.x = this.joy.y = 0; this.showJoy(false);
  }
  typing() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); }
  key(e, d) {
    if (this.typing()) { if (d && e.key === 'Escape') document.activeElement.blur(); return; }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (d) this.keys.add(k); else this.keys.delete(k);
    if (!d) return; if ([' ', 'Tab', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
    if (k === ' ') this.cb.space?.(); else if (k === 'f' || k === 'c') this.cb.action?.(); else if (k === 'e') this.cb.interact?.(); else if (k >= '1' && k <= '6') this.cb.tool?.(+k - 1); else if (k === 'r') this.cb.rotate?.();
    else if (k === 'v') this.cb.view?.(); else if (k === 'b') this.cb.build?.(); else if (k === 'i' || k === 'Tab') this.cb.panel?.('pack'); else if (k === 'j') this.cb.panel?.('quests'); else if (k === 'Enter') this.cb.chat?.(); else if (k === 'Escape') this.cb.escape?.();
  }
  axis() {
    let x = 0, y = 0; const K = this.keys;
    if (K.has('a') || K.has('ArrowLeft')) x -= 1; if (K.has('d') || K.has('ArrowRight')) x += 1; if (K.has('w') || K.has('ArrowUp')) y += 1; if (K.has('s') || K.has('ArrowDown')) y -= 1;
    if (x || y) { const l = Math.hypot(x, y); x /= l; y /= l; } x += this.joy.x; y += this.joy.y; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y, run: this.keys.has('Shift') };
  }
  camKeys() { return (this.keys.has('x') ? 1 : 0) - (this.keys.has('q') || this.keys.has('z') ? 1 : 0); }
  consumeLook() { const l = { ...this.look }; this.look.x = this.look.y = 0; return l; }
  lookTouches() {
    const out = [];
    for (const p of this.pointers.values()) if (p.role === 'look' && p.type === 'touch') out.push(p);
    return out;
  }
  down(e) {
    if (this.blocked) return;
    try { this.canvas.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    const q = toLocal(e.clientX, e.clientY);
    const p = { id: e.pointerId, x: q.x, y: q.y, t: performance.now(), type: e.pointerType, btn: e.button, moved: 0 };
    this.pointers.set(e.pointerId, p);
    // Vùng Joystick bên trái màn hình (42% chiều ngang bên trái, 65% chiều cao bên dưới)
    const inJoyZone = q.x < VP.vw * 0.42 && q.y > VP.vh * 0.32;
    if ((e.pointerType === 'touch' || this.mobile) && inJoyZone && this.joy.id === null && !this.cb.touchFree?.()) {
      let ox = q.x, oy = q.y, fixed = false; const f = this.fixEl;
      if (f && f.offsetParent) {
        const cx = f.offsetLeft + f.offsetWidth / 2, cy = f.offsetTop + f.offsetHeight / 2;
        if (Math.hypot(q.x - cx, q.y - cy) < f.offsetWidth * 1.15) { ox = cx; oy = cy; fixed = true; }
      }
      Object.assign(this.joy, { id: e.pointerId, ox, oy, fixed, x: 0, y: 0 });
      p.role = 'joy';
      this.showJoy(true);
      if (fixed) this.joyMove(p);
    } else {
      p.role = 'look';
    }
    // Chỉ tính pinch-zoom khi có 2 ngón tay đều thuộc vùng 'look' (KHÔNG tính ngón tay đang giữ Joystick!)
    const lk = this.lookTouches();
    if (lk.length === 2 && !this.fp) {
      this.pinch = Math.hypot(lk[0].x - lk[1].x, lk[0].y - lk[1].y);
    }
    if (e.pointerType === 'mouse' && this.fp && e.button === 0 && document.pointerLockElement !== this.canvas && !this.cb.buildActive?.()) {
      this.canvas.requestPointerLock?.();
    }
  }
  joyMove(p) {
    const R = this.joy.fixed ? 52 : 56; let jx = p.x - this.joy.ox, jy = p.y - this.joy.oy; const l = Math.hypot(jx, jy);
    if (l > R) { if (!this.joy.fixed) { this.joy.ox += (jx / l) * (l - R); this.joy.oy += (jy / l) * (l - R); } jx = (jx / l) * R; jy = (jy / l) * R; }
    this.joy.x = jx / R; this.joy.y = -jy / R; this.showJoy(true, jx, jy);
  }
  moveEv(e) {
    const p = this.pointers.get(e.pointerId); if (!p) return;
    const q = toLocal(e.clientX, e.clientY), dx = q.x - p.x, dy = q.y - p.y;
    p.x = q.x; p.y = q.y; p.moved += Math.abs(dx) + Math.abs(dy);
    if (p.role === 'joy') return this.joyMove(p);
    // Nếu ngón này là 'look': kiểm tra xem có 2 ngón 'look' đang chụm zoom không (ngón 'joy' hoạt động hoàn toàn độc lập)
    const lk = this.lookTouches();
    if (lk.length >= 2 && p.type === 'touch' && !this.fp) {
      const d = Math.hypot(lk[0].x - lk[1].x, lk[0].y - lk[1].y);
      if (this.pinch > 10 && d > 10) this.cb.zoom?.(this.pinch / d);
      this.pinch = d;
      return;
    }
    if (p.type === 'mouse' ? (p.btn === 2 || p.btn === 1 || (p.btn === 0 && this.cb.dragLook?.())) : true) {
      this.look.x += dx;
      this.look.y += dy;
    }
    this.cb.hover?.(q.x, q.y, p);
  }
  up(e) {
    const p = this.pointers.get(e.pointerId); if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.lookTouches().length < 2) this.pinch = 0;
    if (p.role === 'joy') {
      this.joy.id = null; this.joy.x = this.joy.y = 0; this.showJoy(false);
    } else if (p.moved < 12 && performance.now() - p.t < 450) {
      this.cb.tap?.(p.x, p.y, p.type, p.btn);
    }
  }
  showJoy(on, jx = 0, jy = 0) {
    if (this.fixEl) { this.fixEl.classList.toggle('held', on && this.joy.fixed); this.fixKnob.style.transform = on && this.joy.fixed ? `translate(${jx}px,${jy}px)` : 'translate(0,0)'; }
    if (!this.joyEl) return; const fl = on && !this.joy.fixed; this.joyEl.classList.toggle('active', fl);
    if (fl) { this.joyEl.style.left = this.joy.ox + 'px'; this.joyEl.style.top = this.joy.oy + 'px'; this.knob.style.transform = `translate(${jx}px,${jy}px)`; }
  }
}
