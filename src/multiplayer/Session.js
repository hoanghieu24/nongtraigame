// Session: Host (cũng là solo) / Client. Host nắm Sim (authoritative); client chỉ gửi command + nhận ops/snapshot.
// Transport: BroadcastChannel (cùng máy, 0 cấu hình) + PeerJS WebRTC (khác máy, nạp lazy). Giao thức độc lập transport => sau này thay WebSocket/server dễ.
import { Store } from '../state/Store.js';
import { Sim } from '../state/Sim.js';
import { createGameState, migrate } from '../state/GameState.js';
import { ASTATE, ASUB } from '../data/animals.js';
import { CFG } from '../core/Config.js';

const NPC_ST = ['idle', 'walk', 'scared'];
export const makeCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[(Math.random() * 32) | 0]).join('');
const r2 = (v) => Math.round(v * 100) / 100;
const PEER_CONFIG = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  },
};

export class Session {
  constructor(game) { this.game = game; this.role = 'none'; this.myId = ''; this.peers = new Map(); this.remotePoses = {}; this.code = ''; this.status = { bc: false, peer: '' }; this.acc = { ops: 0, snap: 0, pose: 0 }; this.seq = 0; this.timers = []; }
  get store() { return this.game.store; }
  get isHost() { return this.role === 'host'; }
  get poses() { return this.isHost ? this.game.sim.poses : this.remotePoses; }

  // ---------- HOST ----------
  startHost({ profile, state, farmName }) {
    this.stop(); const store = this.store;
    this.hostProfile = profile;
    if (state) { store.replace(migrate(state)); store.state.meta.hostId = profile.id; } else store.replace(createGameState({ farmName, hostId: profile.id, roomCode: makeCode() }));
    if (!store.state.meta.roomCode) store.state.meta.roomCode = makeCode(); if (!store.state.meta.hostId) store.state.meta.hostId = profile.id;
    const sim = new Sim(store); this.game.sim = sim; if (state) sim.reload(); sim.addPlayer(profile); this.role = 'host'; this.myId = profile.id; this.code = store.state.meta.roomCode;
    sim.bus.on('fx', (f) => this.routeFx(f)); store.flush(); this.openRoom(); return sim;
  }
  openRoom() {
    try { this.bc = new BroadcastChannel('ffp-room-' + this.code); this.bcId = 'h' + Math.random().toString(36).slice(2, 8); this.status.bc = true;
      this.bc.onmessage = (e) => { const m = e.data; if (m.to && m.to !== this.bcId && m.to !== '*') return; if (m.from === this.bcId) return; this.onHostMsg({ kind: 'bc', id: m.from, send: (msg) => this.bc.postMessage({ from: this.bcId, to: m.from, msg }) }, m.msg); };
    } catch { this.status.bc = false; }
    if (!new URLSearchParams(location.search).has('nopeer') && navigator.onLine) this.openPeerHost();
  }
  async openPeerHost() {
    try {
      const { default: Peer } = await import('peerjs');
      const peer = new Peer('ffp-' + this.code, PEER_CONFIG);
      this.peer = peer;
      this.status.peer = 'connecting';
      peer.on('open', () => { this.status.peer = 'open'; this.game.ui?.refreshRoom?.(); });
      peer.on('error', (e) => {
        if (e?.type === 'unavailable-id' && this.hostProfile) {
          // Máy kia đang mở nông trại này rồi -> tự động kết nối vào chơi chung!
          this.status.peer = 'busy';
          this.game.ui?.toast('👫 Máy kia đang mở nông trại! Đang tự động vào chơi cùng...', 'info');
          const code = this.code, prof = this.hostProfile;
          setTimeout(() => { this.game.joinFarm(code, prof).catch(() => {}); }, 250);
          return;
        }
        this.status.peer = e?.type === 'unavailable-id' ? 'busy' : 'error';
        this.game.ui?.refreshRoom?.();
      });
      peer.on('connection', (conn) => { const w = { kind: 'peer', id: conn.peer, send: (msg) => conn.open && conn.send(msg), conn }; conn.on('data', (m) => this.onHostMsg(w, m)); conn.on('close', () => this.dropPeerBy(conn.peer)); });
    } catch { this.status.peer = 'error'; }
  }
  onHostMsg(w, m) {
    const sim = this.game.sim, st = this.store.state; if (!m || !sim) return;
    if (m.t === 'hello') {
      if (this.connectedCount() >= CFG.MAX_PLAYERS - 1 && ![...this.peers.values()].some((p) => p.pid === m.profile.id)) return w.send({ t: 'full' });
      const prev = [...this.peers.entries()].find(([, p]) => p.pid === m.profile.id); if (prev) this.peers.delete(prev[0]);
      sim.addPlayer(m.profile); this.peers.set(w.id, { w, pid: m.profile.id, seen: performance.now() }); this.store.flush();
      w.send({ t: 'welcome', id: m.profile.id, state: JSON.parse(JSON.stringify(st)) }); this.game.ui?.toast(`${st.players[m.profile.id].name} vào nông trại!`, 'good'); this.game.audio?.sfx('bell');
      this.game.persist?.(false);
      return;
    }
    const peer = this.peers.get(w.id); if (!peer) return; peer.seen = performance.now(); const pid = peer.pid;
    if (m.t === 'cmd') { const r = sim.exec(pid, m.c); if (r.ok === false && r.msg) { /* toast gửi riêng qua fx */ } }
    else if (m.t === 'pose') sim.setPose(pid, { x: m.p[0], z: m.p[1], rot: m.p[2], anim: m.p[3], tool: m.p[4], area: m.p[5], spd: m.p[6] });
    else if (m.t === 'chat') this.broadcastChat(pid, String(m.text).slice(0, 120));
    else if (m.t === 'bye') this.dropPeerBy(w.id);
  }
  dropPeerBy(id) { const p = this.peers.get(id); if (!p) return; this.peers.delete(id); this.game.sim?.removePlayer(p.pid); this.game.persist?.(false); this.game.ui?.toast(`${this.store.state.players[p.pid]?.name || 'Bạn bè'} đã rời đi (Đã lưu Cloud 💾)`, 'info'); }
  connectedCount() { return this.peers.size; }
  toPeer(pid, msg) { for (const p of this.peers.values()) if (p.pid === pid) p.w.send(msg); }
  broadcast(msg) { for (const p of this.peers.values()) p.w.send(msg); }
  routeFx(f) {
    if (f.to && f.to !== this.myId) { this.toPeer(f.to, { t: 'fx', f }); return; }
    this.game.handleFx(f); if (!f.to) this.broadcast({ t: 'fx', f });
  }
  broadcastChat(pid, text) { const name = this.store.state.players[pid]?.name || '?'; const m = { t: 'chat', from: pid, name, text }; this.game.onChat(m); this.broadcast(m); }

  // ---------- CLIENT ----------
  join(code, profile) {
    this.stop(); code = code.trim().toUpperCase(); this.code = code;
    return new Promise((resolve, reject) => {
      let done = false; const fin = (ok, err) => { if (done) return; done = true; clearTimeout(t1); clearTimeout(t2); ok ? resolve() : reject(new Error(err)); };
      const onMsg = (m) => this.onClientMsg(m, () => fin(true), (e) => fin(false, e));
      // 1) cùng máy qua BroadcastChannel
      try { this.bc = new BroadcastChannel('ffp-room-' + code); this.bcId = 'c' + Math.random().toString(36).slice(2, 8); this.bc.onmessage = (e) => { const m = e.data; if (m.to && m.to !== this.bcId) return; if (m.from === this.bcId) return; this.hostBc = m.from; onMsg(m.msg); };
        this.sendRaw = (msg) => this.bc.postMessage({ from: this.bcId, to: this.hostBc || '*', msg }); this.sendRaw({ t: 'hello', profile }); } catch { /* ignore */ }
      const t1 = setTimeout(() => { if (done || this.role === 'client') return;
        // 2) khác máy qua WebRTC
        if (new URLSearchParams(location.search).has('nopeer')) return fin(false, 'Không tìm thấy phòng trên máy này');
        import('peerjs').then(({ default: Peer }) => { const peer = new Peer(PEER_CONFIG); this.peer = peer; peer.on('error', () => fin(false, 'Không kết nối được. Kiểm tra mã phòng & mạng nhé!'));
          peer.on('open', () => { const conn = peer.connect('ffp-' + code, { reliable: true }); this.conn = conn; conn.on('open', () => { this.sendRaw = (msg) => conn.open && conn.send(msg); conn.send({ t: 'hello', profile }); }); conn.on('data', onMsg); conn.on('close', () => this.game.onDisconnected()); });
        }).catch(() => fin(false, 'Không tải được WebRTC'));
      }, 900);
      const t2 = setTimeout(() => fin(false, 'Hết thời gian chờ. Chủ farm đã mở game chưa?'), 14000);
    });
  }
  onClientMsg(m, ok, bad) {
    const store = this.store, st = store.state;
    switch (m.t) {
      case 'welcome': this.role = 'client'; this.myId = m.id; this.game.sim = null; store.replace(m.state); this.code = m.state.meta.roomCode; this.game.onJoined(); ok(); break;
      case 'full': bad('Phòng đã đủ 4 người!'); break;
      case 'ops': store.applyOps(m.ops); break;
      case 'snap': this.applySnap(m); break;
      case 'poses': for (const k in m.P) if (k !== this.myId) this.remotePoses[k] = m.P[k]; for (const k in this.remotePoses) if (!(k in m.P) && k !== this.myId) delete this.remotePoses[k]; break;
      case 'fx': this.game.handleFx(m.f); break;
      case 'chat': this.game.onChat(m); break;
    }
  }
  applySnap(m) {
    const st = this.store.state;
    for (const r of m.a || []) { const a = st.animals[r[0]]; if (!a) continue; a.x = r[1]; a.z = r[2]; a.r = r[3]; a.st = ASTATE[r[4]]; a.sub = ASUB[r[5]]; a.hunger = r[6] / 100; a.happy = r[7] / 100; a.growth = r[8] / 100; a.ready = !!r[9]; a.golden = !!r[10]; a.area = r[11] ? 'house' : 'out'; a.starving = r[12]; }
    for (const r of m.n || []) { const n = st.npcs[r[0]]; if (n) { n.x = r[1]; n.z = r[2]; n.r = r[3]; n.st = NPC_ST[r[4]]; } }
    for (const r of m.zb || []) { const z = st.zombies[r[0]]; if (z) { z.x = r[1]; z.z = r[2]; z.r = r[3]; } }
    for (const r of m.th || []) { const t = st.thieves[r[0]]; if (t) { t.x = r[1]; t.z = r[2]; t.r = r[3]; } }
    if (m.w !== undefined) st.world.t = m.w;
  }
  makeSnap() {
    const st = this.store.state, snap = { t: 'snap', w: r2(st.world.t), a: [], n: [], th: [], zb: [] };
    for (const a of Object.values(st.animals)) snap.a.push([a.id, r2(a.x), r2(a.z), r2(a.r), ASTATE.indexOf(a.st), Math.max(0, ASUB.indexOf(a.sub || '')), Math.round(a.hunger * 100), Math.round(a.happy * 100), Math.round(a.growth * 100), a.ready ? 1 : 0, a.golden ? 1 : 0, a.area === 'house' ? 1 : 0, Math.round(a.starving || 0)]);
    for (const n of Object.values(st.npcs)) snap.n.push([n.id, r2(n.x), r2(n.z), r2(n.r), Math.max(0, NPC_ST.indexOf(n.st))]);
    for (const t of Object.values(st.thieves)) snap.th.push([t.id, r2(t.x), r2(t.z), r2(t.r)]);
    for (const z of Object.values(st.zombies)) snap.zb.push([z.id, r2(z.x), r2(z.z), r2(z.r)]);
    return snap;
  }
  stop() { try { this.sendRaw && this.role === 'client' && this.sendRaw({ t: 'bye' }); } catch { /* ignore */ } try { this.bc?.close(); this.peer?.destroy(); } catch { /* ignore */ } this.peers.clear(); this.bc = this.peer = this.conn = null; this.role = 'none'; this.remotePoses = {}; this.status = { bc: false, peer: '' }; }

  // ---------- API dùng chung ----------
  send(cmd) {
    if (this.role === 'host') return this.game.sim.exec(this.myId, cmd);
    if (this.role === 'client') this.sendRaw?.({ t: 'cmd', c: cmd }); return { ok: true };
  }
  sendPose(pose) {
    if (this.role === 'host') this.game.sim.setPose(this.myId, pose);
    else if (this.role === 'client') this.sendRaw?.({ t: 'pose', p: [r2(pose.x), r2(pose.z), r2(pose.rot), pose.anim, pose.tool, pose.area, r2(pose.spd || 0)] });
  }
  sendChat(text) { if (this.role === 'host') this.broadcastChat(this.myId, text.slice(0, 120)); else this.sendRaw?.({ t: 'chat', text }); }
  tick(dt) {
    const g = this.game;
    if (this.role === 'client') { g.store.state.world.t += dt; return; }
    if (this.role !== 'host') return;
    g.sim.tick(dt); const A = this.acc; A.ops += dt; A.snap += dt; A.pose += dt;
    if (A.ops >= 1 / CFG.NET.OPS_HZ) { A.ops = 0; const ops = this.store.flush(); if (ops && this.peers.size) this.broadcast({ t: 'ops', ops }); }
    if (this.peers.size) {
      if (A.snap >= 1 / CFG.NET.SNAP_HZ) { A.snap = 0; this.broadcast(this.makeSnap()); }
      if (A.pose >= 1 / CFG.NET.POSE_HZ) { A.pose = 0; const P = {}; for (const [id, p] of Object.entries(g.sim.poses)) P[id] = { x: r2(p.x), z: r2(p.z), rot: r2(p.rot || 0), anim: p.anim, tool: p.tool, area: p.area, spd: r2(p.spd || 0) }; this.broadcast({ t: 'poses', P }); }
      const now = performance.now(); for (const [id, p] of [...this.peers]) if (p.w.kind === 'bc' && now - p.seen > 9000) this.dropPeerBy(id);
    } else this.store.flush();
  }
}
