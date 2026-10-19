// Bus sự kiện nhỏ dùng chung cho sim (host) và presentation (client).
export class EventBus {
  constructor() { this.m = new Map(); }
  on(evt, fn) {
    let s = this.m.get(evt);
    if (!s) this.m.set(evt, (s = new Set()));
    s.add(fn);
    return () => s.delete(fn);
  }
  emit(evt, payload) {
    const s = this.m.get(evt);
    if (s) for (const fn of [...s]) fn(payload);
    const a = this.m.get('*');
    if (a) for (const fn of [...a]) fn(evt, payload);
  }
}
