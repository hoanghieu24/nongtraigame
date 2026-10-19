import { CFG } from '../core/Config.js';
// Hệ thống lưu trữ đa tầng cho chơi lâu dài 2 máy / 2 địa điểm:
// 1. Cloud Server (/api/save/:code) — Đồng bộ tự động lên Server để máy nào vào trước cũng có bản lưu mới nhất
// 2. IndexedDB (chính trên trình duyệt) + localStorage (dự phòng tức thời)
// 3. Xuất / Nhập file .json (Backup vĩnh viễn khi đổi điện thoại/máy tính)
const DB = 'ffp', STORE = 'kv';
const idb = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});

export class IndexedDbAdapter {
  async get(k) {
    try {
      const db = await idb();
      return await new Promise((res) => {
        const q = db.transaction(STORE).objectStore(STORE).get(k);
        q.onsuccess = () => res(q.result);
        q.onerror = () => res(undefined);
      });
    } catch {
      return undefined;
    }
  }
  async set(k, v) {
    try {
      const db = await idb();
      await new Promise((res) => {
        const t = db.transaction(STORE, 'readwrite');
        t.objectStore(STORE).put(v, k);
        t.oncomplete = res;
        t.onerror = res;
      });
    } catch { /* ignore */ }
  }
  async del(k) {
    try {
      const db = await idb();
      await new Promise((res) => {
        const t = db.transaction(STORE, 'readwrite');
        t.objectStore(STORE).delete(k);
        t.oncomplete = res;
        t.onerror = res;
      });
    } catch { /* ignore */ }
  }
}

export class RemoteAdapter {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }
  async listFarms() {
    try {
      const r = await fetch(`${this.baseUrl}/farms`, { cache: 'no-store' });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d.farms) ? d.farms : [];
    } catch {
      return [];
    }
  }
  async get(code) {
    try {
      const r = await fetch(`${this.baseUrl}/save/${encodeURIComponent(code)}`, { cache: 'no-store' });
      if (!r.ok) return undefined;
      const d = await r.json();
      return d?.state || undefined;
    } catch {
      return undefined;
    }
  }
  async set(code, stateObj) {
    try {
      await fetch(`${this.baseUrl}/save/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: stateObj }),
      });
    } catch { /* ignore offline */ }
  }
  beacon(code, jsonStr) {
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        navigator.sendBeacon(`${this.baseUrl}/save/${encodeURIComponent(code)}`, blob);
      }
    } catch { /* ignore */ }
  }
  async del(code) {
    try {
      await fetch(`${this.baseUrl}/save/${encodeURIComponent(code)}`, { method: 'DELETE' });
    } catch { /* ignore */ }
  }
}

const IDX = 'ffp.farms', KEY = (c) => 'ffp.farm.' + c;

export class SaveSystem {
  constructor(adapter = new IndexedDbAdapter(), remote = new RemoteAdapter()) {
    this.a = adapter;
    this.remote = remote;
  }
  index() {
    try {
      return JSON.parse(localStorage.getItem(IDX)) || [];
    } catch {
      return [];
    }
  }
  list() {
    this.legacy();
    return this.index().sort((a, b) => b.savedAt - a.savedAt);
  }
  entry(st, role) {
    return {
      code: st.meta.roomCode,
      name: st.meta.farmName,
      role,
      day: st.world.day,
      worldT: st.world.t || 0,
      savedAt: Date.now(),
      players: Object.values(st.players || {}).map((p) => p.name).filter(Boolean).slice(0, 4),
    };
  }
  writeIndex(e) {
    const ix = this.index().filter((x) => x.code !== e.code);
    ix.push(e);
    try {
      localStorage.setItem(IDX, JSON.stringify(ix));
    } catch { /* quota */ }
  }
  // Đồng bộ danh sách các farm đã lưu trên Server về máy hiện tại
  async syncFromServer() {
    const remoteFarms = await this.remote.listFarms();
    if (!remoteFarms.length) return this.list();
    const localIx = this.index();
    let changed = false;
    for (const rf of remoteFarms) {
      const existing = localIx.find((x) => x.code === rf.code);
      if (!existing) {
        localIx.push({ ...rf, cloud: true });
        changed = true;
      } else if ((rf.worldT || 0) > (existing.worldT || 0) || rf.day > existing.day) {
        Object.assign(existing, {
          name: rf.name || existing.name,
          day: Math.max(existing.day || 1, rf.day || 1),
          worldT: Math.max(existing.worldT || 0, rf.worldT || 0),
          savedAt: Math.max(existing.savedAt || 0, rf.savedAt || 0),
          players: rf.players?.length ? rf.players : existing.players,
          cloud: true,
        });
        changed = true;
      }
    }
    if (changed) {
      try {
        localStorage.setItem(IDX, JSON.stringify(localIx));
      } catch { /* ignore */ }
    }
    return this.list();
  }
  async save(st, role = 'host') {
    const c = st?.meta?.roomCode;
    if (!c) return;
    st.meta.updatedAt = Date.now();
    const s = JSON.stringify(st);
    try {
      localStorage.setItem(KEY(c), s);
    } catch { /* quota */ }
    await this.a.set(KEY(c), s);
    this.writeIndex(this.entry(st, role));
    // Đẩy bản lưu lên Server để cả 2 máy ở 2 nơi đều có dữ liệu mới nhất
    await this.remote.set(c, st);
  }
  saveSync(st, role = 'host') {
    const c = st?.meta?.roomCode;
    if (!c) return;
    st.meta.updatedAt = Date.now();
    const s = JSON.stringify(st);
    try {
      localStorage.setItem(KEY(c), s);
    } catch { /* quota */ }
    this.writeIndex(this.entry(st, role));
    this.remote.beacon(c, s);
  }
  async load(code) {
    let localStr = await this.a.get(KEY(code));
    if (!localStr) localStr = localStorage.getItem(KEY(code));
    let localState = null;
    try {
      localState = localStr ? JSON.parse(localStr) : null;
    } catch {
      localState = null;
    }

    // Kiểm tra bản lưu trên Cloud Server xem bản nào mới hơn
    const remoteState = await this.remote.get(code);
    if (remoteState && remoteState.world) {
      const localT = localState?.world?.t || 0;
      const remoteT = remoteState?.world?.t || 0;
      const localUp = localState?.meta?.updatedAt || 0;
      const remoteUp = remoteState?.meta?.updatedAt || 0;
      if (!localState || remoteT > localT || (remoteT === localT && remoteUp > localUp)) {
        localState = remoteState;
        const s = JSON.stringify(remoteState);
        try {
          localStorage.setItem(KEY(code), s);
        } catch { /* ignore */ }
        await this.a.set(KEY(code), s);
        this.writeIndex(this.entry(remoteState, 'host'));
      }
    }
    return localState;
  }
  async remove(code) {
    localStorage.removeItem(KEY(code));
    await this.a.del(KEY(code));
    await this.remote.del(code);
    try {
      localStorage.setItem(IDX, JSON.stringify(this.index().filter((x) => x.code !== code)));
    } catch { /* ignore */ }
  }
  // Xuất bản lưu ra file .json để cất giữ lâu dài
  async exportFile(code) {
    const st = await this.load(code);
    if (!st) return false;
    const blob = new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `farm-${code}-ngay-${st.world?.day || 1}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  }
  // Nhập bản lưu từ file .json
  async importFile(file) {
    const text = await file.text();
    const st = JSON.parse(text);
    if (!st?.meta?.roomCode || !st?.world) throw new Error('File lưu không hợp lệ');
    await this.save(st, 'host');
    return st;
  }
  legacy() {
    const old = localStorage.getItem(CFG.SAVE_KEY);
    if (!old || this.index().length) return;
    try {
      const st = JSON.parse(old);
      if (st.meta?.roomCode) {
        localStorage.setItem(KEY(st.meta.roomCode), old);
        this.writeIndex(this.entry(st, 'host'));
      }
    } catch { /* ignore */ }
  }
  profile() {
    try {
      return JSON.parse(localStorage.getItem(CFG.PROFILE_KEY)) || null;
    } catch {
      return null;
    }
  }
  saveProfile(p) {
    try {
      localStorage.setItem(CFG.PROFILE_KEY, JSON.stringify(p));
    } catch { /* ignore */ }
  }
}
