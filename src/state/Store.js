// Store = nơi giữ GameState + theo dõi thay đổi theo "path" (vd 'crops.p1_2').
// Host: mọi thay đổi gọi touch(path) -> gom thành ops gửi cho client (10Hz).
// Client: applyOps() ghi đè path rồi phát 'touch' để view cập nhật. => View không cần biết mình là host hay client.
export class Store {
  constructor(state) { this.state = state; this.dirty = new Set(); this.h = new Map(); }
  on(evt, fn) { let s = this.h.get(evt); if (!s) this.h.set(evt, (s = new Set())); s.add(fn); return () => s.delete(fn); }
  emit(evt, p) { const s = this.h.get(evt); if (s) for (const fn of [...s]) fn(p); }
  get(path) { let o = this.state; for (const k of path.split('.')) { if (o == null) return undefined; o = o[k]; } return o; }
  set(path, v) {
    const ks = path.split('.'); let o = this.state;
    for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] ??= {};
    const k = ks[ks.length - 1];
    if (v === undefined) delete o[k]; else o[k] = v;
  }
  touch(path) { this.dirty.add(path); this.emit('touch', path); }
  flush() {
    if (!this.dirty.size) return null;
    const ops = [];
    for (const p of this.dirty) { const v = this.get(p); ops.push(v === undefined ? { p } : { p, v }); }
    this.dirty.clear();
    return ops;
  }
  applyOps(ops) { for (const o of ops) { this.set(o.p, o.v); this.emit('touch', o.p); } this.emit('ops', ops); }
  replace(state) { this.state = state; this.dirty.clear(); this.emit('replaced'); }
}
