// Bếp hợp tác 2D: chuẩn bị nguyên liệu, nấu, phục vụ và rửa bát trong một ca chung.
// - Chỉ có duy nhất nhân vật người chơi (YOU - mặc đồ khủng long cam có đuôi, không có bot) tự vận hành quán.
// - Tương thích tuyệt đối trên Điện Thoại (kể cả khi xoay ngang 90° bằng Viewport.js VP.rot):
//   + Không kéo giãn/méo hình trên màn hình điện thoại dài (20:9, 19.5:9) nhờ hệ quy chiếu đồng nhất (viewScale, viewOffsetX, viewOffsetY).
//   + Chạm bất kỳ đâu (kể cả góc dưới-trái) đều nhận diện chính xác giữa Chạm (Tap -> Tự tìm đường A* & tự thao tác) và Kéo (Drag -> Lái bằng Joystick mượt mà).
//   + Tự động tương tác thông minh khi bạn lái nhân vật bằng Joystick đứng cạnh trạm bếp (0.18s) hoặc khi bấm nút [⚡ THAO TÁC].

import { clamp, fmt } from '../core/util.js';
import { VP, toLocal } from '../core/Viewport.js';
import {
  KITCHEN_TIMINGS,
  KITCHEN_RECIPES,
  PlayerController,
  StationLogic,
  CrisisManager,
  DifficultyDirector,
} from './KitchenLogic.js';

const W = 1280, H = 760;
const CHEF_R = 17;
const NAV_STEP = 16;
const NAV_COLS = Math.ceil(W / NAV_STEP);
const NAV_ROWS = Math.ceil(H / NAV_STEP);

// Toạ độ các trạm tương tác trong Pizzeria khớp 100% bố cục ảnh mẫu Coatsink Ready, Set, Cook!
const STATIONS = {
  // Góc dưới trái: Nguyên liệu tươi (Cà chua mở từ Phase 1, Phô mai & Đế bánh mở ở Phase 3 Level Up)
  mozzarella:   { id: 'mozzarella',   kind: 'crate',        ing: 'mozzarella', label: 'Thùng Phô Mai 🧀',   x: 132,  y: 640, standX: 212,  standY: 642 },
  tomato:       { id: 'tomato',       kind: 'crate',        ing: 'tomato',     label: 'Thùng Cà Chua 🍅',   x: 228,  y: 562, standX: 298,  standY: 562 },
  dough:        { id: 'dough',        kind: 'dough',        ing: 'dough',      label: 'Đế Bánh Pizza 🫓',   x: 382,  y: 576, standX: 382,  standY: 496 },
  // Góc dưới phải: 2 Thớt thái nguyên liệu (giữ 3.0s để cắt gọt)
  board0:       { id: 'board0',       kind: 'board',        idx: 0,            label: 'Thớt 1 (3.0s)',      x: 1126, y: 545, standX: 1046, standY: 545 },
  board1:       { id: 'board1',       kind: 'board',        idx: 1,            label: 'Thớt 2 (3.0s)',      x: 1126, y: 638, standX: 1046, standY: 638 },
  // Sát tường phải giữa: Máy Rót Trà Sữa Trân Châu (rót 2.5s)
  drink:        { id: 'drink',        kind: 'drink',                           label: 'Máy Trà Sữa 🧋',     x: 1142, y: 352, standX: 1062, standY: 356 },
  // 2 Đĩa sứ trắng viền xanh đặt trên 2 Quầy Gỗ Uốn Cong để ghép món (Plating)
  plateTop:     { id: 'plateTop',     kind: 'plate',        idx: 0,            label: 'Bát ghép #1',        x: 358,  y: 252, standX: 410,  standY: 274 },
  plateBot:     { id: 'plateBot',     kind: 'plate',        idx: 1,            label: 'Bát ghép #2',        x: 942,  y: 456, standX: 908,  standY: 398, altStandX: 1018, altStandY: 498 },
  // Góc trên phải: Lò Nướng Gạch 2 Vòm Lửa (nướng 5.0s -> 5.0s an toàn -> CHÁY!) & Bình Chữa Cháy (giữ 3.0s)
  extinguisher: { id: 'extinguisher', kind: 'extinguisher',                    label: 'Bình Chữa Cháy 🧯',  x: 826,  y: 196, standX: 830,  standY: 258 },
  oven0:        { id: 'oven0',        kind: 'oven',         idx: 0,            label: 'Lò Nướng 1 (5s)',    x: 915,  y: 135, standX: 915,  standY: 222 },
  oven1:        { id: 'oven1',        kind: 'oven',         idx: 1,            label: 'Lò Nướng 2 (5s)',    x: 1072, y: 135, standX: 1072, standY: 222 },
  // Góc trên trái: Bồn rửa bát (giữ 2.0s/bát), Thùng rác xanh (huỷ đồ cầm nhầm / đồ cháy), Kệ 4 bát sạch
  sink:         { id: 'sink',         kind: 'sink',                            label: 'Bồn rửa (2.0s)',     x: 128,  y: 226, standX: 204,  standY: 226 },
  trash:        { id: 'trash',        kind: 'trash',                           label: 'Thùng rác 🗑️',       x: 124,  y: 318, standX: 204,  standY: 286 },
  dirtyRack:    { id: 'dirtyRack',    kind: 'rack',                            label: 'Kệ 4 bát',           x: 322,  y: 112, standX: 322,  standY: 184 },
};

// Thời gian chuẩn chỉnh từng công đoạn theo State Machine
const MAX_PLATES = KITCHEN_TIMINGS.MAX_PLATES;               // 4 bát/đĩa luân chuyển trong quán
const CHOP_SECONDS = KITCHEN_TIMINGS.CHOP_SECONDS;           // 3.0 giây giữ để thái nguyên liệu
const BAKE_SECONDS = KITCHEN_TIMINGS.COOK_SECONDS;           // 5.0 giây nướng trên bếp/lò
const BURN_SECONDS = KITCHEN_TIMINGS.SAFE_WINDOW_SECONDS;    // 5.0 giây trạng thái chín hoàn hảo trước khi BỐC CHÁY (FIRE!)
const EXTINGUISH_SECONDS = KITCHEN_TIMINGS.EXTINGUISH_SECONDS; // 3.0 giây cầm Bình Chữa Cháy dập lửa
const POUR_SECONDS = KITCHEN_TIMINGS.POUR_SECONDS;           // 2.5 giây rót Trà Sữa Trân Châu
const WASH_SECONDS = KITCHEN_TIMINGS.WASH_SECONDS;           // 2.0 giây giữ ở Bồn Rửa để rửa sạch bát bẩn

const RECIPES_2D = {
  tomato_salad: { name: 'Salad Cà Chua',     price: KITCHEN_RECIPES.tomato_salad.price },
  caprese:      { name: 'Salad Caprese',     price: KITCHEN_RECIPES.caprese.price },
  pizza:        { name: 'Pizza Đút Lò',      price: KITCHEN_RECIPES.pizza.price },
  soda:         { name: 'Trà Sữa Trân Châu', price: KITCHEN_RECIPES.soda.price },
};

// 5 Bàn ăn trong phòng (2 Bàn Sofa Đỏ + 3 Bàn Vuông Khăn Trắng)
const TABLES = [
  { id: 0, name: 'Bàn #1', kind: 'boothH', x: 204, y: 456, seatX: 204, seatY: 404, walkX: 308, walkY: 412, standX: 308, standY: 456, bubbleX: 308, bubbleY: 382 },
  { id: 1, name: 'Bàn #2', kind: 'boothV', x: 680, y: 162, seatX: 734, seatY: 182, walkX: 680, walkY: 256, standX: 680, standY: 258, bubbleX: 680, bubbleY: 102 },
  { id: 2, name: 'Bàn #3', kind: 'square', x: 605, y: 342, rot: 0,     seatX: 552, seatY: 342, walkX: 540, walkY: 342, standX: 605, standY: 414, bubbleX: 552, bubbleY: 276 },
  { id: 3, name: 'Bàn #4', kind: 'square', x: 472, y: 455, rot: -0.52, seatX: 504, seatY: 424, walkX: 525, walkY: 415, standX: 532, standY: 486, bubbleX: 446, bubbleY: 368 },
  { id: 4, name: 'Bàn #5', kind: 'square', x: 762, y: 378, rot: 0.55,  seatX: 794, seatY: 346, walkX: 798, walkY: 312, standX: 696, standY: 378, bubbleX: 768, bubbleY: 304 },
];

// Danh sách vật cản hình chữ nhật (tường, quầy bếp, sofa đỏ, lò nướng)
const RECT_OBSTACLES = [
  { x0: 80,   y0: 28,  x1: 354,  y1: 152 },
  { x0: 80,   y0: 150, x1: 164,  y1: 364 },
  { x0: 354,  y0: 28,  x1: 814,  y1: 122 },
  { x0: 814,  y0: 28,  x1: 840,  y1: 242 },
  { x0: 838,  y0: 28,  x1: 1184, y1: 186 },
  { x0: 1114, y0: 312, x1: 1184, y1: 412 },
  { x0: 1086, y0: 494, x1: 1184, y1: 690 },
  { x0: 138,  y0: 398, x1: 266,  y1: 510 },
  { x0: 608,  y0: 102, x1: 754,  y1: 222 },
  { x0: 80,   y0: 528, x1: 264,  y1: 598 },
  { x0: 80,   y0: 596, x1: 172,  y1: 690 },
  { x0: 342,  y0: 534, x1: 424,  y1: 634 },
];

// Danh sách vật cản hình tròn (3 bàn ăn vuông + chuỗi đường cong của 2 Quầy Gỗ Uốn Cong)
const CIRCLE_OBSTACLES = [
  { x: 605, y: 342, r: 41 },
  { x: 472, y: 455, r: 37 },
  { x: 762, y: 378, r: 37 },
  // Quầy Gỗ Uốn Cong #1 (Góc trên-trái)
  { x: 106, y: 376, r: 20 },
  { x: 145, y: 368, r: 20 },
  { x: 184, y: 356, r: 20 },
  { x: 222, y: 341, r: 20 },
  { x: 258, y: 322, r: 20 },
  { x: 294, y: 299, r: 20 },
  { x: 326, y: 276, r: 20 },
  { x: 356, y: 252, r: 21 },
  // Quầy Gỗ Uốn Cong #2 (Góc dưới-phải)
  { x: 748, y: 574, r: 20 },
  { x: 762, y: 538, r: 20 },
  { x: 785, y: 506, r: 20 },
  { x: 816, y: 482, r: 20 },
  { x: 854, y: 466, r: 20 },
  { x: 896, y: 456, r: 20 },
  { x: 942, y: 450, r: 21 },
  { x: 988, y: 446, r: 20 },
];

const DOOR_POS = { x: 512, y: 148 };
const JOY_HOME = { x: 195, y: 726, r: 30 };
const ACT_BTN = { x: 1075, y: 726, r: 30 };
const STAR_GOALS = [300, 750, 1400];

const CUSTOMER_STYLES = [
  { hair: '#f4b41a', shirt: '#d32f2f', skin: '#e8a87c', bun: false, band: null, vip: false },
  { hair: '#f5d061', shirt: '#c62828', skin: '#f3c6a0', bun: true,  band: '#e53935', vip: false },
  { hair: '#4a2c18', shirt: '#7e57c2', skin: '#c68b59', bun: false, band: null, vip: true },
  { hair: '#263238', shirt: '#039be5', skin: '#f5cba7', bun: false, band: null, vip: false },
  { hair: '#bf360c', shirt: '#43a047', skin: '#ffdbac', bun: true,  band: '#fdd835', vip: true },
];

export class ReadySetCook2D {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.showTip = false;
    this.helperOn = false; // Hỗ trợ tự nhận đơn là tuỳ chọn; hai người phối hợp theo lượt mặc định.
    this.t = 0;
    this.timer = KITCHEN_TIMINGS.MATCH_SECONDS; // 180s chuẩn 3 Phase (0-60s, 61-120s, 121-180s)
    this.earned = 0;
    this.served = 0;
    this.combo = 0;
    this.feverT = 0;
    this.starsReached = 0;
    this.floats = [];
    this.particles = [];
    this.tapRipples = [];
    this.touchJoy = {
      active: false,
      dragging: false,
      id: null,
      downX: 0,
      downY: 0,
      moved: 0,
      sx: JOY_HOME.x,
      sy: JOY_HOME.y,
      cx: JOY_HOME.x,
      cy: JOY_HOME.y,
      dx: 0,
      dy: 0,
    };
    this.dpr = 1;
    this.viewScale = 1;
    this.viewOffsetX = 0;
    this.viewOffsetY = 0;
    this.joyDwellT = 0;
    this.lastDwellKey = '';

    // Khởi tạo 4 Module Game Logic chuẩn chỉnh:
    this.playerController = new PlayerController(this);
    this.stationLogic = new StationLogic(this);
    this.crisisManager = new CrisisManager(this);
    this.difficultyDirector = new DifficultyDirector(this);

    this.buildNavGrid();
    this.buildFloorCache();
    this.buildDom();
    this.resetState();
  }

  getStation(id) {
    return STATIONS[id] || null;
  }

  isChefNearStation(chef, st) {
    if (!chef || !st) return false;
    return (
      Math.hypot(chef.x - st.standX, chef.y - st.standY) < 72 ||
      Math.hypot(chef.x - st.x, chef.y - st.y) < 92 ||
      (st.altStandX ? Math.hypot(chef.x - st.altStandX, chef.y - st.altStandY) < 72 : false)
    );
  }

  buildNavGrid() {
    this.navGrid = new Uint8Array(NAV_COLS * NAV_ROWS);
    const pad = CHEF_R - 1;
    for (let r = 0; r < NAV_ROWS; r++) {
      for (let c = 0; c < NAV_COLS; c++) {
        const px = (c + 0.5) * NAV_STEP;
        const py = (r + 0.5) * NAV_STEP;
        let blocked = false;
        if (px < 104 || px > 1166 || py < 138 || py > 676) {
          blocked = true;
        }
        if (!blocked) {
          for (const q of RECT_OBSTACLES) {
            const cx = clamp(px, q.x0, q.x1);
            const cy = clamp(py, q.y0, q.y1);
            if (Math.hypot(px - cx, py - cy) < pad) {
              blocked = true;
              break;
            }
          }
        }
        if (!blocked) {
          for (const o of CIRCLE_OBSTACLES) {
            if (Math.hypot(px - o.x, py - o.y) < o.r + pad) {
              blocked = true;
              break;
            }
          }
        }
        this.navGrid[r * NAV_COLS + c] = blocked ? 1 : 0;
      }
    }
  }

  isPointWalkable(px, py, pad = CHEF_R - 2) {
    if (px < 102 || px > 1168 || py < 136 || py > 678) return false;
    for (const q of RECT_OBSTACLES) {
      const cx = clamp(px, q.x0, q.x1);
      const cy = clamp(py, q.y0, q.y1);
      if (Math.hypot(px - cx, py - cy) < pad) return false;
    }
    for (const o of CIRCLE_OBSTACLES) {
      if (Math.hypot(px - o.x, py - o.y) < o.r + pad) return false;
    }
    return true;
  }

  hasLineOfSight(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(2, Math.ceil(dist / 8));
    for (let i = 1; i < steps; i++) {
      const k = i / steps;
      if (!this.isPointWalkable(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, CHEF_R - 3)) {
        return false;
      }
    }
    return true;
  }

  findPath(x0, y0, x1, y1) {
    const tx = clamp(x1, 108, 1162);
    const ty = clamp(y1, 142, 672);
    if (this.hasLineOfSight(x0, y0, tx, ty)) {
      return [{ x: tx, y: ty }];
    }

    const toCell = (px, py) => {
      let c = clamp(Math.floor(px / NAV_STEP), 1, NAV_COLS - 2);
      let r = clamp(Math.floor(py / NAV_STEP), 1, NAV_ROWS - 2);
      if (this.navGrid[r * NAV_COLS + c] === 0) return { c, r };
      let best = { c, r }, bestD = 999;
      for (let dr = -4; dr <= 4; dr++) {
        for (let dc = -4; dc <= 4; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 1 && nr < NAV_ROWS - 1 && nc >= 1 && nc < NAV_COLS - 1 && this.navGrid[nr * NAV_COLS + nc] === 0) {
            const d = dr * dr + dc * dc;
            if (d < bestD) { bestD = d; best = { c: nc, r: nr }; }
          }
        }
      }
      return best;
    };

    const start = toCell(x0, y0);
    const goal = toCell(tx, ty);
    const startIdx = start.r * NAV_COLS + start.c;
    const goalIdx = goal.r * NAV_COLS + goal.c;
    if (startIdx === goalIdx) return [{ x: tx, y: ty }];

    const N = NAV_COLS * NAV_ROWS;
    const gScore = new Float32Array(N).fill(1e9);
    const fScore = new Float32Array(N).fill(1e9);
    const cameFrom = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const open = [startIdx];

    gScore[startIdx] = 0;
    fScore[startIdx] = Math.hypot(goal.c - start.c, goal.r - start.r);

    const dirs = [
      [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
      [-1, -1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [1, 1, 1.414],
    ];

    while (open.length > 0) {
      let bestI = 0;
      for (let i = 1; i < open.length; i++) {
        if (fScore[open[i]] < fScore[open[bestI]]) bestI = i;
      }
      const cur = open[bestI];
      open.splice(bestI, 1);
      if (cur === goalIdx) break;
      if (closed[cur]) continue;
      closed[cur] = 1;

      const cr = (cur / NAV_COLS) | 0;
      const cc = cur % NAV_COLS;

      for (const [dc, dr, cost] of dirs) {
        const nc = cc + dc, nr = cr + dr;
        if (nc < 1 || nc >= NAV_COLS - 1 || nr < 1 || nr >= NAV_ROWS - 1) continue;
        const nIdx = nr * NAV_COLS + nc;
        if (closed[nIdx] || this.navGrid[nIdx]) continue;
        if (dc !== 0 && dr !== 0) {
          if (this.navGrid[cr * NAV_COLS + nc] || this.navGrid[nr * NAV_COLS + cc]) continue;
        }
        const ng = gScore[cur] + cost;
        if (ng < gScore[nIdx]) {
          cameFrom[nIdx] = cur;
          gScore[nIdx] = ng;
          fScore[nIdx] = ng + Math.hypot(goal.c - nc, goal.r - nr);
          open.push(nIdx);
        }
      }
    }

    const raw = [];
    let curr = goalIdx;
    if (cameFrom[curr] !== -1 || curr === startIdx) {
      while (curr !== -1 && curr !== startIdx) {
        const rr = (curr / NAV_COLS) | 0;
        const cc = curr % NAV_COLS;
        raw.push({ x: (cc + 0.5) * NAV_STEP, y: (rr + 0.5) * NAV_STEP });
        curr = cameFrom[curr];
      }
      raw.reverse();
    }
    raw.push({ x: tx, y: ty });

    const smooth = [];
    let anchorX = x0, anchorY = y0;
    let i = 0;
    while (i < raw.length) {
      let furthest = i;
      for (let j = raw.length - 1; j > i; j--) {
        if (this.hasLineOfSight(anchorX, anchorY, raw[j].x, raw[j].y)) {
          furthest = j;
          break;
        }
      }
      smooth.push(raw[furthest]);
      anchorX = raw[furthest].x;
      anchorY = raw[furthest].y;
      i = furthest + 1;
    }
    return smooth;
  }

  resolveCollisions(entity, r = CHEF_R) {
    entity.x = clamp(entity.x, 104, 1164);
    entity.y = clamp(entity.y, 138, 674);

    for (let pass = 0; pass < 3; pass++) {
      for (const q of RECT_OBSTACLES) {
        const cx = clamp(entity.x, q.x0, q.x1);
        const cy = clamp(entity.y, q.y0, q.y1);
        const dx = entity.x - cx, dy = entity.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          if (d2 > 1e-5) {
            const d = Math.sqrt(d2);
            entity.x = cx + (dx / d) * r;
            entity.y = cy + (dy / d) * r;
          } else {
            const dl = Math.abs(entity.x - q.x0), dr = Math.abs(q.x1 - entity.x);
            const dt = Math.abs(entity.y - q.y0), db = Math.abs(q.y1 - entity.y);
            const m = Math.min(dl, dr, dt, db);
            if (m === dl) entity.x = q.x0 - r;
            else if (m === dr) entity.x = q.x1 + r;
            else if (m === dt) entity.y = q.y0 - r;
            else entity.y = q.y1 + r;
          }
        }
      }
      for (const o of CIRCLE_OBSTACLES) {
        const dx = entity.x - o.x, dy = entity.y - o.y;
        const rr = r + o.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 1e-5) {
          const d = Math.sqrt(d2);
          entity.x = o.x + (dx / d) * rr;
          entity.y = o.y + (dy / d) * rr;
        }
      }
    }
    entity.x = clamp(entity.x, 104, 1164);
    entity.y = clamp(entity.y, 138, 674);
  }

  // Đồng bộ khung nhìn HiDPI & giữ chuẩn tỷ lệ 1280x760 siêu nét 60 FPS trên màn hình Điện Thoại
  syncHiDpi() {
    if (!this.canvas) return;
    const vw = VP?.vw || (typeof window !== 'undefined' ? window.innerWidth : W) || W;
    const vh = VP?.vh || (typeof window !== 'undefined' ? window.innerHeight : H) || H;
    const mobile = this.g?.input?.mobile;
    const dpr = Math.min((typeof window !== 'undefined' ? window.devicePixelRatio : 2) || 2, mobile ? 1.5 : 2, Math.sqrt(2000000 / Math.max(1, vw * vh)));
    const scale = Math.min(vw / W, vh / H);
    this.viewScale = scale;
    this.viewOffsetX = (vw - W * scale) * 0.5;
    this.viewOffsetY = (vh - H * scale) * 0.5;

    const targetW = Math.max(1, Math.round(vw * dpr));
    const targetH = Math.max(1, Math.round(vh * dpr));
    if (this.dpr !== dpr || this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.dpr = dpr;
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
  }

  // Quy đổi toạ độ chạm màn hình chuẩn xác từng pixel trên cả Điện thoại xoay dọc (VP.rot), xoay ngang và PC
  toCanvasCoords(clientX, clientY) {
    this.syncHiDpi();
    const loc = toLocal(clientX, clientY);
    const sx = (loc.x - this.viewOffsetX) / Math.max(0.01, this.viewScale);
    const sy = (loc.y - this.viewOffsetY) / Math.max(0.01, this.viewScale);
    return {
      sx: clamp(sx, 0, W),
      sy: clamp(sy, 0, H),
    };
  }

  buildDom() {
    let wrap = document.getElementById('rsc2d');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'rsc2d';
      wrap.className = 'rsc2d hidden';
      document.getElementById('app').appendChild(wrap);
    }
    wrap.innerHTML = `<canvas id="rsc2dCanvas"></canvas><div class="rscTouchUi"><div class="rscTouchMenu"><button data-kitchen="exit" aria-label="Ra sân">←<small>Ra sân</small></button><button data-kitchen="labels" aria-label="Hiện tên trạm bếp">☷<small>Nhãn</small></button></div><div class="rscTouchOrders"></div><button class="rscTouchAction" data-kitchen="action">⚡<small>Thao tác</small></button></div>`;
    this.wrap = wrap;
    wrap.querySelector('.rscTouchUi').addEventListener('pointerdown', (e) => e.stopPropagation());
    wrap.querySelector('.rscTouchUi').addEventListener('click', (e) => {
      const button = e.target.closest('[data-kitchen]');
      if (!button || !this.active) return;
      e.preventDefault(); e.stopPropagation();
      switch (button.dataset.kitchen) {
        case 'exit': this.close(); break;
        case 'labels': this.showTip = !this.showTip; break;
        case 'action': this.onCanvasTap(this.matchOver ? 530 : ACT_BTN.x, this.matchOver ? 480 : ACT_BTN.y); break;
        case 'order': {
          const guest = this.guests.find((g) => g.id === button.dataset.guest);
          if (guest) this.autoSmartStep(this.myChef, guest.dish, this.tables[guest.tableId]);
          break;
        }
      }
    });
    this.touchOrdersEl = wrap.querySelector('.rscTouchOrders');
    this.touchActionLabel = wrap.querySelector('.rscTouchAction small');
    this.canvas = wrap.querySelector('#rsc2dCanvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.syncHiDpi();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.syncHiDpi());
    }

    const handleDown = (clientX, clientY, pointerId = 1) => {
      if (!this.active) return;
      const { sx, sy } = this.toCanvasCoords(clientX, clientY);
      const onJoyPad = Math.hypot(sx - JOY_HOME.x, sy - JOY_HOME.y) < 56;
      this.touchJoy.active = true;
      this.touchJoy.dragging = onJoyPad;
      this.touchJoy.id = pointerId;
      this.touchJoy.downX = sx;
      this.touchJoy.downY = sy;
      this.touchJoy.moved = 0;
      this.touchJoy.sx = onJoyPad ? JOY_HOME.x : clamp(sx, 95, 420);
      this.touchJoy.sy = onJoyPad ? JOY_HOME.y : clamp(sy, 320, 730);
      this.touchJoy.cx = sx;
      this.touchJoy.cy = sy;
      if (onJoyPad) {
        this.updateJoyDelta(sx, sy);
      } else {
        this.touchJoy.dx = 0;
        this.touchJoy.dy = 0;
      }
    };

    const handleMove = (clientX, clientY, pointerId = 1) => {
      if (!this.active || !this.touchJoy.active) return;
      if (pointerId !== null && this.touchJoy.id !== null && pointerId !== this.touchJoy.id) return;
      const { sx, sy } = this.toCanvasCoords(clientX, clientY);
      const distFromDown = Math.hypot(sx - this.touchJoy.downX, sy - this.touchJoy.downY);
      this.touchJoy.moved = Math.max(this.touchJoy.moved, distFromDown);
      if (!this.touchJoy.dragging && this.touchJoy.moved > 12) {
        this.touchJoy.dragging = true;
        this.touchJoy.sx = this.touchJoy.downX;
        this.touchJoy.sy = this.touchJoy.downY;
      }
      if (this.touchJoy.dragging) {
        this.updateJoyDelta(sx, sy);
      }
    };

    const handleUp = (clientX, clientY, pointerId = 1) => {
      if (!this.touchJoy.active) return;
      if (pointerId !== null && this.touchJoy.id !== null && pointerId !== this.touchJoy.id) return;
      const wasDragging = this.touchJoy.dragging && this.touchJoy.moved > 12;
      const tapX = this.touchJoy.downX;
      const tapY = this.touchJoy.downY;
      this.touchJoy.active = false;
      this.touchJoy.dragging = false;
      this.touchJoy.id = null;
      this.touchJoy.cx = JOY_HOME.x;
      this.touchJoy.cy = JOY_HOME.y;
      this.touchJoy.dx = 0;
      this.touchJoy.dy = 0;
      if (!wasDragging) {
        this.onCanvasTap(tapX, tapY);
      }
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { this.canvas.setPointerCapture?.(e.pointerId); } catch {}
      handleDown(e.clientX, e.clientY, e.pointerId);
    }, { passive: false });

    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', (e) => {
        if (!this.active || !this.touchJoy.active) return;
        handleMove(e.clientX, e.clientY, e.pointerId);
      }, { passive: false });

      window.addEventListener('pointerup', (e) => handleUp(e.clientX, e.clientY, e.pointerId));
      window.addEventListener('pointercancel', (e) => handleUp(e.clientX, e.clientY, e.pointerId));
    }
  }

  updateJoyDelta(sx, sy) {
    const dx = sx - this.touchJoy.sx;
    const dy = sy - this.touchJoy.sy;
    const d = Math.hypot(dx, dy);
    const maxR = 46;
    if (d > 2) {
      const cl = Math.min(d, maxR);
      this.touchJoy.cx = this.touchJoy.sx + (dx / d) * cl;
      this.touchJoy.cy = this.touchJoy.sy + (dy / d) * cl;
      this.touchJoy.dx = (dx / d) * (cl / maxR);
      this.touchJoy.dy = (dy / d) * (cl / maxR);
    } else {
      this.touchJoy.cx = sx;
      this.touchJoy.cy = sy;
      this.touchJoy.dx = 0;
      this.touchJoy.dy = 0;
    }
  }

  resetState() {
    this.shiftId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    this.hasHostState = this.isHost;
    this.netSyncT = 0;
    this.netSendT = 0;
    this.lastClientAction = null;
    this.previousBest = this.g.store?.state?.restaurant?.arcade?.bestScore || 0;
    this.difficultyDirector?.reset();
    this.timer = KITCHEN_TIMINGS.MATCH_SECONDS; // 180 giây chuẩn 3 Phase
    this.matchOver = false;
    this.earned = 0;
    this.served = 0;
    this.combo = 0;
    this.starsReached = 0;
    this.feverT = 0;
    this.floats.length = 0;
    this.particles.length = 0;
    this.tapRipples.length = 0;
    if (this.playerController) this.playerController.activeHoldAction = null;
    this.touchJoy.active = false;
    this.touchJoy.dragging = false;
    this.touchJoy.dx = 0;
    this.touchJoy.dy = 0;
    this.g.input?.resetTouch?.();
    this.maxPlates = MAX_PLATES; // Chuẩn 4 bát/đĩa trong toàn nhà hàng
    this.cleanPlateStack = 2;    // 2 bát sạch trên kệ + 2 bát sạch đặt sẵn trên 2 quầy ghép = 4 bát
    this.boards = [
      { ing: null, prog: 0, ready: false },
      { ing: null, prog: 0, ready: false },
    ];
    this.plates = [
      { hasPlate: true, items: [], dish: null, dirty: false },
      { hasPlate: true, items: [], dish: null, dirty: false },
    ];
    this.ovens = [
      { state: 'idle', prog: 0, burn: 0, extinguishProg: 0 },
      { state: 'idle', prog: 0, burn: 0, extinguishProg: 0 },
    ];
    // Máy rót Trà Sữa Trân Châu: 'idle' -> 'pouring' (2.5s) -> 'ready'
    this.drinkMachine = { state: 'idle', prog: 0, reservedPlate: false };
    // Bồn rửa bát: đưa bát bẩn vào bồn (dirtyCount) rồi đứng giữ 2.0s/bát
    this.sink = { dirtyCount: 0, prog: 0 };

    this.tables = TABLES.map((t) => ({
      ...t,
      guest: null,
      eatingDish: null,
      dirty: false,
      dirtyCount: 0,
      tip: 0,
    }));

    this.guests = [];
    this.spawnInitialGuests();
    this.guestSpawnT = this.difficultyDirector ? this.difficultyDirector.orderSpawnInterval : 25.0;

    // Thiết lập 2 Đầu Bếp Chibi: Hiếu 💙 & Huyền 💖 cùng nấu ăn trong 1 Nhà Hàng!
    this.setupChefs();
    this.sousChef = {
      x: 1025,
      y: 590,
      dir: 0,
      animT: 0,
      actionT: 2.2,
      statusText: '🐱 Mimi sẵn sàng!',
    };
  }

  get isHost() {
    return this.g?.session?.role !== 'client';
  }

  get myChef() {
    return this.chefs?.[this.myChefIndex] || this.chefs?.[0];
  }

  setupChefs({ preserve = false } = {}) {
    const previous = preserve ? this.chefs : null;
    const st = this.g?.store?.state;
    const players = Object.values(st?.players || {}).filter((p) => p.connected);
    const isClient = this.g?.session?.role === 'client';

    const pHost = players.find((p) => p.id === st?.meta?.hostId) || players[0] || { name: 'Hiếu' };
    const pGuest = players.find((p) => p.id !== pHost.id) || players[1] || { name: 'Huyền' };

    const hostName = pHost.name || 'Hiếu';
    const guestName = pGuest.name || 'Huyền';

    this.chefs = [
      {
        id: pHost.id || 'hieu',
        name: hostName,
        present: true,
        tagColor: hostName.includes('Huyền') ? '#f472b6' : '#38bdf8',
        costume: hostName.includes('Huyền') ? 'huyen' : 'hieu',
        x: 520,
        y: 525,
        vx: 0,
        vy: 0,
        dir: -Math.PI / 2,
        hold: null,
        target: null,
        path: [],
        chopT: 0,
        stepDustT: 0,
      },
      {
        id: pGuest.id || 'huyen',
        name: guestName,
        present: isClient,
        tagColor: guestName.includes('Hiếu') ? '#38bdf8' : '#f472b6',
        costume: guestName.includes('Hiếu') ? 'hieu' : 'huyen',
        x: 620,
        y: 525,
        vx: 0,
        vy: 0,
        dir: -Math.PI / 2,
        hold: null,
        target: null,
        path: [],
        chopT: 0,
        stepDustT: 0,
      },
    ];

    if (previous) {
      for (let i = 0; i < this.chefs.length; i++) {
        const c = this.chefs[i], old = previous[i];
        if (!old) continue;
        for (const key of ['x', 'y', 'vx', 'vy', 'dir', 'hold', 'target', 'path', 'chopT', 'stepDustT', 'present']) c[key] = old[key];
      }
    }

    this.myChefIndex = isClient ? 1 : 0;
  }

  // Tổng số bát/đĩa sạch hiện đang sẵn sàng sử dụng (trên 2 quầy ghép + trên kệ bát sạch)
  getTotalCleanPlates() {
    return this.plates.reduce((n, p) => n + (p.hasPlate && p.items.length === 0 && !p.dish ? 1 : 0), this.cleanPlateStack || 0);
  }

  // Tự động lấy bát sạch từ kệ đặt bù lên 2 quầy ghép nếu quầy đang trống
  refillCounterPlates() {
    for (const p of this.plates) {
      if (!p.hasPlate && p.items.length === 0 && !p.dish && this.cleanPlateStack > 0) {
        p.hasPlate = true;
        this.cleanPlateStack--;
      }
    }
  }

  // Lấy 1 bát sạch từ hệ thống 4 bát để đựng món ăn
  consumeOneCleanPlate(preferIdx = -1) {
    if (preferIdx >= 0 && this.plates[preferIdx]?.hasPlate && !this.plates[preferIdx].items.length && !this.plates[preferIdx].dish) {
      this.plates[preferIdx].hasPlate = false;
      this.refillCounterPlates();
      return true;
    }
    if (this.cleanPlateStack > 0) {
      this.cleanPlateStack--;
      return true;
    }
    for (const p of this.plates) {
      if (p.hasPlate && p.items.length === 0 && !p.dish) {
        p.hasPlate = false;
        return true;
      }
    }
    return false;
  }

  // Hoàn trả 1 bát sạch sau khi rửa xong tại bồn rửa (tối đa 4 bát toàn quán)
  restoreOneCleanPlate() {
    if (!this.plates[0].hasPlate && this.plates[0].items.length === 0 && !this.plates[0].dish) {
      this.plates[0].hasPlate = true;
    } else if (!this.plates[1].hasPlate && this.plates[1].items.length === 0 && !this.plates[1].dish) {
      this.plates[1].hasPlate = true;
    } else {
      this.cleanPlateStack = Math.min(MAX_PLATES, (this.cleanPlateStack || 0) + 1);
    }
    this.refillCounterPlates();
  }

  spawnInitialGuests() {
    // Phase 1 Easy Mode (0s - 60s): Khởi đầu nhẹ nhàng với món 1 nguyên liệu (Salad Cà Chua Thái) & Trà Sữa!
    const g0 = {
      id: 'g_init0',
      tableId: 0,
      style: CUSTOMER_STYLES[0],
      dish: 'tomato_salad',
      phase: 'ordered',
      x: TABLES[0].seatX,
      y: TABLES[0].seatY,
      path: [],
      patience: 78,
      maxPatience: 78,
      eatT: 0,
      animT: 0,
    };
    this.tables[0].guest = g0;

    const g1 = {
      id: 'g_init1',
      tableId: 3,
      style: CUSTOMER_STYLES[1],
      dish: 'tomato_salad',
      phase: 'ordered',
      x: TABLES[3].seatX,
      y: TABLES[3].seatY,
      path: [],
      patience: 76,
      maxPatience: 78,
      eatT: 0,
      animT: 1.5,
    };
    this.tables[3].guest = g1;

    const g2 = {
      id: 'g_init2',
      tableId: 1,
      style: CUSTOMER_STYLES[2],
      dish: 'soda',
      phase: 'ordered',
      x: TABLES[1].seatX,
      y: TABLES[1].seatY,
      path: [],
      patience: 78,
      maxPatience: 78,
      eatT: 0,
      animT: 3.0,
    };
    this.tables[1].guest = g2;

    this.guests.push(g0, g1, g2);
  }

  open({ announce = true } = {}) {
    if (this.active) return;
    this.active = true;
    this.setupChefs({ preserve: true });
    this.g.input?.resetTouch?.();
    document.getElementById('app')?.classList.add('rsc2d-open');
    this.syncHiDpi();
    this.wrap.classList.remove('hidden');
    if (this.g.ui?.panel) this.g.ui.close();
    this.g.session.send({ type: 'rest.shift', on: true, silent: true });
    this.g.audio.sfx('bell');

    if ((announce || !this.isHost) && this.g.session && this.g.session.role !== 'none') {
      if (this.isHost) {
        this.g.session.sendRsc({ kind: 'host_opened', hostName: this.chefs[0]?.name });
      } else {
        this.g.session.sendRsc({ kind: 'client_join', clientName: this.chefs[1]?.name });
      }
    }
  }

  close({ announce = true } = {}) {
    if (!this.active) return;
    this.active = false;
    this.touchJoy.active = false;
    this.touchJoy.dragging = false;
    this.g.input?.resetTouch?.();
    document.getElementById('app')?.classList.remove('rsc2d-open');
    this.wrap.classList.add('hidden');
    if (this.g.local) {
      this.g.local.x = 56.8;
      this.g.local.z = -11.2;
      this.g.local.vx = 0;
      this.g.local.vz = 0;
    }
    if (announce) {
      this.g.session.send({ type: 'rest.shift', on: false, silent: true });
      if (this.g.session && this.g.session.role !== 'none') {
        this.g.session.sendRsc({ kind: this.isHost ? 'host_closed' : 'chef_leave', chefIndex: this.myChefIndex });
      }
    }
    if (this.earned > 0) {
      this.g.ui.toast(`🎉 Cả hai đã mang +${fmt(this.earned)} 🪙 (${'⭐'.repeat(Math.max(1, this.starsReached))}) từ Quán Ăn Ready, Set, Cook! về Làng!`, 'good');
    }
  }

  finishShift() {
    if (!this.isHost || this.matchOver) return;
    this.matchOver = true;
    this.timer = 0;
    if (this.served > 0) this.rewardCoins(200, 640, 195, '🏆 Hoàn thành ca bếp +200 xu');
    const sim = this.g?.session?.sim || this.g?.sim;
    if (sim?.st.restaurant) {
      const r = sim.st.restaurant;
      r.arcade ||= { bestScore: 0, bestStars: 0, shifts: 0, served: 0 };
      r.arcade.bestScore = Math.max(r.arcade.bestScore, this.earned);
      r.arcade.bestStars = Math.max(r.arcade.bestStars, this.starsReached);
      r.arcade.shifts++;
      r.arcade.served += this.served;
      sim.touch('restaurant');
    }
    this.g.audio.sfx('levelup');
    if (this.isHost) this.broadcastState();
  }

  restartShift() {
    if (!this.isHost) return;
    const present = this.chefs?.map((c) => c.present);
    this.resetState();
    if (present) this.chefs.forEach((c, i) => { c.present = present[i]; });
    this.broadcastState();
  }

  addFloat(x, y, text, color = '#ffe066') {
    if (this.floats.length >= 8) this.floats.shift();
    this.floats.push({ x, y, text, color, life: 1.6, maxLife: 1.6 });
    if (this.isHost && this.g?.session?.role === 'host') {
      this.g.session.sendRsc({ kind: 'float', x, y, text, color });
    }
  }

  getSyncState() {
    return {
      shiftId: this.shiftId,
      previousBest: this.previousBest,
      timer: this.timer,
      earned: this.earned,
      served: this.served,
      combo: this.combo,
      feverT: this.feverT,
      starsReached: this.starsReached,
      matchOver: this.matchOver,
      helperOn: this.helperOn,
      director: {
        elapsed: this.difficultyDirector?.elapsed || 0,
        shiftsCompleted: this.difficultyDirector?.shiftsCompleted || 0,
        phase: this.difficultyDirector?.phase || 1,
        orderSpawnInterval: this.difficultyDirector?.orderSpawnInterval || 25,
        patienceDecayMultiplier: this.difficultyDirector?.patienceDecayMultiplier || 1,
        unlockedRecipes: this.difficultyDirector?.unlockedRecipes || ['tomato_salad', 'soda'],
        cheeseSpawnerUnlocked: !!this.difficultyDirector?.cheeseSpawnerUnlocked,
        bakingOvenUnlocked: !!this.difficultyDirector?.bakingOvenUnlocked,
        announcementBanner: this.difficultyDirector?.announcementBanner || null,
      },
      cleanPlateStack: this.cleanPlateStack,
      boards: this.boards,
      plates: this.plates,
      ovens: this.ovens,
      drinkMachine: this.drinkMachine,
      sink: this.sink,
      tables: this.tables.map((t) => ({
        id: t.id,
        dirty: t.dirty,
        dirtyCount: t.dirtyCount,
        eatingDish: t.eatingDish,
        tip: t.tip,
        guest: t.guest
          ? {
              id: t.guest.id,
              kind: t.guest.kind,
              styleIdx: t.guest.styleIdx,
              style: t.guest.style,
              tableId: t.guest.tableId,
              eatT: t.guest.eatT,
              animT: t.guest.animT,
              dish: t.guest.dish,
              phase: t.guest.phase,
              patience: t.guest.patience,
              maxPatience: t.guest.maxPatience,
              x: t.guest.x,
              y: t.guest.y,
            }
          : null,
      })),
      guests: this.guests.map((g) => ({
          id: g.id,
          kind: g.kind,
          styleIdx: g.styleIdx,
          style: g.style,
          eatT: g.eatT,
          animT: g.animT,
          dish: g.dish,
          phase: g.phase,
          patience: g.patience,
          maxPatience: g.maxPatience,
          x: g.x,
          y: g.y,
          tableId: g.tableId,
          path: g.path || [],
          targetTable: g.targetTable,
        })),
      chef0: {
        present: this.chefs[0]?.present !== false,
        x: Math.round(this.chefs[0]?.x || 520),
        y: Math.round(this.chefs[0]?.y || 525),
        vx: Math.round(this.chefs[0]?.vx || 0),
        vy: Math.round(this.chefs[0]?.vy || 0),
        dir: Math.round((this.chefs[0]?.dir || 0) * 100) / 100,
        hold: this.chefs[0]?.hold || null,
        chopT: this.chefs[0]?.chopT || 0,
      },
      chef1: {
        present: !!this.chefs[1]?.present,
        x: Math.round(this.chefs[1]?.x || 620),
        y: Math.round(this.chefs[1]?.y || 525),
        vx: Math.round(this.chefs[1]?.vx || 0),
        vy: Math.round(this.chefs[1]?.vy || 0),
        dir: Math.round((this.chefs[1]?.dir || 0) * 100) / 100,
        hold: this.chefs[1]?.hold || null,
        chopT: this.chefs[1]?.chopT || 0,
      },
    };
  }

  applySyncState(st) {
    if (!st) return;
    const newShift = !this.hasHostState || st.shiftId !== this.shiftId;
    this.shiftId = st.shiftId;
    this.hasHostState = true;
    this.previousBest = st.previousBest || 0;
    if (newShift && this.myChef) {
      this.myChef.target = null;
      this.myChef.path = [];
      this.floats.length = 0;
      this.particles.length = 0;
      this.lastClientAction = null;
    }
    this.timer = st.timer;
    this.earned = st.earned;
    this.served = st.served;
    this.combo = st.combo;
    this.feverT = st.feverT;
    this.starsReached = st.starsReached;
    this.matchOver = !!st.matchOver;
    if (st.helperOn !== undefined) this.helperOn = !!st.helperOn;
    if (st.director && this.difficultyDirector) {
      Object.assign(this.difficultyDirector, st.director);
    }
    this.cleanPlateStack = st.cleanPlateStack;
    if (st.boards) this.boards = st.boards;
    if (st.plates) this.plates = st.plates;
    if (st.ovens) this.ovens = st.ovens;
    if (st.drinkMachine) this.drinkMachine = st.drinkMachine;
    if (st.sink) this.sink = st.sink;

    if (st.tables) {
      for (let i = 0; i < st.tables.length; i++) {
        const src = st.tables[i], dst = this.tables[i];
        if (!src || !dst) continue;
        dst.dirty = src.dirty;
        dst.dirtyCount = src.dirtyCount;
        dst.eatingDish = src.eatingDish;
        dst.tip = src.tip;
        if (src.guest) {
          if (!dst.guest || dst.guest.id !== src.guest.id) {
            dst.guest = { ...src.guest };
          } else {
            Object.assign(dst.guest, src.guest);
          }
        } else {
          dst.guest = null;
        }
      }
    }

    if (st.guests) {
      this.guests = st.guests.map((sg) => {
        const existing = this.guests.find((g) => g.id === sg.id);
        return existing ? Object.assign(existing, sg) : { ...sg };
      });
      for (const table of this.tables) {
        table.guest = table.guest ? this.guests.find((g) => g.id === table.guest.id) || null : null;
      }
    }

    if (st.chef0 && this.chefs[0]) {
      this.chefs[0].x = st.chef0.x;
      this.chefs[0].y = st.chef0.y;
      this.chefs[0].vx = st.chef0.vx;
      this.chefs[0].vy = st.chef0.vy;
      this.chefs[0].dir = st.chef0.dir;
      this.chefs[0].hold = st.chef0.hold;
      this.chefs[0].chopT = st.chef0.chopT;
      this.chefs[0].present = st.chef0.present !== false;
    }

    if (st.chef1 && this.chefs[1]) {
      // The client predicts its own position. Old snapshots must not pull it back.
      const { x, y, vx, vy, dir, ...gameplay } = st.chef1;
      Object.assign(this.chefs[1], gameplay);
      if (newShift) Object.assign(this.chefs[1], { x, y, vx, vy, dir });
    } else if (st.chef1Hold !== undefined && this.chefs[1]) {
      this.chefs[1].hold = st.chef1Hold;
    }
  }

  broadcastState() {
    if (!this.g?.session || this.g.session.role !== 'host') return;
    this.g.session.sendRsc({ kind: 'sync', state: this.getSyncState() });
  }

  handleNetworkMsg(sender, msg) {
    if (!msg) return;
    if (msg.kind === 'host_opened') {
      if (!this.active && this.g.session?.role === 'client') this.open({ announce: false });
      if (!this.active) {
        this.g.ui?.toast(`👨‍🍳 ${msg.hostName || 'Hiếu'} đang mở Quán Ăn! Hãy bấm [Vào Quán] để nấu cùng nhé! 🍕`, 'good');
      }
    } else if (msg.kind === 'client_join') {
      if (this.isHost) {
        if (!this.active) this.open({ announce: false });
        this.setupChefs({ preserve: true });
        this.chefs[1].present = true;
        this.addFloat(640, 220, `💖 ${msg.clientName || 'Huyền'} đã vào Bếp! Cùng nấu ăn nào!`, '#ff80ab');
        this.broadcastState();
      }
    } else if (msg.kind === 'client_move') {
      if (this.isHost && this.chefs[1]?.present && sender === this.chefs[1].id && [msg.x, msg.y, msg.vx, msg.vy, msg.dir].every(Number.isFinite)) {
        Object.assign(this.chefs[1], { x: msg.x, y: msg.y, vx: msg.vx, vy: msg.vy, dir: msg.dir });
        this.resolveCollisions(this.chefs[1]);
      }
    } else if (msg.kind === 'client_act') {
      if (this.isHost && !this.matchOver && this.chefs[1]?.present && sender === this.chefs[1].id) {
        const st = STATIONS[msg.stationId];
        const tb = this.tables.find((t) => t.id === msg.tableId);
        this.interactAt(this.chefs[1], st, tb);
      }
    } else if (msg.kind === 'helper_toggle') {
      if (this.isHost) this.helperOn = !!msg.on;
    } else if (msg.kind === 'result_action') {
      if (this.isHost && msg.action === 'restart' && this.matchOver) this.restartShift();
    } else if (msg.kind === 'client_tap') {
      if (this.isHost && !this.matchOver && this.chefs[1]?.present && sender === this.chefs[1].id && Number.isFinite(msg.tx) && Number.isFinite(msg.ty)) {
        const st = STATIONS[msg.stationId];
        const tb = this.tables.find((t) => t.id === msg.tableId);
        this.setChefDestination(this.chefs[1], msg.tx, msg.ty, st, tb);
      }
    } else if (msg.kind === 'sync') {
      if (!this.isHost) {
        this.applySyncState(msg.state);
      }
    } else if (msg.kind === 'float') {
      if (!this.isHost) this.addFloat(msg.x, msg.y, msg.text, msg.color);
    } else if (msg.kind === 'host_closed' && !this.isHost) {
      this.close({ announce: false });
    } else if (msg.kind === 'chef_leave') {
      const idx = msg.chefIndex;
      const chef = this.chefs?.[idx];
      if (this.isHost && idx === 1 && chef) {
        const held = chef.hold?.kind === 'extinguisher' ? chef.hold.prevHold : chef.hold;
        if (held?.hasPlate) this.sink.dirtyCount++;
        if (held?.kind === 'dirty') this.sink.dirtyCount += held.count || 1;
        chef.hold = null;
        chef.present = false;
        chef.vx = chef.vy = 0;
        chef.path = [];
        chef.target = null;
      }
      this.addFloat(640, 220, `👋 ${chef?.name || 'Đầu bếp'} đã tạm ra ngoài`, '#ffd54f');
    }
  }

  spawnParticles(x, y, kind, count = 6) {
    count = Math.min(count, Math.max(0, (VP.phone ? 70 : 130) - this.particles.length));
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 28 + Math.random() * 65;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - (kind === 'steam' || kind === 'ember' || kind === 'smoke' ? 38 : 15),
        r: kind === 'steam' || kind === 'smoke' ? 6 + Math.random() * 6 : 3.5 + Math.random() * 3.5,
        kind,
        life: 0.55 + Math.random() * 0.45,
        maxLife: 0.85,
      });
    }
  }

  spawnCustomer() {
    const freeTables = this.tables.filter((t) => !t.guest && !t.dirty);
    if (!freeTables.length) return;
    const tb = freeTables[(Math.random() * freeTables.length) | 0];
    const style = CUSTOMER_STYLES[(Math.random() * CUSTOMER_STYLES.length) | 0];
    // DifficultyDirector chọn món ăn theo Phase hiện tại (Phase 1-2: Món 1 nguyên liệu; Phase 3: Xen kẽ Pizza đa nguyên liệu!)
    const dish = this.difficultyDirector ? this.difficultyDirector.pickNextOrderDish() : 'tomato_salad';
    const walkTargetX = tb.walkX ?? tb.standX;
    const walkTargetY = tb.walkY ?? tb.standY;
    const path = this.findPath(DOOR_POS.x, DOOR_POS.y, walkTargetX, walkTargetY);
    path.push({ x: tb.seatX, y: tb.seatY });
    const g = {
      id: 'g_' + Math.random().toString(36).slice(2, 7),
      tableId: tb.id,
      style,
      dish,
      phase: 'walk_in',
      x: DOOR_POS.x,
      y: DOOR_POS.y,
      path,
      patience: dish === 'pizza' ? 100 : dish === 'caprese' ? 90 : 78,
      maxPatience: dish === 'pizza' ? 100 : dish === 'caprese' ? 90 : 78,
      eatT: 0,
      animT: Math.random() * 10,
    };
    tb.guest = g;
    this.guests.push(g);
  }

  setChefDestination(c, tx, ty, station = null, table = null) {
    let destX = tx, destY = ty;
    if (station?.id === 'plateBot' && station.altStandX) {
      const d1 = Math.hypot(c.x - station.standX, c.y - station.standY);
      const d2 = Math.hypot(c.x - station.altStandX, c.y - station.altStandY);
      if (d2 < d1) {
        destX = station.altStandX;
        destY = station.altStandY;
      }
    }
    c.path = this.findPath(c.x, c.y, destX, destY);
    c.target = { x: destX, y: destY, station, table };
    this.tapRipples.push({ x: station ? station.x : table ? table.x : destX, y: station ? station.y : table ? table.y : destY, r: 8, alpha: 1 });
    if (!this.isHost && c === this.myChef && this.g?.session?.role === 'client') {
      this.g.session.sendRsc({
        kind: 'client_tap',
        tx,
        ty,
        stationId: station?.id,
        tableId: table?.id,
      });
    }
  }

  onCanvasTap(sx, sy) {
    const me = this.myChef;

    if (this.matchOver) {
      if (sy >= 438 && sy <= 548 && sx >= 420 && sx <= 640) {
        this.g.audio.sfx('click');
        if (!this.isHost && this.g.session?.role === 'client') {
          this.g.session.sendRsc({ kind: 'result_action', action: 'restart' });
        } else {
          this.restartShift();
        }
      } else if (sy >= 438 && sy <= 548 && sx > 640 && sx <= 860) {
        this.g.audio.sfx('click');
        this.close();
      }
      return;
    }

    // 1. Nút ✕ góc trên phải hoặc nút Pause || -> Thoát ra Làng!
    if ((sx > 1145 && sy < 95) || (sx > 1050 && sx < 1140 && sy > 32 && sy < 110)) {
      this.g.audio.sfx('click');
      this.close();
      return;
    }
    // 2. Nút ☰ góc trên trái -> Bật/tắt hiển thị nhãn tên trạm bếp
    if (sx > 80 && sx < 160 && sy > 32 && sy < 110) {
      this.g.audio.sfx('click');
      this.showTip = !this.showTip;
      this.addFloat(340, 95, this.showTip ? '💡 Đã bật nhãn tên trên các trạm bếp!' : '💡 Đã ẩn nhãn tên trạm bếp', '#82cfff');
      return;
    }
    // 3. Nút ? góc trên trái hoặc nút [🐱 Mimi] -> Bật/tắt Mèo Phụ Bếp Mimi
    if ((sx > 162 && sx < 245 && sy > 32 && sy < 110) || (sx >= 900 && sx <= 1042 && sy >= 38 && sy <= 96)) {
      this.g.audio.sfx('click');
      const next = !this.helperOn;
      if (!this.isHost && this.g.session?.role === 'client') {
        this.g.session.sendRsc({ kind: 'helper_toggle', on: next });
      } else {
        this.helperOn = next;
      }
      this.addFloat(640, 125, next ? '🐱 Mimi sẽ tự nhận đơn mới' : '🐱 Mimi đã tạm nghỉ', '#ffe066');
      return;
    }
    // 3b. Chạm vào Phiếu Order (Order Tickets) ở thanh trên cùng -> Tự động làm ngay món trên phiếu đó!
    if (sy >= 12 && sy <= 96 && sx >= 435 && sx <= 772) {
      const orderedGuests = this.getOrderQueue();
      const idx = Math.floor((sx - 440) / 110);
      const targetGuest = orderedGuests[idx] || orderedGuests[0];
      if (targetGuest) {
        this.g.audio.sfx('click');
        this.autoSmartStep(me, targetGuest.dish, this.tables[targetGuest.tableId]);
        return;
      }
    }
    // 4. Nút [⚡ THAO TÁC] ở góc dưới phải (hoặc chạm vào thanh công thức dưới đáy)
    if (Math.hypot(sx - ACT_BTN.x, sy - ACT_BTN.y) < 68 || (sx > 920 && sy > 680)) {
      this.g.audio.sfx('click');
      const near = this.nearestInteract(me);
      if (near && this.canAutoTriggerNear(me, near)) {
        this.interactAt(me, near.station, near.table);
      } else {
        this.autoSmartStep(me);
      }
      return;
    }

    // 5. Chạm vào Bàn Khách (nhận order '!' hoặc phục vụ món hoặc thu bát bẩn)
    for (const tb of this.tables) {
      if (
        Math.hypot(sx - tb.x, sy - tb.y) < 78 ||
        Math.hypot(sx - tb.seatX, sy - tb.seatY) < 72 ||
        Math.hypot(sx - tb.bubbleX, sy - tb.bubbleY) < 68
      ) {
        this.setChefDestination(me, tb.standX, tb.standY, null, tb);
        this.g.audio.sfx('click');
        return;
      }
    }

    // 6. Chạm vào các Trạm Bếp (bao gồm Bình Chữa Cháy 🧯, Lò Nướng, Thớt, Bồn Rửa, Thùng Rác...)
    let bestSt = null, bestD = 96;
    for (const st of Object.values(STATIONS)) {
      const d = Math.hypot(sx - st.x, sy - st.y);
      if (d < bestD) {
        bestD = d;
        bestSt = st;
      }
    }
    if (bestSt) {
      this.setChefDestination(me, bestSt.standX, bestSt.standY, bestSt, null);
      this.g.audio.sfx('click');
      return;
    }

    // 7. Chạm lên sàn -> Tìm đường A* đi vòng qua bàn ghế tới vị trí đó
    if (sy < 685) {
      this.setChefDestination(me, clamp(sx, 112, 1155), clamp(sy, 148, 668), null, null);
    }
  }

  // Nút ⚡ THAO TÁC hoặc chạm Phiếu Order: tự động dẫn nhân vật YOU tới bước hợp lý tiếp theo!
  autoSmartStep(c, preferDish = null, preferTable = null) {
    if (preferTable?.guest?.phase === 'ordered') c.orderTableId = preferTable.id;
    const assigned = this.tables.find((t) => t.id === c.orderTableId && t.guest?.phase === 'ordered');
    if (!preferTable && assigned) {
      preferTable = assigned;
      preferDish = assigned.guest.dish;
    }
    // 0. Nếu đang cầm Đồ Cháy Đen ('burnt_food') -> Bắt buộc đem vứt vào Thùng Rác trước!
    if (c.hold?.kind === 'burnt_food') {
      this.setChefDestination(c, STATIONS.trash.standX, STATIONS.trash.standY, STATIONS.trash, null);
      return;
    }
    // 1. Ưu tiên Khủng Hoảng Cháy Bếp (FIRE!): Lấy Bình Chữa Cháy -> Tới Lò đang cháy giữ 3.0s!
    const burnOv = this.ovens.findIndex((o) => o.state === 'burning');
    if (burnOv >= 0) {
      if (c.hold?.kind !== 'extinguisher') {
        this.setChefDestination(c, STATIONS.extinguisher.standX, STATIONS.extinguisher.standY, STATIONS.extinguisher, null);
      } else {
        const st = STATIONS['oven' + burnOv];
        this.setChefDestination(c, st.standX, st.standY, st, null);
      }
      return;
    }
    // 1b. Nếu đang cầm Bình Chữa Cháy mà không còn lò nào cháy -> Cất lại Bình Chữa Cháy!
    if (c.hold?.kind === 'extinguisher') {
      this.setChefDestination(c, STATIONS.extinguisher.standX, STATIONS.extinguisher.standY, STATIONS.extinguisher, null);
      return;
    }
    // 1c. Nếu lò có đồ cháy ('burnt') -> Tới lấy ra để đem vứt Thùng Rác!
    const burntOv = this.ovens.findIndex((o) => o.state === 'burnt');
    if (burntOv >= 0 && !c.hold) {
      const st = STATIONS['oven' + burntOv];
      this.setChefDestination(c, st.standX, st.standY, st, null);
      return;
    }
    // 2. Đang cầm bát bẩn -> Đưa vô Bồn Rửa Bát (2.0s)!
    if (c.hold?.kind === 'dirty') {
      this.setChefDestination(c, STATIONS.sink.standX, STATIONS.sink.standY, STATIONS.sink, null);
      return;
    }
    // 3. Nếu hết sạch bát sạch (0/4) -> Ưu tiên đi rửa bát trong bồn hoặc thu bát bẩn trên bàn!
    if (this.getTotalCleanPlates() === 0 && !c.hold?.hasPlate) {
      if (this.sink.dirtyCount > 0) {
        this.setChefDestination(c, STATIONS.sink.standX, STATIONS.sink.standY, STATIONS.sink, null);
        return;
      }
      const dirtyTb = this.tables.find((t) => t.dirty);
      if (dirtyTb) {
        this.setChefDestination(c, dirtyTb.standX, dirtyTb.standY, null, dirtyTb);
        return;
      }
    }
    // 4. Khách đang vẫy gọi order ('!')
    if (preferTable?.guest?.phase === 'wait_order' && !c.hold) {
      this.setChefDestination(c, preferTable.standX, preferTable.standY, null, preferTable);
      return;
    }
    const waitOrderTb = this.tables.find((t) => t.guest?.phase === 'wait_order');
    if (waitOrderTb && !c.hold) {
      this.setChefDestination(c, waitOrderTb.standX, waitOrderTb.standY, null, waitOrderTb);
      return;
    }
    // 5. Đang bưng món ăn hoàn chỉnh -> Kiểm tra nếu khách cần món đó thì đem ra bàn khách!
    if (c.hold?.kind === 'dish') {
      const matchingTb =
        (preferTable?.guest?.phase === 'ordered' && preferTable.guest.dish === c.hold.dish ? preferTable : null) ||
        this.tables.find((t) => t.guest?.phase === 'ordered' && t.guest.dish === c.hold.dish);
      if (matchingTb) {
        this.setChefDestination(c, matchingTb.standX, matchingTb.standY, null, matchingTb);
        return;
      }
      // Nếu đang cầm tomato_salad mà khách gọi caprese hoặc pizza (ở Phase 3), tiếp tục lấy thêm Phô mai!
      if (c.hold.dish === 'soda' || c.hold.dish === 'pizza') {
        this.addFloat(c.x, c.y - 42, 'Chưa có khách gọi món này. Chờ đơn mới nhé!', '#ffe082');
        return;
      }
    }
    // 6. Đang cầm Pizza sống -> Đem đút Lò Gạch nướng 5.0s!
    if (c.hold?.kind === 'raw_pizza') {
      const ovIdx = this.ovens.findIndex((o) => o.state === 'idle');
      if (ovIdx < 0) {
        this.addFloat(c.x, c.y - 42, 'Hai lò đang bận, chờ bánh chín nhé!', '#ffe082');
        return;
      }
      const st = STATIONS['oven' + ovIdx];
      this.setChefDestination(c, st.standX, st.standY, st, null);
      return;
    }
    // 7. Đang cầm nguyên liệu thô -> Đem tới Thớt để thái 3.0s!
    if (c.hold?.kind === 'raw') {
      const bd = !this.boards[0].ing ? STATIONS.board0 : STATIONS.board1;
      this.setChefDestination(c, bd.standX, bd.standY, bd, null);
      return;
    }
    // 8. Có bánh Pizza đã nướng chín trong lò -> Tới lấy ra trong 5.0s trước khi cháy!
    const readyOv = this.ovens.findIndex((o) => o.state === 'ready');
    if (readyOv >= 0 && !c.hold) {
      const st = STATIONS['oven' + readyOv];
      this.setChefDestination(c, st.standX, st.standY, st, null);
      return;
    }
    // 9. Có nguyên liệu đang thái dở trên thớt -> Đứng thái cho đủ 3.0s!
    const unchoppedIdx = this.boards.findIndex((b) => b.ing && !b.ready);
    if (unchoppedIdx >= 0 && (!c.hold || c.hold.kind === 'item' || c.hold.dish === 'tomato_salad')) {
      const st = STATIONS['board' + unchoppedIdx];
      this.setChefDestination(c, st.standX, st.standY, st, null);
      return;
    }
    // 10. Khách gọi Trà Sữa Trân Châu -> Tới Máy Trà Sữa để rót (2.5s) hoặc lấy ly đã rót xong!
    const wantSoda = preferDish === 'soda' || (!preferDish && !c.hold && this.tables.some((t) => t.guest?.phase === 'ordered' && t.guest.dish === 'soda'));
    if (wantSoda && !c.hold) {
      this.setChefDestination(c, STATIONS.drink.standX, STATIONS.drink.standY, STATIONS.drink, null);
      return;
    }
    // 11. Có bát bẩn trong bồn rửa hoặc trên bàn -> Đi dọn và rửa (2.0s)!
    if (this.sink.dirtyCount > 0 && (!c.hold || c.hold.kind === 'item')) {
      this.setChefDestination(c, STATIONS.sink.standX, STATIONS.sink.standY, STATIONS.sink, null);
      return;
    }
    const dirtyTb = this.tables.find((t) => t.dirty);
    if (dirtyTb && !c.hold) {
      this.setChefDestination(c, dirtyTb.standX, dirtyTb.standY, null, dirtyTb);
      return;
    }
    // 12. Đi lấy nguyên liệu theo món khách đang gọi (Phase 1: Cà chua thái 3s; Phase 3: + Phô mai thái 3s + Đế bánh)
    const heldItems = c.hold?.items || [];
    const targetDish =
      preferDish ||
      this.tables.find((t) => t.guest?.phase === 'ordered')?.guest?.dish ||
      'tomato_salad';
    if (!heldItems.includes('tomato_cut')) {
      const st = this.boards[0].ing === 'tomato' ? STATIONS.board0 : STATIONS.tomato;
      this.setChefDestination(c, st.standX, st.standY, st, null);
    } else if ((targetDish === 'caprese' || targetDish === 'pizza') && !heldItems.includes('mozz_cut')) {
      if (!this.difficultyDirector?.cheeseSpawnerUnlocked) return;
      const st = this.boards[1].ing === 'mozzarella' ? STATIONS.board1 : STATIONS.mozzarella;
      this.setChefDestination(c, st.standX, st.standY, st, null);
    } else if (targetDish === 'pizza' && !heldItems.includes('dough')) {
      if (!this.difficultyDirector?.bakingOvenUnlocked) return;
      this.setChefDestination(c, STATIONS.dough.standX, STATIONS.dough.standY, STATIONS.dough, null);
    } else if (c.hold?.kind === 'item') {
      const idx = this.plates.findIndex((p) => p.hasPlate && !p.items.length && !p.dish);
      if (idx >= 0) {
        const st = idx === 0 ? STATIONS.plateTop : STATIONS.plateBot;
        this.setChefDestination(c, st.standX, st.standY, st, null);
      }
    }
  }

  stepChefToward(c, tx, ty, dt, speed = 315) {
    const spd = this.feverT > 0 ? speed * 1.22 : speed;
    const dx = tx - c.x, dy = ty - c.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      const step = Math.min(d, spd * dt);
      c.vx = (dx / d) * spd;
      c.vy = (dy / d) * spd;
      c.x += (dx / d) * step;
      c.y += (dy / d) * step;
      c.dir = Math.atan2(dy, dx);
    } else {
      c.vx = 0;
      c.vy = 0;
    }
    this.resolveCollisions(c, CHEF_R);
  }

  followChefPath(c, dt, speed = 330) {
    if (!c.path || !c.path.length) {
      if (c.target) {
        this.stepChefToward(c, c.target.x, c.target.y, dt, speed);
      }
      return;
    }
    const wp = c.path[0];
    this.stepChefToward(c, wp.x, wp.y, dt, speed);
    if (Math.hypot(c.x - wp.x, c.y - wp.y) < 14) {
      c.path.shift();
    }
  }

  checkPlateRecipe(p) {
    const hasT = p.items.includes('tomato_cut');
    const hasM = p.items.includes('mozz_cut');
    const hasD = p.items.includes('dough');
    if (hasD && hasT && hasM) {
      p.dish = 'raw_pizza';
    } else if (!hasD && hasT && hasM) {
      p.dish = 'caprese';
    } else if (!hasD && hasT && !hasM) {
      p.dish = 'tomato_salad';
    } else {
      p.dish = null;
    }
  }

  tryAddHeldItem(c, newItemId) {
    if (!['tomato_cut', 'mozz_cut', 'dough'].includes(newItemId)) return false;
    if (c.hold && !['item', 'dish'].includes(c.hold.kind)) return false;
    if (c.hold?.kind === 'dish' && !['tomato_salad', 'caprese'].includes(c.hold.dish)) return false;
    const alreadyHasPlate = !!c.hold?.hasPlate;
    const baseItems = c.hold
      ? c.hold.items
        ? [...c.hold.items]
        : c.hold.prevItems
          ? [...c.hold.prevItems]
          : c.hold.id
            ? [c.hold.id]
            : []
      : [];

    if (!baseItems.includes(newItemId)) {
      baseItems.push(newItemId);
      const hasT = baseItems.includes('tomato_cut');
      const hasM = baseItems.includes('mozz_cut');
      const hasD = baseItems.includes('dough');
      if (hasD && hasT && hasM) {
        c.hold = { kind: 'raw_pizza', items: baseItems, hasPlate: alreadyHasPlate };
        this.addFloat(
          c.x,
          c.y - 35,
          `🍕 Đã ghép xong Pizza sống (Bột + Phô Mai + Cà Chua) -> Đem đút Lò Nướng (${BAKE_SECONDS}s)!`,
          '#ffe082'
        );
      } else if (!hasD && hasT && hasM) {
        let gotPlate = alreadyHasPlate;
        if (!gotPlate) gotPlate = this.consumeOneCleanPlate();
        if (!gotPlate) {
          this.addFloat(c.x, c.y - 35, '🍽️ Hết sạch 4 bát! Hãy thu bát bẩn đưa vô Bồn Rửa trước khi bày Salad!', '#ff5252');
          return false;
        }
        c.hold = { kind: 'dish', dish: 'caprese', items: baseItems, hasPlate: true };
        this.addFloat(
          c.x,
          c.y - 35,
          `🥗 Đã bày Salad Caprese lên bát (${this.getTotalCleanPlates()}/${MAX_PLATES} bát sạch còn lại)!`,
          '#a8ff8e'
        );
      } else if (!hasD && hasT && !hasM) {
        // Món 1 nguyên liệu (Phase 1 Easy Mode): Cà Chua Thái đặt lên Bát Sạch -> Salad Cà Chua Tươi!
        let gotPlate = alreadyHasPlate;
        if (!gotPlate) gotPlate = this.consumeOneCleanPlate();
        if (gotPlate) {
          c.hold = { kind: 'dish', dish: 'tomato_salad', id: 'tomato_cut', items: baseItems, hasPlate: true };
          this.addFloat(
            c.x,
            c.y - 35,
            `🍅 Đã bày Cà Chua Thái lên Bát Sạch (${this.getTotalCleanPlates()}/${MAX_PLATES} bát còn lại) -> Phục vụ hoặc ghép thêm!`,
            '#a8ff8e'
          );
        } else {
          c.hold = { kind: 'item', id: newItemId, items: baseItems, hasPlate: false };
          this.addFloat(
            c.x,
            c.y - 35,
            '🍅 Đã thái Cà Chua! Hãy đặt lên Bát Sạch hoặc rửa bát ở Bồn Rửa để phục vụ!',
            '#ffe082'
          );
        }
      } else {
        c.hold = { kind: 'item', id: newItemId, items: baseItems, hasPlate: alreadyHasPlate };
      }
      return true;
    }
    return false;
  }

  // Context-Aware Interaction — uỷ quyền cho PlayerController (cùng StationLogic & CrisisManager)
  interactAt(c, st, tb) {
    if (this.matchOver || !c) return false;
    if (!this.isHost && c === this.myChef && this.g?.session?.role === 'client') {
      const key = st?.id || (tb ? `table_${tb.id}` : 'none');
      if (this.lastClientAction?.key === key && this.t - this.lastClientAction.at < 0.18) return false;
      this.lastClientAction = { key, at: this.t };
      this.g.session.sendRsc({
        kind: 'client_act',
        stationId: st?.id,
        tableId: tb?.id,
      });
      return false;
    }
    if (!this.isHost) return false;
    if (st && !this.isChefNearStation(c, st)) return false;
    if (tb && Math.hypot(c.x - tb.standX, c.y - tb.standY) > 86) return false;
    return this.playerController.interact(c, st, tb);
  }

  getOrderQueue() {
    return this.guests.filter((g) => g.phase === 'ordered' && g.dish)
      .sort((a, b) => a.patience / a.maxPatience - b.patience / b.maxPatience).slice(0, 3);
  }

  rewardCoins(amount, x, y, label) {
    if (!this.isHost || amount <= 0) return;
    const sim = this.g?.session?.sim || this.g?.sim;
    if (sim?.st.daily?.fortune === 1) { amount = Math.round(amount * 1.2); label += ' • Quẻ Thực Thần +20%'; }
    this.earned += amount;
    if (sim?.st.restaurant?.shift) {
      sim.st.restaurant.shift.earned = (sim.st.restaurant.shift.earned || 0) + amount;
      sim.touch('restaurant');
    }
    this.addFloat(x, y, label, '#ffe066');
    while (this.starsReached < STAR_GOALS.length && this.earned >= STAR_GOALS[this.starsReached]) {
      this.starsReached++;
      const bonus = this.starsReached * 80;
      this.earned += bonus;
      if (sim) {
        for (const p of sim.connected()) {
          sim.sys('economy').earn(p.id, bonus, { bonus: true });
          sim.touch('players.' + p.id);
        }
      }
      if (sim?.st?.daily) {
        sim.st.daily.spinTickets = (sim.st.daily.spinTickets || 0) + 1;
        sim.touch('daily');
      }
      this.addFloat(640, 150, `⭐ ĐẠT ${this.starsReached} SAO! +${bonus}🪙 & +1 🎡 Vé Quay May Mắn!`, '#ffd54f');
      this.g.audio.sfx('levelup');
    }
    if (sim) {
      for (const p of sim.connected()) {
        sim.sys('economy').earn(p.id, amount, { bonus: true });
        sim.sys('prog').addXp(p.id, 10);
        sim.touch('players.' + p.id);
      }
      if (sim.st.daily) sim.sys('quest')?.addActivity(8);
    }
  }

  nearestInteract(c) {
    for (const tb of this.tables) {
      if (Math.hypot(c.x - tb.standX, c.y - tb.standY) < 68 || Math.hypot(c.x - tb.x, c.y - tb.y) < 86) {
        if (tb.guest?.phase === 'wait_order' || (tb.dirty && (!c.hold || c.hold.kind === 'dirty')) || (tb.guest && c.hold?.kind === 'dish')) {
          return { table: tb, key: 'tb_' + tb.id };
        }
      }
    }
    let bestSt = null, bestD = 72;
    for (const st of Object.values(STATIONS)) {
      const d = Math.min(
        Math.hypot(c.x - st.x, c.y - st.y),
        Math.hypot(c.x - st.standX, c.y - st.standY),
        st.altStandX ? Math.hypot(c.x - st.altStandX, c.y - st.altStandY) : 999
      );
      if (d < bestD) { bestD = d; bestSt = st; }
    }
    return bestSt ? { station: bestSt, key: 'st_' + bestSt.id } : null;
  }

  recordService(chef, dish) {
    const sim = this.g?.session?.sim || this.g?.sim;
    const p = sim?.st.players?.[chef.id];
    if (!this.isHost || !p) return;
    p.stats ||= {};
    p.stats.cook = (p.stats.cook || 0) + 1;
    p.stats.serve = (p.stats.serve || 0) + 1;
    const r = sim.st.restaurant;
    if (r?.shift) {
      r.shift.served = (r.shift.served || 0) + 1;
      r.rep = (r.rep || 0) + 1;
      sim.sys('rest')?.updateStars();
      sim.touch('restaurant');
    }
    if (p.stats.serve >= 3 && p.hats && !p.hats.includes('chef')) {
      p.hats.push('chef');
      sim.toast(chef.id, '👨‍🍳 Phục vụ 3 món! Bạn nhận được Mũ Đầu Bếp.', 'good');
    }
    sim.touch('players.' + chef.id);
    sim.game({ type: 'cook', pid: chef.id, recipe: dish });
    sim.game({ type: 'serve', pid: chef.id, recipe: dish });
  }

  canAutoTriggerNear(c, near) {
    if (!near) return false;
    if (near.table) {
      const tb = near.table;
      return !!(tb.guest?.phase === 'wait_order' || (tb.dirty && (!c.hold || c.hold.kind === 'dirty')) || (tb.guest && c.hold?.kind === 'dish'));
    }
    const st = near.station;
    if (!st) return false;
    if (st.kind === 'trash' && c.hold && c.hold.kind !== 'dirty') return true;
    if (st.kind === 'extinguisher') {
      const anyBurning = this.ovens.some((o) => o.state === 'burning');
      return !!(anyBurning && c.hold?.kind !== 'extinguisher') || (!anyBurning && c.hold?.kind === 'extinguisher');
    }
    if (st.kind === 'drink' && !c.hold && (this.drinkMachine.state === 'idle' || this.drinkMachine.state === 'ready')) return true;
    if (st.kind === 'crate') {
      if (st.ing === 'mozzarella' && this.difficultyDirector && !this.difficultyDirector.cheeseSpawnerUnlocked) return false;
      return !c.hold || c.hold.kind === 'item' || (c.hold.kind === 'dish' && c.hold.dish === 'tomato_salad');
    }
    if (st.kind === 'dough') {
      if (this.difficultyDirector && !this.difficultyDirector.bakingOvenUnlocked) return false;
      return !c.hold || (c.hold.kind !== 'dirty' && c.hold.kind !== 'burnt_food' && !(c.hold.items || []).includes('dough'));
    }
    if (st.kind === 'board' && ((c.hold?.kind === 'raw' && !this.boards[st.idx].ing) || this.boards[st.idx].ready)) return true;
    if (st.kind === 'plate') {
      const p = this.plates[st.idx];
      return !!((c.hold?.kind === 'item' && p.hasPlate) || (!c.hold && (p.dish || p.items.length > 0)));
    }
    if (st.kind === 'oven') {
      const ov = this.ovens[st.idx];
      return !!(
        (ov.state === 'burning' && c.hold?.kind === 'extinguisher') ||
        (ov.state === 'burnt' && !c.hold) ||
        (ov.state === 'ready' && !c.hold) ||
        (ov.state === 'idle' && c.hold?.kind === 'raw_pizza')
      );
    }
    if ((st.kind === 'sink' || st.kind === 'rack') && c.hold?.kind === 'dirty') return true;
    return false;
  }

  update(dt, render = true) {
    if (!this.active) return;
    dt = clamp(dt, 0, 0.1);
    this.t += dt;
    if (!this.isHost && !this.hasHostState) {
      if (render) this.draw();
      return;
    }
    if (this.matchOver) {
      if (render) this.draw();
      return;
    }

    // 0. CẬP NHẬT DIFFICULTY DIRECTOR (Chỉ Host chạy match timer & phase để đồng bộ)
    if (this.isHost) {
      if (this.difficultyDirector) {
        this.difficultyDirector.update(dt);
        this.timer = this.difficultyDirector.getRemainingSeconds();
      }
    }
    if (this.matchOver) {
      if (render) this.draw();
      return;
    }
    if (this.isHost && this.feverT > 0) this.feverT = Math.max(0, this.feverT - dt);

    const me = this.myChef;
    for (const c of this.chefs) c.chopT = Math.max(0, (c.chopT || 0) - dt);

    // 1. TIẾN TRÌNH RÓT TRÀ SỮA TRÂN CHÂU (Chuẩn 2.5 giây)
    if (this.isHost && this.drinkMachine.state === 'pouring') {
      this.drinkMachine.prog = Math.min(1, this.drinkMachine.prog + dt / POUR_SECONDS);
      if (Math.random() < dt * 6) {
        this.spawnParticles(STATIONS.drink.x, STATIONS.drink.y + 8, 'bubble', 1);
      }
      if (this.drinkMachine.prog >= 1) {
        this.drinkMachine.state = 'ready';
        this.g.audio.sfx('ding');
        this.spawnParticles(STATIONS.drink.x, STATIONS.drink.y - 10, 'star', 5);
        const waitingChef = this.chefs.find((c) => c.present !== false && !c.hold && Math.hypot(c.x - STATIONS.drink.standX, c.y - STATIONS.drink.standY) < 64);
        if (waitingChef) {
          this.interactAt(waitingChef, STATIONS.drink, null);
        } else {
          this.addFloat(STATIONS.drink.x - 55, STATIONS.drink.y - 30, '🧋 Trà Sữa đã rót đầy! Chạm để lấy!', '#ffd54f');
        }
      }
    }

    // 2. CẬP NHẬT CÁC HÀNH ĐỘNG GIỮ TƯƠNG TÁC
    if (this.isHost) {
      this.playerController.updateKitchen(this.chefs.filter((c) => c.present !== false), dt, (chef, st) => this.isChefNearStation(chef, st));
    }

    // 3. Mèo Mimi chỉ tự nhận đơn khi người chơi bật trợ giúp.
    if (this.isHost && this.helperOn && this.sousChef) {
      this.sousChef.animT += dt * 6;
      this.sousChef.actionT -= dt;
      if (this.sousChef.actionT <= 0) {
        this.sousChef.actionT = 3.2;
        const waitTb = this.tables.find((t) => t.guest?.phase === 'wait_order');
        if (waitTb) {
          waitTb.guest.phase = 'ordered';
          waitTb.guest.patience = waitTb.guest.maxPatience;
          this.sousChef.statusText = '🐱 Mimi đã ghi order!';
          this.addFloat(waitTb.x, waitTb.y - 28, '🐱 Mimi đã nhận đơn!', '#ffe066');
        }
      }
    }

    // Đồng bộ mạng Co-op 2 người chơi Hiếu & Huyền trong cùng 1 Quán Ăn
    if (this.g.session && this.g.session.role !== 'none') {
      if (this.isHost) {
        this.netSyncT = (this.netSyncT || 0) + dt;
        if (this.netSyncT >= 0.1) {
          this.netSyncT = 0;
          this.broadcastState();
        }
      } else {
        this.netSendT = (this.netSendT || 0) + dt;
        if (this.netSendT >= 0.05) {
          this.netSendT = 0;
          this.g.session.sendRsc({
            kind: 'client_move',
            x: Math.round(me.x),
            y: Math.round(me.y),
            vx: Math.round(me.vx),
            vy: Math.round(me.vy),
            dir: Math.round((me.dir || 0) * 100) / 100,
            chopT: me.chopT || 0,
          });
        }
      }
    }

    const gAx = this.g.input.axis();
    const jx = (this.touchJoy.active && this.touchJoy.dragging) ? this.touchJoy.dx : gAx.x;
    const jy = (this.touchJoy.active && this.touchJoy.dragging) ? -this.touchJoy.dy : gAx.y;
    const keyAction = this.g.input.keys.has(' ') || this.g.input.keys.has('e') || this.g.input.keys.has('E');
    const actionPressed = (keyAction && !this.actionKeyDown) || this.g.actionHeld;
    this.actionKeyDown = keyAction;
    this.g.actionHeld = false;

    if (Math.hypot(jx, jy) > 0.12) {
      me.target = null;
      me.path = [];
      this.stepChefToward(me, me.x + jx * 78, me.y - jy * 78, dt, 310);
      const near = this.nearestInteract(me);
      if (this.canAutoTriggerNear(me, near)) {
        if (this.lastDwellKey !== near.key) {
          this.joyDwellT += dt;
          if (this.joyDwellT >= 0.16) {
            this.lastDwellKey = near.key;
            this.joyDwellT = 0;
            this.interactAt(me, near.station, near.table);
          }
        }
      } else {
        this.joyDwellT = 0;
        this.lastDwellKey = '';
      }
      if (actionPressed) {
        if (near) this.interactAt(me, near.station, near.table);
      }
    } else if (me.target) {
      this.lastDwellKey = '';
      this.followChefPath(me, dt, 330);
      const distToTarget = Math.hypot(me.x - me.target.x, me.y - me.target.y);
      if (distToTarget < 18 || (!me.path?.length && distToTarget < 34)) {
        const t = me.target;
        me.target = null;
        me.path = [];
        me.vx = 0;
        me.vy = 0;
        this.interactAt(me, t.station, t.table);
      }
    } else {
      me.vx = 0;
      me.vy = 0;
      const near = this.nearestInteract(me);
      if (!near) this.lastDwellKey = '';
      if (actionPressed) {
        if (near) this.interactAt(me, near.station, near.table);
        else this.autoSmartStep(me);
      }
    }

    // Tự động nhận order ('!') hoặc trả món khi chạy tới gần bàn khách
    for (const tb of this.tables) {
      if (tb.guest?.phase === 'wait_order' && Math.hypot(me.x - tb.standX, me.y - tb.standY) < 62) {
        this.interactAt(me, null, tb);
      } else if (tb.guest && me.hold?.kind === 'dish' && me.hold.dish === tb.guest.dish && Math.hypot(me.x - tb.standX, me.y - tb.standY) < 54) {
        this.interactAt(me, null, tb);
      }
    }

    for (const c of this.chefs) {
      if (c === me) continue;
      const blend = 1 - Math.exp(-16 * dt);
      c.renderX = (c.renderX ?? c.x) + (c.x - (c.renderX ?? c.x)) * blend;
      c.renderY = (c.renderY ?? c.y) + (c.y - (c.renderY ?? c.y)) * blend;
    }

    if (Math.hypot(me.vx, me.vy) > 40) {
      me.stepDustT = (me.stepDustT || 0) - dt;
      if (me.stepDustT <= 0) {
        me.stepDustT = 0.14;
        this.particles.push({
          x: me.x - Math.cos(me.dir) * 10,
          y: me.y + 14,
          vx: (Math.random() - 0.5) * 15,
          vy: -5 - Math.random() * 10,
          r: 4 + Math.random() * 3,
          kind: 'dust',
          life: 0.35,
          maxLife: 0.35,
        });
      }
    }

    // 4 & 5: Chỉ Host điều khiển khách hàng và tiến trình ăn để tránh sai lệch giữa 2 máy
    if (this.isHost) {
      // 4. TỐC ĐỘ SINH ĐƠN HÀNG THEO DIFFICULTY DIRECTOR (Phase 1: 25s/đơn, Phase 2 & 3: 12s/đơn)
      this.guestSpawnT -= dt;
      const activeGuests = this.guests.filter((g) => g.phase !== 'walk_out').length;
      if (this.guestSpawnT <= 0 || activeGuests === 0) {
        this.guestSpawnT = this.difficultyDirector ? this.difficultyDirector.orderSpawnInterval : 25.0;
        if (activeGuests < 4) this.spawnCustomer();
      }

      // 5. CẬP NHẬT KHÁCH HÀNG & TỐC ĐỘ GIẢM KIÊN NHẪN THEO PHASE (Phase 1: 1.0x, Phase 2 & 3: 1.3x nhanh hơn 30%!)
      const patienceMult = this.difficultyDirector ? this.difficultyDirector.patienceDecayMultiplier : 1.0;
      for (let i = this.guests.length - 1; i >= 0; i--) {
        const g = this.guests[i];
        g.animT += dt * 7;
        const tb = this.tables[g.tableId];
        if (g.phase === 'walk_in') {
          const wp = g.path && g.path.length ? g.path[0] : { x: tb.seatX, y: tb.seatY };
          const dx = wp.x - g.x, dy = wp.y - g.y;
          const d = Math.hypot(dx, dy);
          if (d > 8) {
            g.x += (dx / d) * 145 * dt;
            g.y += (dy / d) * 145 * dt;
          } else if (g.path && g.path.length > 1) {
            g.path.shift();
          } else {
            g.x = tb.seatX;
            g.y = tb.seatY;
            g.path = [];
            g.phase = 'wait_order';
            this.g.audio.sfx('bell');
          }
        } else if (g.phase === 'wait_order' || g.phase === 'ordered') {
          g.patience -= dt * patienceMult;
          if (g.patience <= 0) {
            g.phase = 'walk_out';
            g.path = this.findPath(tb.walkX ?? tb.standX, tb.walkY ?? tb.standY, DOOR_POS.x, DOOR_POS.y);
            tb.guest = null;
            this.combo = 0;
            this.g.audio.sfx('fail');
          }
        } else if (g.phase === 'eating') {
          g.eatT -= dt;
          if (g.eatT <= 0) {
            tb.eatingDish = null;
            tb.dirty = true;
            tb.dirtyCount = (tb.dirtyCount || 0) + 1;
            tb.tip = 35;
            tb.guest = null;
            g.phase = 'walk_out';
            g.x = tb.walkX ?? tb.standX;
            g.y = tb.walkY ?? tb.standY;
            g.path = this.findPath(g.x, g.y, DOOR_POS.x, DOOR_POS.y);
          }
        } else if (g.phase === 'walk_out') {
          const wp = g.path && g.path.length ? g.path[0] : DOOR_POS;
          const dx = wp.x - g.x, dy = wp.y - g.y;
          const d = Math.hypot(dx, dy);
          if (d > 10) {
            g.x += (dx / d) * 155 * dt;
            g.y += (dy / d) * 155 * dt;
          } else if (g.path && g.path.length > 1) {
            g.path.shift();
          } else {
            this.guests.splice(i, 1);
          }
        }
      }
    } else {
      // Client: cập nhật hoạt ảnh và bước đi mềm mại của khách theo dữ liệu từ Host
      for (const g of this.guests) {
        g.animT += dt * 7;
        if (g.phase === 'walk_in' || g.phase === 'walk_out') {
          const tb = this.tables[g.tableId];
          const wp = g.path && g.path.length ? g.path[0] : (g.phase === 'walk_in' ? { x: tb?.seatX ?? g.x, y: tb?.seatY ?? g.y } : DOOR_POS);
          const dx = wp.x - g.x, dy = wp.y - g.y;
          const d = Math.hypot(dx, dy);
          if (d > 6) {
            g.x += (dx / d) * 145 * dt;
            g.y += (dy / d) * 145 * dt;
          }
        }
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.tapRipples.length - 1; i >= 0; i--) {
      const rp = this.tapRipples[i];
      rp.r += 65 * dt;
      rp.alpha -= 2.2 * dt;
      if (rp.alpha <= 0) this.tapRipples.splice(i, 1);
    }

    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.y -= 28 * dt;
      f.life -= dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }

    if (render) this.draw();
  }

  buildFloorCache() {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const woodGrad = ctx.createLinearGradient(68, 80, 1180, 680);
    woodGrad.addColorStop(0, '#9a6f50');
    woodGrad.addColorStop(0.5, '#896043');
    woodGrad.addColorStop(1, '#755036');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(68, 28, 1144, 672);

    for (let row = 0, y = 40; y < 700; row++, y += 32) {
      ctx.fillStyle = row % 2 === 0 ? 'rgba(255, 224, 185, 0.05)' : 'rgba(25, 12, 4, 0.06)';
      ctx.fillRect(68, y, 1144, 32);
      ctx.strokeStyle = 'rgba(48, 26, 12, 0.42)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(68, y); ctx.lineTo(1212, y); ctx.stroke();
      for (let x = 130 + ((row * 83) % 190); x < 1180; x += 210) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 32); ctx.stroke();
        ctx.fillStyle = 'rgba(42, 22, 10, 0.35)';
        ctx.beginPath(); ctx.arc(x - 6, y + 8, 1.8, 0, Math.PI * 2); ctx.arc(x + 6, y + 24, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }

    this.drawDiamondFloor(ctx, [[70, 90], [425, 90], [425, 255], [185, 405], [70, 405]], '#7c91a3', '#64798b', '#415261');
    this.drawDiamondFloor(ctx, [[70, 520], [445, 520], [445, 700], [70, 700]], '#7c91a3', '#64798b', '#415261');
    this.drawDiamondFloor(ctx, [[720, 600], [1045, 435], [1195, 435], [1195, 700], [720, 700]], '#7c91a3', '#64798b', '#415261');
    this.drawDiamondFloor(ctx, [[825, 165], [1185, 165], [1185, 435], [1045, 435]], '#a67f60', '#8d684c', '#5d402a');
    this.floorCache = canvas;
  }

  // ================== VẼ ĐỒ HOẠ 2.5D DIORAMA SẮC NÉT CHUẨN COATSINK READY, SET, COOK! ==================
  draw() {
    this.syncHiDpi();
    const ctx = this.ctx;
    const dpr = this.dpr || 1;

    ctx.save();
    // Xoá toàn bộ màn hình bằng màu nền tối sang trọng
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fullW = this.canvas.width / dpr;
    const fullH = this.canvas.height / dpr;
    ctx.fillStyle = '#111820';
    ctx.fillRect(0, 0, fullW, fullH);

    // Áp dụng ma trận căn giữa đồng nhất (không bao giờ kéo méo hình trên điện thoại màn hình dài!)
    ctx.translate(this.viewOffsetX, this.viewOffsetY);
    ctx.scale(this.viewScale, this.viewScale);

    // 1. Khung viền ngoài của căn phòng Pizzeria
    ctx.fillStyle = '#141d26';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.beginPath();
    ctx.rect(64, 24, 1152, 678);
    ctx.clip();

    // Sàn gỗ và gạch caro là cảnh tĩnh, vẽ sẵn một lần để giảm tải mỗi khung hình.
    if (this.floorCache) ctx.drawImage(this.floorCache, 0, 0);

    // Bóng Ambient Occlusion dọc chân tường Bắc và hai bên
    const topAO = ctx.createLinearGradient(0, 95, 0, 165);
    topAO.addColorStop(0, 'rgba(15, 8, 4, 0.42)');
    topAO.addColorStop(1, 'rgba(15, 8, 4, 0)');
    ctx.fillStyle = topAO;
    ctx.fillRect(70, 95, 1120, 70);

    // Ánh nắng dịu chiếu qua cửa kính đôi & cửa sổ
    const sunBeam = ctx.createLinearGradient(512, 95, 540, 310);
    sunBeam.addColorStop(0, 'rgba(255, 248, 215, 0.25)');
    sunBeam.addColorStop(1, 'rgba(255, 248, 215, 0)');
    ctx.fillStyle = sunBeam;
    ctx.beginPath();
    ctx.moveTo(472, 115); ctx.lineTo(552, 115); ctx.lineTo(605, 305); ctx.lineTo(440, 305);
    ctx.closePath();
    ctx.fill();

    // Ánh sáng vàng cam ấm áp toả ra từ 2 vòm lửa Lò Nướng Pizza
    const pulse = Math.sin(this.t * 6) * 14;
    const fireGlow = ctx.createRadialGradient(992, 178, 18, 992, 230, 330 + pulse);
    fireGlow.addColorStop(0, 'rgba(255, 180, 50, 0.46)');
    fireGlow.addColorStop(0.55, 'rgba(255, 125, 20, 0.18)');
    fireGlow.addColorStop(1, 'rgba(255, 110, 10, 0)');
    ctx.fillStyle = fireGlow;
    ctx.fillRect(740, 100, 460, 390);

    // 4. TƯỜNG BẮC, CỬA KÍNH ĐÔI RA VÀO, CỬA SỔ & LÒ NƯỚNG GẠCH ĐỎ ĐÔI
    this.drawBackWallsAndOvens(ctx);

    // 5. GÓC BẾP TRÊN-TRÁI (Quầy 3D, Bồn rửa bát inox, Thùng rác xanh, Khay đỏ, Quầy gỗ uốn cong #1)
    this.drawTopLeftKitchen(ctx);

    // 6. GÓC BẾP DƯỚI-TRÁI (Quầy 3D, Khay Mozzarella trắng, Thùng Cà chua đỏ, Bàn cán Bột Pizza)
    this.drawBottomLeftPrep(ctx);

    // 7. GÓC BẾP DƯỚI-PHẢI (Quầy gỗ uốn cong #2 & 2 Thớt thái nguyên liệu)
    this.drawBottomRightKitchen(ctx);

    // 8. 5 BÀN ĂN TRONG PHÒNG (2 Bàn Sofa Đỏ 3D + 3 Bàn Vuông Khăn Trắng có ghế gỗ 3D)
    this.drawDiningTables(ctx);

    // 8b. Vẽ đường chấm dẫn đường thông minh & vòng tròn chạm cảm ứng
    this.drawNavigationPathAndHighlights(ctx);

    // 9. KHÁCH HÀNG, MÈO PHỤ BẾP MIMI & ĐẦU BẾP CHIBI YOU (Sắp xếp theo chiều dọc Y để có chiều sâu 2.5D chuẩn!)
    const actors = [
      ...this.guests.map((g) => ({ type: 'guest', y: g.y, obj: g })),
      ...(this.helperOn && this.sousChef ? [{ type: 'sousChef', y: this.sousChef.y, obj: this.sousChef }] : []),
      ...this.chefs.filter((c) => c.present !== false).map((c) => ({ type: 'chef', y: c.renderY ?? c.y, obj: c })),
    ].sort((a, b) => a.y - b.y);

    for (const a of actors) {
      if (a.type === 'guest') this.drawCustomer(ctx, a.obj);
      else if (a.type === 'sousChef') this.drawSousChefMimi(ctx, a.obj);
      else this.drawChef(ctx, a.obj);
    }

    // 10. HẠT HIỆU ỨNG
    this.drawParticles(ctx);

    // 11. BONG BÓNG GỌI MÓN CỦA KHÁCH
    for (const g of this.guests) {
      if (g.phase === 'wait_order' || g.phase === 'ordered') {
        this.drawOrderBubble(ctx, g);
      }
    }

    // 12. TƯỜNG BAO 3D HAI BÊN PHÒNG (Viền xanh ngọc trên đỉnh tường chuẩn ảnh gốc!)
    this.drawRoomWallsOverlay(ctx);
    ctx.restore();

    // 13. THANH CÔNG THỨC MÀU XANH DƯƠNG DƯỚI ĐÁY (Có vòm tròn nổi & làn khói trắng chuẩn ảnh gốc!)
    this.drawBottomBlueBar(ctx);

    // 14. NÚT UI GÓC TRÊN, HÀNG ĐỢI PHIẾU ORDER & NÚT CẢM ỨNG ĐIỆN THOẠI (Joystick + Nút ⚡ THAO TÁC)
    this.drawTopHudButtons(ctx);
    this.drawMobileControlsOverlay(ctx);

    // 15. CHỮ NỔI
    for (const f of this.floats) {
      ctx.save();
      ctx.globalAlpha = clamp(f.life / f.maxLife, 0, 1);
      ctx.font = '800 18px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#1a110b';
      ctx.lineWidth = 5;
      const textX = clamp(f.x, 320, 960);
      ctx.strokeText(f.text, textX, f.y, 620);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, textX, f.y, 620);
      ctx.restore();
    }

    if (this.matchOver) this.drawShiftResult(ctx);

    ctx.restore();
  }

  drawShiftResult(ctx) {
    ctx.fillStyle = 'rgba(10, 18, 28, 0.78)';
    ctx.fillRect(64, 24, 1152, 732);
    this.inkRoundRect(ctx, 350, 176, 580, 420, 24, '#fff8ec');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 34px "Baloo 2", sans-serif';
    ctx.fillStyle = '#a84300';
    ctx.fillText('🏁 KẾT THÚC CA BẾP!', 640, 224);
    ctx.font = '700 17px "Baloo 2", sans-serif';
    ctx.fillStyle = '#5d4037';
    ctx.fillText('Hai đầu bếp đã hoàn thành ca phục vụ.', 640, 266);

    ctx.font = '900 26px "Baloo 2", sans-serif';
    ctx.fillStyle = '#a84300';
    ctx.fillText(`🪙 ${fmt(this.earned)} xu trong ca`, 640, 322);
    ctx.font = '800 18px "Baloo 2", sans-serif';
    ctx.fillStyle = '#4e3b2c';
    ctx.fillText(`🍽️ ${this.served} món đã phục vụ`, 640, 360);
    ctx.font = '700 14px "Baloo 2", sans-serif';
    ctx.fillStyle = '#775b43';
    ctx.fillText(this.earned > this.previousBest && this.served > 0 ? '🏆 Kỷ lục mới của nông trại!' : `Kỷ lục nông trại: ${fmt(this.previousBest)} xu`, 640, 385);

    ctx.font = '900 38px sans-serif';
    ctx.fillStyle = '#b0a18e';
    ctx.fillText('★'.repeat(3), 640, 414);
    ctx.fillStyle = '#f4a62a';
    ctx.fillText('★'.repeat(this.starsReached) + '☆'.repeat(3 - this.starsReached), 640, 414);

    this.inkRoundRect(ctx, 405, 454, 230, 64, 18, '#267b35');
    this.inkRoundRect(ctx, 405, 448, 230, 62, 18, '#55bd4a');
    this.inkRoundRect(ctx, 645, 454, 230, 64, 18, '#a84300');
    this.inkRoundRect(ctx, 645, 448, 230, 62, 18, '#f59e42');
    ctx.font = '900 18px "Baloo 2", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('🔁 CHƠI CA MỚI', 520, 479);
    ctx.fillText('🏡 VỀ NÔNG TRẠI', 760, 479);
    ctx.font = '700 12px "Baloo 2", sans-serif';
    ctx.fillStyle = '#fff7e6';
    ctx.fillText('Chơi cùng nhau từ đầu', 520, 498);
    ctx.fillText('Giữ tiến độ trang trại', 760, 498);
  }

  // Hàm dựng Quầy Bếp Inox 3D có mặt trước (Cabinet Front), chân đế (Toe-kick) và mặt bàn vát sáng (Beveled Top)
  drawCounterBox3D(ctx, x, y, w, h, frontH = 22, topCol = '#9eb1c0', frontCol = '#5a6d7c') {
    ctx.save();
    // Bóng đổ mềm dưới sàn
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.roundRect(x - 2, y + 6, w + 8, h + frontH + 4, 6);
    ctx.fill();

    // Chân đế tối (Toe-kick)
    this.inkRect(ctx, x, y + h + frontH - 6, w, 6, '#222d35');

    // Mặt trước tủ bếp 3D (Front cabinet face)
    this.inkRect(ctx, x, y + h, w, frontH - 5, frontCol);
    // Đường kẻ cánh tủ
    ctx.strokeStyle = 'rgba(20, 30, 40, 0.45)';
    ctx.lineWidth = 2;
    for (let dx = 48; dx < w - 25; dx += 52) {
      ctx.beginPath(); ctx.moveTo(x + dx, y + h + 2); ctx.lineTo(x + dx, y + h + frontH - 6); ctx.stroke();
    }

    // Mặt bàn trên (Beveled Top Surface)
    const tg = ctx.createLinearGradient(x, y, x + w, y + h);
    tg.addColorStop(0, '#b5c7d6');
    tg.addColorStop(0.5, topCol);
    tg.addColorStop(1, '#8499aa');
    this.inkRect(ctx, x, y, w, h, tg);

    // Viền sáng phản quang mép trên mặt bàn
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    ctx.restore();
  }

  drawDiamondFloor(ctx, poly, c1, c2, borderCol = '#3d4e5d') {
    ctx.save();
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, W, H);
    const sz = 28;
    for (let y = -100; y < H + 100; y += sz) {
      for (let x = -100; x < W + 100; x += sz * 2) {
        const ox = x + (((y / sz) | 0) % 2) * sz;
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.moveTo(ox, y - sz);
        ctx.lineTo(ox + sz, y);
        ctx.lineTo(ox, y + sz);
        ctx.lineTo(ox - sz, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(30, 42, 54, 0.22)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    ctx.restore();
    // Viền nẹp ngăn cách giữa sàn gạch và sàn gỗ
    ctx.save();
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 3;
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  drawBackWallsAndOvens(ctx) {
    // Tường Bắc góc trái (xanh xám) + mặt chân tường 3D
    this.inkRect(ctx, 84, 28, 354, 62, '#7b92a6');
    this.inkRect(ctx, 84, 90, 354, 14, '#516475');

    // Tường gạch Bắc ở giữa
    const wallGrad = ctx.createLinearGradient(438, 28, 438, 120);
    wallGrad.addColorStop(0, '#b57c5a');
    wallGrad.addColorStop(1, '#8c583c');
    this.inkRect(ctx, 438, 28, 392, 92, wallGrad);
    this.inkRect(ctx, 438, 112, 392, 10, '#4e3222');
    // Hoạ tiết viên gạch nổi trên tường Bắc
    ctx.fillStyle = '#75462d';
    for (const [bx, by, bw] of [[444, 42, 24], [452, 56, 18], [562, 38, 26], [576, 54, 22], [560, 72, 20], [790, 44, 24], [798, 66, 20]]) {
      ctx.fillRect(bx, by, bw, 10);
      ctx.strokeStyle = '#3e2416'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, 10);
    }

    // CỬA KÍNH ĐÔI RA VÀO (x: 472..552, y: 30..122) chuẩn ảnh gốc
    this.inkRect(ctx, 472, 30, 80, 92, '#3d4852');
    const glassGrad = ctx.createLinearGradient(480, 36, 544, 114);
    glassGrad.addColorStop(0, '#c5dfee');
    glassGrad.addColorStop(0.5, '#92b4cb');
    glassGrad.addColorStop(1, '#6f92ab');
    this.inkRect(ctx, 480, 36, 64, 36, glassGrad);
    this.inkRect(ctx, 480, 78, 64, 38, glassGrad);
    // Vệt nắng chéo trên kính cửa
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.moveTo(486, 38); ctx.lineTo(506, 38); ctx.lineTo(492, 70); ctx.lineTo(482, 70);
    ctx.moveTo(516, 78); ctx.lineTo(534, 78); ctx.lineTo(520, 112); ctx.lineTo(506, 112);
    ctx.fill();
    // Thanh đẩy cửa inox ngang
    this.inkRect(ctx, 476, 71, 72, 7, '#eceff1');

    // CỬA SỔ LỚN BÊN PHẢI CỬA RA VÀO (x: 608..786, y: 28..98)
    this.inkRect(ctx, 608, 28, 178, 68, '#3d4852');
    this.inkRect(ctx, 616, 34, 78, 54, glassGrad);
    this.inkRect(ctx, 700, 34, 78, 54, glassGrad);
    // Chia ô kính mờ như ảnh gốc
    ctx.strokeStyle = 'rgba(61, 72, 82, 0.45)'; ctx.lineWidth = 2;
    for (const wx of [642, 668, 726, 752]) {
      ctx.beginPath(); ctx.moveTo(wx, 34); ctx.lineTo(wx, 88); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(616, 62); ctx.lineTo(778, 62); ctx.stroke();
    this.inkRect(ctx, 602, 90, 190, 10, '#2c353d');

    // Vách tường gạch 3D ngăn giữa Booth 2 và Lò Nướng + Giá treo Bình Chữa Cháy Đỏ 3D (STATIONS.extinguisher)
    this.inkRect(ctx, 814, 72, 24, 172, '#6d412a');
    this.inkRect(ctx, 814, 224, 24, 24, '#4b2b1b');

    // BÌNH CHỮA CHÁY ĐỎ 3D (Fire Extinguisher Station tại x: 826, y: 196)
    const meChef = this.chefs?.[0];
    const holdingExtinguisher = meChef?.hold?.kind === 'extinguisher';
    // Khung giá treo vàng-đen cảnh báo trên tường gạch
    this.inkRoundRect(ctx, 810, 172, 32, 48, 6, '#263238');
    this.inkRect(ctx, 813, 175, 26, 6, '#ffca28');
    if (!holdingExtinguisher) {
      // Thân bình chữa cháy đỏ 3D + Đồng hồ áp suất + Vòi phun đen
      this.inkRoundRect(ctx, 816, 184, 20, 32, 6, '#d50000');
      this.inkRect(ctx, 819, 192, 14, 8, '#ffeb3b');
      this.inkRect(ctx, 822, 178, 8, 7, '#cfd8dc');
      this.inkCircle(ctx, 826, 181, 3, '#69f0ae');
      ctx.strokeStyle = '#1a110b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(832, 182);
      ctx.quadraticCurveTo(842, 190, 838, 206);
      ctx.stroke();
    }

    // LÒ NƯỚNG GẠCH ĐỎ ĐÔI 3D (Twin Brick Wood-Fired Pizza Ovens: x = 838..1164, y = 34..186)
    const ovenWall = ctx.createLinearGradient(838, 34, 838, 186);
    ovenWall.addColorStop(0, '#a86c4c');
    ovenWall.addColorStop(1, '#7d4930');
    this.inkRect(ctx, 838, 34, 326, 152, ovenWall);

    // Vẽ từng hàng gạch so le trên thân lò nướng
    ctx.strokeStyle = 'rgba(45, 22, 10, 0.42)';
    ctx.lineWidth = 1.8;
    for (let row = 0, by = 94; by <= 174; row++, by += 16) {
      ctx.beginPath(); ctx.moveTo(840, by); ctx.lineTo(1162, by); ctx.stroke();
      for (let bx = 848 + (row % 2) * 18; bx < 1155; bx += 36) {
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + 16); ctx.stroke();
      }
    }

    // Gờ mái lò gạch + con sơn đỡ 3D
    this.inkRect(ctx, 832, 76, 338, 16, '#c48662');
    for (const cx of [848, 988, 1142]) {
      this.inkRect(ctx, cx, 92, 14, 12, '#8d5638');
    }

    // Chai lọ thuỷ tinh, bình gốm & cối đá trang trí trên nóc lò gạch chuẩn ảnh gốc!
    this.inkRoundRect(ctx, 850, 38, 16, 38, 6, '#33691e'); // chai dầu oliu xanh đậm
    this.inkRect(ctx, 854, 32, 8, 8, '#dce775');
    this.inkRoundRect(ctx, 870, 44, 15, 32, 5, '#d7ccc8'); // chai sốt kem
    this.inkRoundRect(ctx, 889, 48, 16, 28, 6, '#8d6e63'); // hũ gia vị nâu
    this.inkEllipse(ctx, 1132, 60, 20, 14, '#78909c');     // bát đá góc phải trên lò

    // Dây thường xuân xanh rủ mềm mại trên gờ lò nướng
    ctx.strokeStyle = '#264d1e'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(842, 84);
    ctx.quadraticCurveTo(885, 112, 935, 86);
    ctx.quadraticCurveTo(995, 108, 1055, 86);
    ctx.quadraticCurveTo(1105, 106, 1156, 84);
    ctx.stroke();
    for (let lx = 846; lx <= 1152; lx += 16) {
      const ly = 88 + Math.sin(lx * 0.08) * 7;
      ctx.fillStyle = lx % 32 === 0 ? '#66bb6a' : '#2e7d32';
      ctx.beginPath(); ctx.arc(lx, ly, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1b3b14'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    const ovenUnlocked = !this.difficultyDirector || this.difficultyDirector.bakingOvenUnlocked;

    // 2 Vòm lửa gạch xây hình nan quạt (Voussoir Brick Arches)
    for (let i = 0; i < 2; i++) {
      const ox = i === 0 ? 915 : 1072, oy = 174;
      const ov = this.ovens[i];
      const isBurning = ov.state === 'burning';

      // Vòm gạch ngoài (chuyển sang đỏ rực cảnh báo khi đang CHÁY BẾP!)
      ctx.fillStyle = isBurning ? (Math.sin(this.t * 18) > 0 ? '#d50000' : '#7c472e') : '#7c472e';
      ctx.strokeStyle = '#1a110b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ox, oy, 60, Math.PI, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      for (let a = Math.PI + 0.25; a < Math.PI * 2 - 0.2; a += 0.32) {
        ctx.beginPath();
        ctx.moveTo(ox + Math.cos(a) * 44, oy + Math.sin(a) * 44);
        ctx.lineTo(ox + Math.cos(a) * 60, oy + Math.sin(a) * 60);
        ctx.strokeStyle = '#2d180e';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Lòng lửa bên trong lò (Tắt lửa khi chưa mở khoá ở Phase 1-2, hoặc rực đỏ khi FIRE!)
      if (!ovenUnlocked && ov.state === 'idle') {
        ctx.fillStyle = '#37474f';
        ctx.beginPath();
        ctx.arc(ox, oy, 44, Math.PI, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        this.inkRect(ctx, ox - 44, oy - 6, 88, 10, '#546e7a');
        this.inkRoundRect(ctx, ox - 46, oy - 38, 92, 22, 8, 'rgba(38, 50, 56, 0.92)');
        ctx.font = '800 10.5px "Baloo 2", sans-serif';
        ctx.fillStyle = '#ffca28';
        ctx.textAlign = 'center';
        ctx.fillText('🔒 Mở ở Phase 3', ox, oy - 26);
      } else {
        const flicker = Math.sin(this.t * 12 + i * 2) * 3.5;
        const fg = ctx.createRadialGradient(ox, oy - 12, 4, ox, oy - 16, 46 + flicker);
        if (isBurning) {
          fg.addColorStop(0, '#ffeb3b');
          fg.addColorStop(0.4, '#ff1744');
          fg.addColorStop(1, '#4a0000');
        } else {
          fg.addColorStop(0, '#fffde7');
          fg.addColorStop(0.35, '#ffee58');
          fg.addColorStop(0.7, '#ff9800');
          fg.addColorStop(1, '#bf360c');
        }
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(ox, oy, 44, Math.PI, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        this.inkRect(ctx, ox - 44, oy - 6, 88, 10, '#b8764f');
      }

      if (ov.state === 'baking' || ov.state === 'ready' || ov.state === 'burning' || ov.state === 'burnt') {
        const foodKind =
          ov.state === 'baking'
            ? 'raw_pizza'
            : ov.state === 'burning' || ov.state === 'burnt'
              ? 'burnt_food'
              : 'pizza';
        this.drawFoodItem(ctx, ox, oy - 16, foodKind, 0.88);
        if (ov.state === 'baking') {
          this.drawPieTimer(ctx, ox - 28, oy - 56, ov.prog, '#ffca28', 16);
          const left = Math.max(0.1, (1 - ov.prog) * BAKE_SECONDS).toFixed(1);
          this.inkRoundRect(ctx, ox - 8, oy - 68, 56, 24, 8, '#ffb300');
          ctx.font = '900 12.5px "Baloo 2", sans-serif';
          ctx.fillStyle = '#1a110b';
          ctx.textAlign = 'center';
          ctx.fillText(`🔥${left}s`, ox + 20, oy - 55);
        } else if (ov.state === 'ready') {
          const burnVal = ov.burn || 0;
          const warn = burnVal > 0.35;
          const col = warn ? (Math.sin(this.t * 16) > 0 ? '#ff5252' : '#ff9800') : '#4caf50';
          this.drawPieTimer(ctx, ox - 28, oy - 56, 1 - burnVal, col, 16);
          const burnLeft = Math.max(0.1, (1 - burnVal) * BURN_SECONDS).toFixed(1);
          this.inkRoundRect(ctx, ox - 8, oy - 68, 72, 24, 8, col);
          ctx.font = '900 11.5px "Baloo 2", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(`✨Chín ${burnLeft}s`, ox + 28, oy - 55);
        } else if (ov.state === 'burning') {
          ctx.font = '28px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🔥', ox + Math.sin(this.t * 20) * 5, oy - 24);
          if ((ov.extinguishProg || 0) > 0) {
            const extLeft = Math.max(0.1, (1 - ov.extinguishProg) * EXTINGUISH_SECONDS).toFixed(1);
            this.drawPieTimer(ctx, ox - 32, oy - 58, ov.extinguishProg, '#00e5ff', 17);
            this.inkRoundRect(ctx, ox - 10, oy - 70, 76, 24, 8, '#00e5ff');
            ctx.font = '900 12px "Baloo 2", sans-serif';
            ctx.fillStyle = '#1a110b';
            ctx.fillText(`🧯Dập ${extLeft}s`, ox + 28, oy - 57);
          } else {
            this.drawPieTimer(ctx, ox - 30, oy - 58, 1, '#d50000', 17);
            this.inkRoundRect(ctx, ox - 10, oy - 70, 74, 24, 8, '#ff1744');
            ctx.font = '900 12px "Baloo 2", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('🔥FIRE! 🧯', ox + 27, oy - 57);
          }
        } else if (ov.state === 'burnt') {
          this.inkRoundRect(ctx, ox - 36, oy - 68, 72, 24, 8, '#37474f');
          ctx.font = '900 11.5px "Baloo 2", sans-serif';
          ctx.fillStyle = '#ff8a65';
          ctx.textAlign = 'center';
          ctx.fillText('🗑️Đồ Cháy!', ox, oy - 55);
        }
      }
    }

    // Quầy Máy Rót Trà Sữa Trân Châu Đường Đen 3D sát tường phải dưới lò nướng (x: 1106..1180, y: 304..394)
    this.drawCounterBox3D(ctx, 1108, 308, 72, 84, 22, '#c68b59', '#7d4e24');
    // Bình thuỷ tinh chứa Trà Sữa Trân Châu Đường Đen thơm béo
    this.inkRoundRect(ctx, 1118, 280, 50, 58, 8, '#fff8e7');
    this.inkRoundRect(ctx, 1121, 290, 44, 45, 6, '#d7a16e');
    // Lớp kem cheese trắng mịn phía trên bình
    this.inkRoundRect(ctx, 1121, 286, 44, 10, 4, '#fffdf7');
    // Hạt trân châu đen bóng dưới đáy bình trà sữa
    ctx.fillStyle = '#2b1708';
    for (const [px, py] of [[1127, 328], [1135, 330], [1143, 327], [1151, 330], [1158, 328], [1131, 321], [1147, 322]]) {
      ctx.beginPath(); ctx.arc(px, py, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    // Nắp máy nâu cafe + Vòi rót inox
    this.inkRoundRect(ctx, 1115, 274, 56, 10, 5, '#5d4037');
    this.inkRect(ctx, 1139, 336, 8, 10, '#cfd8dc');

    // Dòng chảy Trà Sữa + Trân Châu đang rót xuống cốc (khi state === 'pouring')
    if (this.drinkMachine.state === 'pouring') {
      ctx.fillStyle = '#c68b59';
      ctx.fillRect(1141, 344, 4, 20);
      const dropY = 346 + ((this.t * 45) % 16);
      ctx.fillStyle = '#2b1708';
      ctx.beginPath(); ctx.arc(1143, dropY, 3, 0, Math.PI * 2); ctx.fill();
      this.drawFoodItem(ctx, 1143, 366, 'soda', 0.72 + 0.18 * this.drinkMachine.prog);
      const left = Math.max(0.1, (1 - this.drinkMachine.prog) * POUR_SECONDS).toFixed(1);
      this.drawPieTimer(ctx, 1106, 290, this.drinkMachine.prog, '#ffb74d', 15);
      this.inkRoundRect(ctx, 1086, 246, 84, 24, 8, '#ffca28');
      ctx.font = '900 12px "Baloo 2", sans-serif';
      ctx.fillStyle = '#1a110b';
      ctx.textAlign = 'center';
      ctx.fillText(`🧋 Rót ${left}s`, 1128, 259);
    } else if (this.drinkMachine.state === 'ready') {
      this.drawWhiteTealPlate(ctx, 1143, 366, { hasPlate: true, items: [], dish: 'soda', dirty: false }, 0.85);
      this.inkRoundRect(ctx, 1086, 246, 86, 24, 8, '#69f0ae');
      ctx.font = '900 12px "Baloo 2", sans-serif';
      ctx.fillStyle = '#1a110b';
      ctx.textAlign = 'center';
      ctx.fillText('🧋 Xong! Lấy!', 1129, 259);
    } else {
      // Cốc rỗng chờ rót
      this.inkRoundRect(ctx, 1134, 354, 18, 20, 4, 'rgba(255,255,255,0.65)');
    }
  }

  drawTopLeftKitchen(ctx) {
    // Quầy chữ L góc trên-trái có mặt trước 3D
    this.drawCounterBox3D(ctx, 90, 92, 262, 54, 20, '#9eb1c0', '#5a6d7c');
    this.drawCounterBox3D(ctx, 90, 146, 72, 144, 22, '#9eb1c0', '#5a6d7c');

    // 2 Bình gốm trang trí ở góc trên-trái mặt bàn
    this.inkCircle(ctx, 112, 122, 10, '#6d4c41');
    this.inkCircle(ctx, 136, 118, 12, '#a1887f');
    this.inkCircle(ctx, 136, 118, 6, '#4e342e');

    // Kệ đỏ chứa Bát Sạch dự trữ (trong tổng số 4 bát của quán)
    this.inkRoundRect(ctx, 286, 82, 66, 62, 6, '#b71c1c');
    this.inkRoundRect(ctx, 292, 88, 54, 46, 4, '#e53935');
    ctx.strokeStyle = '#7f0000'; ctx.lineWidth = 2;
    for (let rx = 298; rx <= 340; rx += 7) {
      ctx.beginPath(); ctx.moveTo(rx, 126); ctx.lineTo(rx, 138); ctx.stroke();
    }
    // Vẽ chồng bát sạch đang có trên kệ (cleanPlateStack)
    for (let s = 0; s < (this.cleanPlateStack || 0); s++) {
      this.drawWhiteTealPlate(ctx, 319, 110 - s * 6, { hasPlate: true, items: [], dish: null, dirty: false }, 0.58);
    }
    // Nhãn hiển thị rõ số lượng Bát Sạch / 4 Bát
    const totalClean = this.getTotalCleanPlates();
    this.inkRoundRect(ctx, 272, 144, 96, 22, 8, totalClean > 0 ? '#e0f2f1' : '#ffcdd2');
    ctx.font = '900 11.5px "Baloo 2", sans-serif';
    ctx.fillStyle = totalClean > 0 ? '#004d40' : '#b71c1c';
    ctx.textAlign = 'center';
    ctx.fillText(`🍽️ Bát sạch: ${totalClean}/${MAX_PLATES}`, 320, 156);

    // Bồn rửa bát inox (Mặt rãnh inox phía trên + Bồn nước xanh ngọc phía dưới)
    this.inkRoundRect(ctx, 100, 156, 52, 48, 4, '#b0bec5');
    for (let y = 164; y <= 196; y += 6) {
      ctx.beginPath(); ctx.moveTo(108, y); ctx.lineTo(144, y); ctx.strokeStyle = '#607d8b'; ctx.lineWidth = 2; ctx.stroke();
    }
    // Lòng bồn nước xanh sâu 3D
    this.inkRoundRect(ctx, 100, 208, 52, 56, 5, '#00838f');
    this.inkRoundRect(ctx, 104, 214, 44, 46, 4, '#26c6da');
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(134, 226, 7, 0, Math.PI * 2); ctx.arc(118, 246, 4.5, 0, Math.PI * 2); ctx.fill();
    // Vòi nước inox chữ U
    this.inkRoundRect(ctx, 92, 228, 22, 9, 4, '#eceff1');
    this.inkCircle(ctx, 96, 222, 4, '#cfd8dc');

    // Nếu có bát bẩn đã đưa vô Bồn Rửa -> Vẽ chồng bát bẩn trong bồn + thanh tiến trình rửa 2.0s!
    if (this.sink.dirtyCount > 0) {
      for (let d = 0; d < Math.min(4, this.sink.dirtyCount); d++) {
        this.drawWhiteTealPlate(ctx, 126, 240 - d * 5, { hasPlate: true, items: [], dish: null, dirty: true }, 0.56);
      }
      const washLeft = Math.max(0.1, (1 - this.sink.prog) * WASH_SECONDS).toFixed(1);
      this.drawPieTimer(ctx, 174, 218, this.sink.prog, '#26c6da', 15);
      this.inkRoundRect(ctx, 154, 238, 92, 24, 8, '#4dd0e1');
      ctx.font = '900 11.5px "Baloo 2", sans-serif';
      ctx.fillStyle = '#1a110b';
      ctx.textAlign = 'center';
      ctx.fillText(`🫧 Rửa ${washLeft}s (${this.sink.dirtyCount})`, 200, 251);
    }

    // Thùng rác vuông 3D màu xanh lá dưới bồn rửa
    this.drawCounterBox3D(ctx, 94, 312, 56, 42, 18, '#43a047', '#2e7d32');
    this.inkRoundRect(ctx, 100, 318, 44, 30, 4, '#1c262b');

    // QUẦY GỖ UỐN CONG #1 (Top-Left Curved Wooden Counter có chiều dày 3D đồng đều đẹp mắt)
    ctx.save();
    // Bóng đổ dưới sàn
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.moveTo(90, 404);
    ctx.quadraticCurveTo(260, 396, 394, 246);
    ctx.lineTo(394, 276);
    ctx.quadraticCurveTo(268, 426, 90, 430);
    ctx.closePath();
    ctx.fill();

    // Mặt trước 3D màu gỗ nâu hạt dẻ
    const sideGrad1 = ctx.createLinearGradient(90, 380, 390, 250);
    sideGrad1.addColorStop(0, '#78441e');
    sideGrad1.addColorStop(0.5, '#9c5d2e');
    sideGrad1.addColorStop(1, '#6e3d1a');
    ctx.fillStyle = sideGrad1;
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(90, 384);
    ctx.quadraticCurveTo(255, 378, 388, 236);
    ctx.lineTo(388, 268);
    ctx.quadraticCurveTo(265, 412, 90, 418);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Mặt bàn gỗ mật ong ấm (độ rộng chuẩn đều đặn)
    const cg1 = ctx.createLinearGradient(90, 380, 388, 230);
    cg1.addColorStop(0, '#e39e64');
    cg1.addColorStop(0.5, '#f2b67f');
    cg1.addColorStop(1, '#dc965a');
    ctx.fillStyle = cg1;
    ctx.beginPath();
    ctx.moveTo(90, 342);
    ctx.quadraticCurveTo(222, 336, 340, 216);
    ctx.lineTo(388, 236);
    ctx.quadraticCurveTo(255, 378, 90, 384);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Đường viền sáng & vân ghép mặt bàn gỗ
    ctx.strokeStyle = 'rgba(255, 240, 215, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(94, 347);
    ctx.quadraticCurveTo(222, 341, 338, 222);
    ctx.stroke();
    ctx.restore();

    // Đĩa sứ trắng viền xanh #1 đặt ở đầu Quầy Gỗ Uốn Cong #1
    this.drawWhiteTealPlate(ctx, STATIONS.plateTop.x, STATIONS.plateTop.y, this.plates[0]);
  }

  drawBottomLeftPrep(ctx) {
    // Quầy chữ L 3D góc dưới-trái chứa Phô mai Mozzarella & Thùng Cà Chua đỏ
    this.drawCounterBox3D(ctx, 88, 524, 178, 62, 22, '#98acb9', '#546675');
    this.drawCounterBox3D(ctx, 88, 586, 84, 88, 20, '#98acb9', '#546675');

    const cheeseUnlocked = !this.difficultyDirector || this.difficultyDirector.cheeseSpawnerUnlocked;

    // Khăn trải màu xanh dương có nếp gấp rủ xuống mặt trước + 5 viên Phô Mai Mozzarella 3D (Mở khoá ở Phase 3!)
    this.inkRoundRect(ctx, 94, 604, 70, 62, 6, cheeseUnlocked ? '#1e88e5' : '#455a64');
    this.inkRect(ctx, 96, 662, 66, 12, cheeseUnlocked ? '#1565c0' : '#263238'); // mép khăn rủ xuống
    if (cheeseUnlocked) {
      for (const [dx, dy] of [[-14, -12], [10, -14], [-15, 10], [4, 4], [15, 14]]) {
        const mx = 129 + dx, my = 635 + dy;
        this.inkCircle(ctx, mx, my, 11.5, '#ffffff');
        ctx.fillStyle = '#cfd8dc';
        ctx.beginPath(); ctx.arc(mx + 2, my + 3, 7, 0.2, Math.PI - 0.2); ctx.fill();
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(mx - 2, my - 3, 2.5, 2.5);
      }
    } else {
      this.inkRoundRect(ctx, 96, 620, 66, 30, 6, 'rgba(20, 30, 40, 0.88)');
      ctx.font = '800 10px "Baloo 2", sans-serif';
      ctx.fillStyle = '#ffca28';
      ctx.textAlign = 'center';
      ctx.fillText('🔒 Phô Mai', 129, 632);
      ctx.fillText('(Phase 3)', 129, 644);
    }

    // Thùng gỗ 3D Cà Chua đỏ chín mọng (có nan gỗ ngang ở mặt trước như ảnh gốc!)
    this.inkRoundRect(ctx, 190, 518, 68, 58, 5, '#c68446');
    this.inkRect(ctx, 190, 572, 68, 18, '#8d5424');
    ctx.beginPath(); ctx.moveTo(190, 581); ctx.lineTo(258, 581); ctx.strokeStyle = '#4e2c11'; ctx.lineWidth = 2; ctx.stroke();
    this.inkRect(ctx, 196, 524, 56, 46, '#4e2c11');
    for (const [dx, dy] of [[-15, -11], [11, -11], [0, 0], [-13, 12], [13, 12]]) {
      const tx = 224 + dx, ty = 547 + dy;
      this.inkCircle(ctx, tx, ty, 11.5, '#e53935');
      ctx.fillStyle = '#ff8a80';
      ctx.beginPath(); ctx.arc(tx - 3, ty - 3, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b5e20';
      ctx.beginPath(); ctx.arc(tx, ty - 4, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Quầy chữ L 3D bên phải chứa Cây Lăn Bột & Đế Bánh Pizza tròn
    this.drawCounterBox3D(ctx, 342, 530, 82, 86, 22, '#98acb9', '#546675');
    // Thớt gỗ tròn có tay cầm & Đế bánh Pizza xếp lớp
    this.inkCircle(ctx, 382, 580, 28, '#b87a3d');
    if (cheeseUnlocked) {
      this.inkCircle(ctx, 382, 575, 22, '#f5deb3');
      this.inkCircle(ctx, 382, 572, 17, '#fbe8c4');
    } else {
      this.inkRoundRect(ctx, 348, 564, 68, 24, 6, 'rgba(20, 30, 40, 0.88)');
      ctx.font = '800 10px "Baloo 2", sans-serif';
      ctx.fillStyle = '#ffca28';
      ctx.textAlign = 'center';
      ctx.fillText('🔒 Đế Pizza', 382, 579);
    }
    // Cây lăn bột gỗ có 2 tay cầm nằm nghiêng bên trái
    ctx.save();
    ctx.translate(352, 552);
    ctx.rotate(-1.05);
    this.inkRoundRect(ctx, -24, -3, 48, 6, 3, '#a1622b');
    this.inkRoundRect(ctx, -16, -6, 32, 12, 4, '#e0a364');
    ctx.restore();
  }

  drawBottomRightKitchen(ctx) {
    // QUẦY GỖ UỐN CONG #2 (Bottom-Right Large Curved Counter có mặt dựng 3D & chân đế)
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.moveTo(722, 596);
    ctx.quadraticCurveTo(758, 442, 1016, 434);
    ctx.lineTo(1016, 478);
    ctx.quadraticCurveTo(798, 486, 772, 618);
    ctx.closePath();
    ctx.fill();

    // Chân đế tối (Toe-kick)
    ctx.fillStyle = '#222d35';
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(722, 598);
    ctx.lineTo(772, 598);
    ctx.lineTo(772, 608);
    ctx.lineTo(722, 608);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Mặt trước 3D màu gỗ nâu sẫm
    const sideGrad2 = ctx.createLinearGradient(722, 590, 1014, 430);
    sideGrad2.addColorStop(0, '#78441e');
    sideGrad2.addColorStop(0.5, '#9c5d2e');
    sideGrad2.addColorStop(1, '#6e3d1a');
    ctx.fillStyle = sideGrad2;
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(722, 580);
    ctx.quadraticCurveTo(756, 435, 1014, 428);
    ctx.lineTo(1014, 466);
    ctx.quadraticCurveTo(796, 476, 772, 600);
    ctx.lineTo(722, 600);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Mặt bàn gỗ mật ong ấm
    const cg2 = ctx.createLinearGradient(722, 580, 1014, 428);
    cg2.addColorStop(0, '#e39e64');
    cg2.addColorStop(0.5, '#f2b67f');
    cg2.addColorStop(1, '#dc965a');
    ctx.fillStyle = cg2;
    ctx.beginPath();
    ctx.moveTo(722, 580);
    ctx.quadraticCurveTo(752, 426, 1014, 418);
    ctx.lineTo(1014, 454);
    ctx.quadraticCurveTo(796, 464, 772, 580);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Viền sáng mặt bàn cong
    ctx.strokeStyle = 'rgba(255, 240, 215, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(728, 574);
    ctx.quadraticCurveTo(756, 432, 1008, 424);
    ctx.stroke();
    ctx.restore();

    // Đĩa sứ trắng viền xanh #2 đặt trên Quầy Gỗ Uốn Cong #2
    this.drawWhiteTealPlate(ctx, STATIONS.plateBot.x, STATIONS.plateBot.y, this.plates[1]);

    // Quầy dọc 3D sát tường phải chứa 2 Bàn Thớt Gỗ (x: 1086..1176, y: 495..688)
    this.drawCounterBox3D(ctx, 1086, 495, 90, 184, 14, '#c8d6e0', '#6c7f8e');
    for (let i = 0; i < 2; i++) {
      const by = i === 0 ? 545 : 638;
      // Mặt dựng 3D của thớt gỗ
      this.inkRoundRect(ctx, 1096, by - 28, 66, 62, 6, '#a67c38');
      this.inkRoundRect(ctx, 1096, by - 32, 66, 58, 6, '#e2be75');
      // Vết dao khắc trên góc thớt giống ảnh gốc
      ctx.strokeStyle = '#6d4c24'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(1104, by + 12); ctx.lineTo(1118, by + 20); ctx.moveTo(1108, by + 18); ctx.lineTo(1122, by + 12); ctx.stroke();
      const b = this.boards[i];
      if (b.ing) {
        this.drawFoodItem(ctx, 1126, by - 3, b.ready ? (b.ing === 'tomato' ? 'tomato_cut' : 'mozz_cut') : b.ing, 0.88);
        if (!b.ready) {
          this.drawPieTimer(ctx, 1094, by - 38, b.prog, '#29b6f6', 15);
          const left = Math.max(0.1, (1 - b.prog) * CHOP_SECONDS).toFixed(1);
          this.inkRoundRect(ctx, 1112, by - 50, 58, 22, 7, '#4fc3f7');
          ctx.font = '900 11.5px "Baloo 2", sans-serif';
          ctx.fillStyle = '#1a110b';
          ctx.textAlign = 'center';
          ctx.fillText(`🔪${left}s`, 1141, by - 38);
        } else {
          this.inkRoundRect(ctx, 1102, by - 50, 52, 20, 7, '#69f0ae');
          ctx.font = '900 11px "Baloo 2", sans-serif';
          ctx.fillStyle = '#1a110b';
          ctx.textAlign = 'center';
          ctx.fillText('✨Xong!', 1128, by - 39);
        }
      }
    }
  }

  drawDiningTables(ctx) {
    // 1. Booth 1 (Bàn Sofa Đỏ 3D bên trái: x = 204, y = 456)
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(140, 396, 134, 128);
    // Ghế sofa đỏ trên (có tựa lưng phồng & nệm ngồi có đường may)
    this.inkRoundRect(ctx, 142, 390, 126, 16, 5, '#8e1b1b');
    this.inkRoundRect(ctx, 142, 402, 126, 26, 6, '#d32f2f');
    // Ghế sofa đỏ dưới
    this.inkRoundRect(ctx, 142, 482, 126, 26, 6, '#d32f2f');
    this.inkRoundRect(ctx, 142, 502, 126, 16, 5, '#8e1b1b');
    // Bàn ăn khăn trải trắng 3D ở giữa Booth 1 (có mép khăn rủ xuống phía trước)
    this.inkRoundRect(ctx, 146, 424, 118, 60, 5, '#f8f9fa');
    this.inkRect(ctx, 148, 478, 114, 10, '#cfd8dc');
    // Dao & nĩa bạc trên mặt bàn Booth 1
    ctx.strokeStyle = '#607d8b'; ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(182, 444); ctx.lineTo(182, 466);
    ctx.moveTo(228, 444); ctx.lineTo(228, 466);
    ctx.stroke();

    // 2. Booth 2 (Bàn Sofa Đỏ 3D phía trên giữa: x = 680, y = 162)
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(604, 104, 156, 130);
    // Ghế sofa đỏ trái
    this.inkRoundRect(ctx, 606, 102, 14, 122, 5, '#8e1b1b');
    this.inkRoundRect(ctx, 616, 102, 26, 122, 6, '#d32f2f');
    // Ghế sofa đỏ phải
    this.inkRoundRect(ctx, 718, 102, 26, 122, 6, '#d32f2f');
    this.inkRoundRect(ctx, 740, 102, 14, 122, 5, '#8e1b1b');
    // Bàn ăn khăn trắng 3D ở giữa Booth 2
    this.inkRoundRect(ctx, 638, 112, 84, 102, 5, '#f8f9fa');
    this.inkRect(ctx, 640, 206, 80, 12, '#cfd8dc');

    // 3. 3 Bàn Vuông Khăn Trắng ở giữa phòng (Có ghế gỗ tựa lưng 3D & nếp khăn bàn rủ góc!)
    for (let i = 2; i <= 4; i++) {
      const tb = this.tables[i];
      ctx.save();
      ctx.translate(tb.x, tb.y);
      ctx.rotate(tb.rot || 0);
      // Bóng đổ dưới sàn
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.roundRect(-64, -36, 128, 82, 12); ctx.fill();

      // Ghế gỗ bên trái (có mặt ghế + thanh tựa lưng 3D)
      this.inkRoundRect(ctx, -60, -18, 24, 36, 5, '#c68b59');
      this.inkRoundRect(ctx, -64, -20, 7, 40, 3, '#8d582c');
      // Ghế gỗ bên phải
      this.inkRoundRect(ctx, 36, -18, 24, 36, 5, '#c68b59');
      this.inkRoundRect(ctx, 57, -20, 7, 40, 3, '#8d582c');

      // Chân bàn gỗ + Nếp khăn trải bàn trắng rủ xuống mặt trước
      this.inkRoundRect(ctx, -36, -30, 72, 74, 8, '#cfd8dc');
      this.inkRoundRect(ctx, -38, -38, 76, 72, 7, '#ffffff');
      ctx.strokeStyle = '#dce4ec'; ctx.lineWidth = 2;
      ctx.strokeRect(-30, -30, 60, 56);
      ctx.restore();
    }

    // Đĩa thức ăn của khách đang ăn hoặc Đĩa bẩn trên 5 bàn
    for (const tb of this.tables) {
      if (tb.eatingDish) {
        this.drawWhiteTealPlate(ctx, tb.x, tb.y, { hasPlate: true, items: [], dish: tb.eatingDish, dirty: false }, 0.85);
      } else if (tb.dirty) {
        this.drawWhiteTealPlate(ctx, tb.x, tb.y, { hasPlate: true, items: [], dish: null, dirty: true }, 0.85);
      }
    }
  }

  drawNavigationPathAndHighlights(ctx) {
    const me = this.myChef;
    if (me.path && me.path.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 235, 130, 0.78)';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(me.x, me.y + 10);
      for (const wp of me.path) {
        ctx.lineTo(wp.x, wp.y + 10);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const last = me.path[me.path.length - 1];
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(last.x, last.y + 8, 14 + Math.sin(this.t * 10) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const rp of this.tapRipples) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 230, 102, ${clamp(rp.alpha, 0, 1)})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const bounce = Math.sin(this.t * 8) * 5;
    const drawHintBadge = (x, y, text, bg = '#ffca28') => {
      ctx.save();
      ctx.translate(x, y + bounce);
      ctx.font = '800 13px "Baloo 2", sans-serif';
      const tw = Math.max(54, ctx.measureText(text).width + 18);
      this.inkRoundRect(ctx, -tw / 2, -28, tw, 24, 10, bg);
      ctx.fillStyle = '#1a110b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, -16);
      ctx.restore();
    };

    // Báo động Khủng Hoảng Cháy Bếp (FIRE!) ưu tiên số 1!
    const burningIdx = this.ovens.findIndex((o) => o.state === 'burning');
    if (burningIdx >= 0) {
      if (me.hold?.kind !== 'extinguisher') {
        drawHintBadge(STATIONS.extinguisher.x, STATIONS.extinguisher.y - 12, '🧯 Lấy Bình Chữa Cháy!', '#00e5ff');
      } else {
        const st = STATIONS['oven' + burningIdx];
        drawHintBadge(st.x, st.y + 42, '🧯 Giữ 3.0s Dập Lửa!', '#00e5ff');
      }
    }

    if (me.hold?.kind === 'burnt_food') {
      drawHintBadge(STATIONS.trash.x + 28, STATIONS.trash.y - 18, '🗑️ Vứt Đồ Cháy Vào Rác!', '#ff5252');
    } else if (me.hold?.kind === 'raw') {
      const st = !this.boards[0].ing ? STATIONS.board0 : STATIONS.board1;
      drawHintBadge(st.x, st.y - 36, `🔪 Đặt Thái (${CHOP_SECONDS}s)`, '#4fc3f7');
    } else if (me.hold?.kind === 'raw_pizza') {
      const ovIdx = Math.max(0, this.ovens.findIndex((o) => o.state === 'idle'));
      const st = STATIONS['oven' + ovIdx];
      drawHintBadge(st.x, st.y + 42, `🔥 Đút Lò (${BAKE_SECONDS}s)`, '#ffb74d');
    } else if (me.hold?.kind === 'dish') {
      for (const tb of this.tables) {
        if (tb.guest && tb.guest.dish === me.hold.dish) {
          drawHintBadge(tb.x, tb.y - 36, '🍽️ Chạm Phục Vụ!', '#69f0ae');
        }
      }
    } else if (me.hold?.kind === 'dirty') {
      drawHintBadge(STATIONS.sink.x + 35, STATIONS.sink.y - 25, `🫧 Đưa Bát Vô Bồn (${WASH_SECONDS}s)`, '#4dd0e1');
    } else if (!me.hold) {
      if (this.getTotalCleanPlates() === 0) {
        if (this.sink.dirtyCount > 0) {
          drawHintBadge(STATIONS.sink.x + 35, STATIONS.sink.y - 25, `🫧 Đứng Rửa Bát (${WASH_SECONDS}s)!`, '#4dd0e1');
        } else {
          const dirtyTb = this.tables.find((t) => t.dirty);
          if (dirtyTb) drawHintBadge(dirtyTb.x, dirtyTb.y - 36, '🍽️ Thu Bát Bẩn Đi Rửa!', '#ffca28');
        }
      } else if (this.guests.some((g) => g.phase === 'ordered' && g.dish === 'soda')) {
        drawHintBadge(STATIONS.drink.x - 16, STATIONS.drink.y - 42, this.drinkMachine.state === 'ready' ? '🧋 Lấy Trà Sữa' : `🧋 Rót Trà Sữa (${POUR_SECONDS}s)`, '#ffd54f');
      }
    }

    if (this.showTip) {
      for (const st of Object.values(STATIONS)) {
        drawHintBadge(st.x, st.y - 30, st.label, 'rgba(255,255,255,0.92)');
      }
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      if (p.kind === 'steam') {
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'smoke') {
        ctx.fillStyle = 'rgba(45, 52, 58, 0.78)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.25, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'foam') {
        ctx.fillStyle = '#e0f7fa';
        ctx.strokeStyle = '#00bcd4';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (p.kind === 'ember') {
        ctx.fillStyle = '#ffab00';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.7, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'bubble') {
        ctx.strokeStyle = '#80deea';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'chop') {
        ctx.fillStyle = '#ff5252';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.65, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'heart') {
        ctx.font = '18px sans-serif';
        ctx.fillText('❤️', p.x, p.y);
      } else if (p.kind === 'star') {
        ctx.font = '18px sans-serif';
        ctx.fillText('✨', p.x, p.y);
      } else {
        ctx.fillStyle = 'rgba(235, 215, 190, 0.55)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawWhiteTealPlate(ctx, x, y, plateState, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Nếu vị trí quầy ghép này đã hết bát sạch (do cả 4 bát đang ở ngoài bàn hoặc trong bồn rửa)
    if (plateState && plateState.hasPlate === false && !plateState.dish && !plateState.dirty && (!plateState.items || !plateState.items.length)) {
      ctx.strokeStyle = 'rgba(255, 224, 130, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '800 10px "Baloo 2", sans-serif';
      ctx.fillStyle = '#ffe082';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Hết bát', 0, 0);
      ctx.restore();
      return;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath(); ctx.arc(2, 5, 26, 0, Math.PI * 2); ctx.fill();
    this.inkCircle(ctx, 0, 0, 26, '#e0f2f1');
    ctx.strokeStyle = '#00897b';
    ctx.lineWidth = 3.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(0, 0, 20.5, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    this.inkCircle(ctx, 0, 0, 16.5, '#ffffff');

    if (plateState?.dirty) {
      ctx.fillStyle = '#8d6e63';
      ctx.beginPath(); ctx.arc(-4, 2, 6, 0, Math.PI * 2); ctx.arc(5, -3, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d32f2f';
      ctx.beginPath(); ctx.arc(2, 5, 3, 0, Math.PI * 2); ctx.fill();
    } else if (plateState?.dish) {
      this.drawFoodItem(ctx, 0, 0, plateState.dish, 0.94);
    } else if (plateState?.items?.length) {
      for (let i = 0; i < plateState.items.length; i++) {
        this.drawFoodItem(ctx, (i - (plateState.items.length - 1) * 0.5) * 7, 0, plateState.items[i], 0.8);
      }
    }
    ctx.restore();
  }

  // Vẽ hình minh hoạ món ăn & nguyên liệu chi tiết sắc nét chuẩn ảnh gốc Coatsink!
  drawFoodItem(ctx, x, y, kind, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (kind === 'pizza') {
      // Bánh Pizza Nướng Lò Gạch có vành bánh phồng vàng 3D, sốt cà chua đỏ, 4 miếng phô mai trắng tan chảy & lá húng quế
      this.inkCircle(ctx, 0, 2, 23, '#b86b28');
      this.inkCircle(ctx, 0, 0, 22, '#f0a350');
      this.inkCircle(ctx, 0, 0, 16.5, '#d32f2f');
      for (const [px, py] of [[-6, -5], [6, -5], [-5, 6], [6, 5]]) {
        this.inkEllipse(ctx, px, py, 5.2, 4.2, '#fffef0');
      }
      this.inkCircle(ctx, 0, 0, 3.2, '#2e7d32');
    } else if (kind === 'burnt_food') {
      // Bánh Pizza Cháy Đen (Overcooked / Burnt State) cần đem vứt vào Thùng Rác!
      this.inkCircle(ctx, 0, 2, 22, '#1c262b');
      this.inkCircle(ctx, 0, 0, 20, '#263238');
      this.inkCircle(ctx, 0, 0, 14, '#11171a');
      for (const [px, py] of [[-5, -4], [5, -4], [-4, 5], [5, 4]]) {
        this.inkCircle(ctx, px, py, 3.5, '#37474f');
      }
    } else if (kind === 'raw_pizza' || kind === 'dough') {
      this.inkCircle(ctx, 0, 2, 21, '#c69f68');
      this.inkCircle(ctx, 0, 0, 20, '#f5deb3');
      this.inkCircle(ctx, 0, 0, 15.5, '#fdf0d5');
      if (kind === 'raw_pizza') {
        this.inkCircle(ctx, 0, 0, 14, '#e53935');
        this.inkCircle(ctx, -4, -3, 4.5, '#ffffff');
        this.inkCircle(ctx, 5, 3, 4.5, '#ffffff');
      }
    } else if (kind === 'tomato_salad') {
      // Món Phase 1 Easy Mode (1 nguyên liệu): Đĩa Cà Chua Thái Tươi điểm lá húng quế xanh!
      for (const [dx, dy] of [[-7, 2], [0, -2], [7, 2], [0, 5]]) {
        this.inkEllipse(ctx, dx, dy, 8.5, 10.5, '#e53935');
        ctx.fillStyle = '#ff8a80';
        ctx.beginPath(); ctx.ellipse(dx, dy, 4.5, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
      this.inkCircle(ctx, 0, 0, 3.5, '#2e7d32');
    } else if (kind === 'caprese') {
      // Salad Caprese: các lát cà chua đỏ & phô mai Mozzarella trắng xếp chồng 3D dày dặn như ảnh gốc!
      for (let i = -2; i <= 2; i++) {
        this.inkEllipse(ctx, i * 5.2, 0, 10, 14, i % 2 === 0 ? '#e53935' : '#ffffff');
      }
    } else if (kind === 'soda') {
      // Ly Trà Sữa Trân Châu Đường Đen 3D: thân cốc kem sữa, vân đường đen, hạt trân châu đen óng & ống hút to!
      this.inkRoundRect(ctx, -11, -12, 22, 26, 6, '#fff8e7');
      this.inkRoundRect(ctx, -9, -6, 18, 18, 4, '#d7a16e');
      // Lớp kem cheese trắng phía trên
      this.inkRoundRect(ctx, -9, -9, 18, 5, 2, '#fffdf7');
      // Hạt trân châu đen dưới đáy ly
      ctx.fillStyle = '#231207';
      for (const [bx, by] of [[-5, 8], [0, 9], [5, 8], [-3, 4], [3, 4]]) {
        ctx.beginPath(); ctx.arc(bx, by, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      // Nắp vòm + Ống hút trân châu nâu tím
      this.inkRoundRect(ctx, -13, -15, 26, 5, 3, '#ffffff');
      this.inkRoundRect(ctx, 1, -25, 6, 12, 2, '#6d4c41');
    } else if (kind === 'tomato_cut' || kind === 'tomato') {
      for (const [dx, dy] of [[-5, 2], [0, 0], [5, -2]]) {
        this.inkEllipse(ctx, dx, dy, 8.5, 11, '#e53935');
        ctx.fillStyle = '#ff8a80';
        ctx.beginPath(); ctx.ellipse(dx, dy, 4.5, 6.5, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === 'mozz_cut' || kind === 'mozzarella') {
      for (const [dx, dy] of [[-5, 2], [0, 0], [5, -2]]) {
        this.inkEllipse(ctx, dx, dy, 8, 10.5, '#ffffff');
      }
    }
    ctx.restore();
  }

  // Khách hàng Chibi 3/4 có tay chân, tóc búi/dây buộc tóc và biểu cảm sống động như ảnh gốc!
  drawCustomer(ctx, g) {
    ctx.save();
    const walking = g.phase === 'walk_in' || g.phase === 'walk_out';
    const bob = walking ? Math.sin(g.animT * 1.6) * 3 : Math.sin(g.animT * 0.5) * 1.2;
    ctx.translate(g.x, g.y + bob);

    // Bóng đổ dưới chân/ghế
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 20, 21, 12, 0, 0, Math.PI * 2); ctx.fill();

    // Thân áo & 2 tay đặt lên bàn
    this.inkRoundRect(ctx, -14, 2, 28, 22, 10, g.style.shirt);
    this.inkCircle(ctx, -14, 14, 6, g.style.skin);
    this.inkCircle(ctx, 14, 14, 6, g.style.skin);

    // Đầu & Tai Chibi
    this.inkCircle(ctx, -17, -7, 5, g.style.skin);
    this.inkCircle(ctx, 17, -7, 5, g.style.skin);
    this.inkCircle(ctx, 0, -8, 18, g.style.skin);

    // Khuôn mặt (Lông mày + Mắt + Má hồng)
    ctx.fillStyle = 'rgba(235, 95, 115, 0.38)';
    ctx.beginPath(); ctx.arc(-9, -2, 3.5, 0, Math.PI * 2); ctx.arc(9, -2, 3.5, 0, Math.PI * 2); ctx.fill();

    const blink = Math.sin(this.t * 3 + g.animT) > 0.96;
    ctx.fillStyle = '#1a110b';
    if (blink) {
      ctx.fillRect(-8, -5, 5, 2);
      ctx.fillRect(3, -5, 5, 2);
    } else {
      ctx.beginPath(); ctx.arc(-6, -4, 2.4, 0, Math.PI * 2); ctx.arc(6, -4, 2.4, 0, Math.PI * 2); ctx.fill();
    }

    // Mái tóc 3D dày dặn + Búi tóc có dây buộc đỏ (như khách ở Bàn 3 trong ảnh gốc!)
    ctx.fillStyle = g.style.hair;
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -11, 18.5, Math.PI * 0.88, Math.PI * 2.12);
    ctx.quadraticCurveTo(0, -6, -18, -11);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    if (g.style.bun) {
      if (g.style.band) {
        this.inkCircle(ctx, 15, -18, 6, g.style.band);
      }
      this.inkCircle(ctx, 21, -22, 8.5, g.style.hair);
    }
    ctx.restore();
  }

  drawOrderBubble(ctx, g) {
    const tb = this.tables[g.tableId];
    const pulse = 1 + Math.sin(this.t * 5 + g.animT) * 0.03;
    const bx = tb.bubbleX, by = tb.bubbleY;
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(pulse, pulse);

    const isExclam = g.phase === 'wait_order';
    const w = isExclam ? 96 : 118, h = 64;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.roundRect(-w / 2 + 2, -h / 2 + 5, w, h, 30); ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 30);
    ctx.fill(); ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-10, h / 2 - 2);
    ctx.lineTo(-18, h / 2 + 12);
    ctx.lineTo(4, h / 2 - 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    const pct = clamp(g.patience / g.maxPatience, 0, 1);
    const pieCol = pct > 0.5 ? '#7cb342' : pct > 0.25 ? '#c0ca33' : '#e53935';
    this.drawPieTimer(ctx, -w / 2 + 28, 0, pct, pieCol, 19);

    if (isExclam) {
      ctx.font = '900 38px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#d32f2f';
      ctx.strokeStyle = '#1a110b';
      ctx.lineWidth = 3;
      ctx.strokeText('!', 18, 2);
      ctx.fillText('!', 18, 2);
    } else {
      this.drawWhiteTealPlate(ctx, 20, 2, { hasPlate: true, items: [], dish: g.dish, dirty: false }, 0.86);
    }
    ctx.restore();
  }

  drawPieTimer(ctx, x, y, pct, color, r = 18) {
    ctx.save();
    ctx.translate(x, y);
    this.inkCircle(ctx, 0, 0, r, '#4e342e');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(pct, 0, 1));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // Nhân vật YOU mặc bộ Khủng Long Cam 3D có mõm tròn, mắt cúc áo khâu chữ X và hàng gai lưng chuẩn ảnh gốc!
  drawChef(ctx, c) {
    ctx.save();
    const moving = Math.hypot(c.vx, c.vy) > 5;
    const bob = moving ? Math.sin(this.t * 16) * 3 : Math.sin(this.t * 4) * 1.2;
    ctx.translate(c === this.myChef ? c.x : c.renderX ?? c.x, (c === this.myChef ? c.y : c.renderY ?? c.y) + bob);

    // Bóng đổ + Vòng tròn trắng phát sáng dưới chân nhân vật YOU (Hoặc vàng rực khi đang FEVER ×2)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 16, 24, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this.feverT > 0 ? '#ffd54f' : 'rgba(255,255,255,0.86)';
    ctx.lineWidth = this.feverT > 0 ? 4.5 : 3.4;
    ctx.beginPath(); ctx.ellipse(0, 14, 26, 17, 0, 0, Math.PI * 2); ctx.stroke();

    // Hiệu ứng vệt dao chém trắng sắc nét khi đang thái trên thớt
    if (c.chopT > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(24, -6 + i * 7, 19, -0.65, 0.75);
        ctx.stroke();
      }
    }

    // Đĩa thức ăn / nguyên liệu / Bình Chữa Cháy / Đồ Cháy đang cầm trên tay
    if (c.hold) {
      const hx = Math.cos(c.dir) * 24, hy = Math.sin(c.dir) * 18 - 12;
      if (c.hold.kind === 'extinguisher') {
        this.inkRoundRect(ctx, hx - 9, hy - 14, 18, 28, 5, '#d50000');
        this.inkRect(ctx, hx - 6, hy - 6, 12, 7, '#ffeb3b');
        this.inkRect(ctx, hx - 4, hy - 19, 8, 6, '#cfd8dc');
      } else if (c.hold.kind === 'burnt_food') {
        this.drawFoodItem(ctx, hx, hy, 'burnt_food', 0.92);
      } else if (c.hold.kind === 'dish') {
        this.drawWhiteTealPlate(ctx, hx, hy, { hasPlate: true, items: [], dish: c.hold.dish, dirty: false }, 0.92);
      } else if (c.hold.kind === 'raw_pizza') {
        this.drawWhiteTealPlate(ctx, hx, hy, { hasPlate: true, items: [], dish: 'raw_pizza', dirty: false }, 0.92);
      } else if (c.hold.kind === 'dirty') {
        for (let d = 0; d < Math.min(4, c.hold.count || 1); d++) {
          this.drawWhiteTealPlate(ctx, hx, hy - d * 5, { hasPlate: true, items: [], dish: null, dirty: true }, 0.92);
        }
      } else {
        const list = c.hold.items || (c.hold.prevItems?.length ? [...c.hold.prevItems, c.hold.id] : [c.hold.id || 'tomato_cut']);
        this.drawWhiteTealPlate(ctx, hx, hy, { hasPlate: true, items: list, dish: null, dirty: false }, 0.92);
      }
    }

    const isHuyen = c.costume === 'huyen' || (c.name && c.name.includes('Huyền'));
    const bodyColor = isHuyen ? '#ec4899' : '#e67e22';
    const tailColor = isHuyen ? '#db2777' : '#d36415';
    const pantsColor = isHuyen ? '#f472b6' : '#1e88e5';
    const headColor = isHuyen ? '#f472b6' : '#f08a2b';
    const eyeRingColor = isHuyen ? '#831843' : '#784212';
    const spikeColor = isHuyen ? '#be185d' : '#873600';

    // Đuôi khủng long vẫy phía sau + Thân & Mũ có phân biệt Hiếu & Huyền
    const tailWag = moving ? Math.sin(this.t * 18) * 4 : Math.sin(this.t * 5) * 1.5;
    this.inkCircle(ctx, 12 + tailWag * 0.3, 14, 14, tailColor);
    this.inkCircle(ctx, -4, 4, 16, pantsColor);
    this.inkCircle(ctx, 2, 2, 18, bodyColor);

    // Đầu mũ khủng long hạt đậu
    ctx.save();
    ctx.rotate(0.45);
    this.inkEllipse(ctx, 2, -4, 19, 15, headColor);
    // 2 Mắt cúc áo khâu trên mũ khủng long + Gai lưng
    this.inkCircle(ctx, -6, -8, 4.2, eyeRingColor);
    this.inkCircle(ctx, 2, -11, 4.2, eyeRingColor);
    this.inkCircle(ctx, 8, -1, 3.8, spikeColor);
    this.inkCircle(ctx, 14, 4, 3.8, spikeColor);
    ctx.restore();

    if (isHuyen) {
      // Hoa đào hồng 🌸 cài trên đầu Huyền
      this.inkCircle(ctx, -8, -16, 4, '#ff80ab');
      this.inkCircle(ctx, -14, -14, 4, '#ff80ab');
      this.inkCircle(ctx, -6, -10, 4, '#ff80ab');
      this.inkCircle(ctx, -12, -8, 4, '#ff80ab');
      this.inkCircle(ctx, -10, -12, 3, '#ffd54f');
    } else {
      // Mũ thể thao xanh dương của Hiếu 🧢
      this.inkRoundRect(ctx, -12, -18, 20, 6, 3, '#1976d2');
      this.inkRect(ctx, -2, -16, 12, 3, '#0d47a1');
    }

    // Nhãn tên nổi bật (Hiếu 💙 / Huyền 💖 viền đen đậm)
    ctx.font = '900 18px "Baloo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 5;
    ctx.strokeText(c.name, 0, -34);
    ctx.fillStyle = c.tagColor || (isHuyen ? '#f472b6' : '#38bdf8');
    ctx.fillText(c.name, 0, -34);

    ctx.restore();
  }

  // Mèo Mimi đứng cạnh quầy và hỗ trợ nhận đơn khi người chơi bật trợ giúp.
  drawSousChefMimi(ctx, m) {
    ctx.save();
    const bob = Math.sin(m.animT || this.t * 10) * 2.5;
    ctx.translate(m.x, m.y + bob);

    // Bóng đổ + Vòng tròn hồng pastel dưới chân Mimi
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath(); ctx.ellipse(0, 15, 19, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 128, 171, 0.78)';
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.ellipse(0, 14, 21, 13, 0, 0, Math.PI * 2); ctx.stroke();

    // Nếu Mimi đang bưng món hoặc đĩa bẩn
    if (m.hold) {
      const hx = Math.cos(m.dir || 0) * 20, hy = Math.sin(m.dir || 0) * 14 - 10;
      if (m.hold.kind === 'dish') {
        this.drawWhiteTealPlate(ctx, hx, hy, { hasPlate: true, items: [], dish: m.hold.dish, dirty: false }, 0.82);
      } else if (m.hold.kind === 'dirty') {
        this.drawWhiteTealPlate(ctx, hx, hy, { hasPlate: true, items: [], dish: null, dirty: true }, 0.82);
      }
    }

    // Đuôi mèo tam thể ngoe nguẩy
    const wag = Math.sin(this.t * 12) * 5;
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, 10);
    ctx.quadraticCurveTo(-22, 4 + wag, -18, -6 + wag);
    ctx.stroke();
    ctx.strokeStyle = '#ffb74d';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Thân tạp dề hồng dễ thương + Đầu mèo trắng kem
    this.inkRoundRect(ctx, -12, 0, 24, 18, 9, '#f48fb1');
    this.inkCircle(ctx, 0, -6, 15, '#fff8e1');
    // Đốm cam tam thể trên trán
    ctx.fillStyle = '#ff9800';
    ctx.beginPath(); ctx.arc(-6, -12, 6, 0, Math.PI * 2); ctx.fill();

    // 2 Tai mèo nhọn hồng
    ctx.fillStyle = '#fff8e1';
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 2.5;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 5, -18);
      ctx.lineTo(sx * 14, -26);
      ctx.lineTo(sx * 14, -12);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    // Mắt long lanh + Mũi hồng
    ctx.fillStyle = '#1a110b';
    ctx.beginPath(); ctx.arc(-5, -5, 2.2, 0, Math.PI * 2); ctx.arc(5, -5, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f06292';
    ctx.beginPath(); ctx.arc(0, -2, 2, 0, Math.PI * 2); ctx.fill();

    // Mũ Bếp Trưởng trắng phồng (Chef Toque) trên đầu Mimi
    this.inkRoundRect(ctx, -9, -29, 18, 12, 6, '#ffffff');
    this.inkRect(ctx, -8, -19, 16, 4, '#cfd8dc');

    // Nhãn MIMI
    ctx.font = '900 13px "Baloo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 4;
    ctx.strokeText('🐱 MIMI', 0, -35);
    ctx.fillStyle = '#ff80ab';
    ctx.fillText('🐱 MIMI', 0, -35);

    ctx.restore();
  }

  drawRoomWallsOverlay(ctx) {
    // Tường bao 3D bên trái & bên phải có viền đỉnh màu xanh cyan chuẩn ảnh gốc!
    this.inkRect(ctx, 64, 24, 24, 676, '#1f2d3a');
    this.inkRect(ctx, 68, 28, 12, 330, '#4fc3f7');
    this.inkRect(ctx, 68, 520, 12, 178, '#4fc3f7');

    this.inkRect(ctx, 1184, 24, 30, 676, '#1f2d3a');
    this.inkRect(ctx, 1186, 420, 12, 278, '#4fc3f7');
  }

  drawBottomBlueBar(ctx) {
    const pizzaUnlocked = !this.difficultyDirector || this.difficultyDirector.bakingOvenUnlocked;

    // 3 Vòm bán nguyệt màu xanh dương nhô lên dưới các món ăn + Khói thơm bốc lên chuẩn ảnh gốc!
    this.inkCircle(ctx, 342, 712, 40, '#3b97d3');
    this.inkCircle(ctx, 576, 712, 40, '#3b97d3');
    this.inkCircle(ctx, 858, 712, 38, '#3b97d3');
    this.inkRect(ctx, 64, 700, 1150, 56, '#3b97d3');
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(66, 702, 1146, 5);

    // Khói thơm uốn lượn phía trên các món ăn chính ở thanh công thức
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const sx of [342, 576]) {
      const wave = Math.sin(this.t * 4 + sx) * 4;
      ctx.beginPath();
      ctx.moveTo(sx - 6, 680);
      ctx.quadraticCurveTo(sx - 14 + wave, 666, sx - 2, 654);
      ctx.moveTo(sx + 8, 678);
      ctx.quadraticCurveTo(sx + 16 - wave, 664, sx + 4, 650);
      ctx.stroke();
    }
    ctx.restore();

    // Khung công thức 1: Món Phase 1 (Salad Cà Chua 1 nguyên liệu, thái 3.0s) & Salad Caprese (Phase 3)
    this.inkRoundRect(ctx, 302, 694, 218, 54, 26, '#2471a3');
    this.drawWhiteTealPlate(
      ctx,
      340,
      720,
      { hasPlate: true, items: [], dish: pizzaUnlocked ? 'caprese' : 'tomato_salad', dirty: false },
      0.92
    );
    this.drawFoodItem(ctx, 404, 722, 'tomato_cut', 0.88);
    if (pizzaUnlocked) {
      this.drawFoodItem(ctx, 456, 722, 'mozz_cut', 0.88);
      ctx.font = '800 10.5px "Baloo 2", sans-serif';
      ctx.fillStyle = '#a8ff8e';
      ctx.textAlign = 'left';
      ctx.fillText('🔪3s', 484, 725);
    } else {
      ctx.font = '800 12px "Baloo 2", sans-serif';
      ctx.fillStyle = '#a8ff8e';
      ctx.textAlign = 'left';
      ctx.fillText('🔪Thái 3.0s', 432, 724);
    }

    // Khung công thức 2: Pizza Đút Lò (Mở khoá ở Phase 3 Level Up! Nướng 5.0s = Bột + Cà chua thái + Phô mai thái)
    this.inkRoundRect(ctx, 534, 694, 276, 54, 26, pizzaUnlocked ? '#1b4f72' : '#37474f');
    this.drawWhiteTealPlate(ctx, 574, 720, { hasPlate: true, items: [], dish: 'pizza', dirty: false }, 0.95);
    if (pizzaUnlocked) {
      this.drawFoodItem(ctx, 642, 722, 'dough', 0.8);
      this.drawFoodItem(ctx, 700, 722, 'tomato_cut', 0.88);
      this.drawFoodItem(ctx, 758, 722, 'mozz_cut', 0.88);
    } else {
      ctx.font = '900 13px "Baloo 2", sans-serif';
      ctx.fillStyle = '#ffca28';
      ctx.textAlign = 'left';
      ctx.fillText('🔒 PIZZA: Mở ở Phase 3 (120s)', 612, 724);
    }

    // Khung công thức 3: Trà Sữa Trân Châu = Rót 2.5s tại Máy Trà Sữa góc phải!
    this.inkRoundRect(ctx, 822, 694, 174, 54, 26, '#2471a3');
    this.drawWhiteTealPlate(ctx, 858, 720, { hasPlate: true, items: [], dish: 'soda', dirty: false }, 0.9);
    ctx.font = '800 13px "Baloo 2", sans-serif';
    ctx.fillStyle = '#ffe082';
    ctx.textAlign = 'left';
    ctx.fillText('🧋 Rót 2.5s', 892, 724);
  }

  drawTopHudButtons(ctx) {
    // 1. Nút Menu [☰] màu cam 3D góc trên trái
    this.inkRoundRect(ctx, 90, 48, 62, 62, 14, '#a04000');
    this.inkRoundRect(ctx, 90, 44, 62, 60, 14, '#e67e22');
    for (let i = -1; i <= 1; i++) {
      this.inkRoundRect(ctx, 104, 70 + i * 13, 34, 7, 3, '#ffffff');
    }

    // 2. Nút Help [?] màu cam 3D kế bên
    this.inkRoundRect(ctx, 168, 48, 62, 62, 14, '#a04000');
    this.inkRoundRect(ctx, 168, 44, 62, 60, 14, '#e67e22');
    ctx.font = '900 42px "Baloo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 5;
    ctx.strokeText('?', 199, 76);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('?', 199, 76);

    // 3. Đồng Xu Vàng 3D nghiêng + Số tiền kiếm được + Thanh Tiến Độ 3 Sao ★ ★ ★
    ctx.save();
    ctx.translate(268, 68);
    ctx.rotate(-0.3);
    this.inkEllipse(ctx, 2, 3, 20, 24, '#b7950b');
    this.inkEllipse(ctx, 0, 0, 20, 24, '#f1c40f');
    this.inkEllipse(ctx, 0, 0, 12, 15, '#f39c12');
    ctx.restore();

    ctx.font = '900 42px "Baloo 2", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 6;
    ctx.strokeText(String(this.earned), 300, 68);
    ctx.fillStyle = this.feverT > 0 ? '#ffe066' : '#ffffff';
    ctx.fillText(String(this.earned), 300, 68);

    // Thanh 3 Sao mục tiêu của Ca Bếp (300 / 750 / 1400)
    const maxGoal = STAR_GOALS[2];
    const barW = 148, barX = 250, barY = 98;
    this.inkRoundRect(ctx, barX, barY, barW, 14, 7, '#2c3e50');
    const fillW = Math.max(8, Math.min(barW - 4, ((this.earned / maxGoal) * (barW - 4))));
    if (this.earned > 0) {
      ctx.fillStyle = this.feverT > 0 ? '#ff6d00' : '#f1c40f';
      ctx.beginPath();
      ctx.roundRect(barX + 2, barY + 2, fillW, 10, 5);
      ctx.fill();
    }
    for (let s = 0; s < 3; s++) {
      const sx = barX + (STAR_GOALS[s] / maxGoal) * (barW - 10) + 4;
      ctx.font = '900 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = s < this.starsReached ? '#ffd54f' : '#7f8c8d';
      ctx.strokeStyle = '#1a110b';
      ctx.lineWidth = 2.5;
      ctx.strokeText('★', sx, barY + 6);
      ctx.fillText('★', sx, barY + 6);
    }

    // 4. HÀNG ĐỢI PHIẾU ORDER TRÊN ĐỈNH MÀN HÌNH (Chuẩn Overcooked! / Ready, Set, Cook!)
    const orderedGuests = this.getOrderQueue();

    for (let i = 0; i < orderedGuests.length; i++) {
      const g = orderedGuests[i];
      const tx = 442 + i * 110, ty = 32, tw = 104, th = 72;
      const pct = clamp(g.patience / g.maxPatience, 0, 1);
      const barCol = pct > 0.5 ? '#66bb6a' : pct > 0.25 ? '#ffa726' : '#ef5350';

      // Thẻ phiếu giấy trắng ngà có ghim kẹp trên đầu
      this.inkRoundRect(ctx, tx, ty + 4, tw, th, 10, '#fffdf7');
      this.inkRoundRect(ctx, tx, ty, tw, 18, 6, barCol);

      // Tên Bàn + Giá tiền thưởng
      ctx.font = '900 12px "Baloo 2", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1a110b';
      ctx.fillText(`BÀN ${g.tableId + 1}`, tx + 8, ty + 10);
      ctx.textAlign = 'right';
      const price = RECIPES_2D[g.dish]?.price || 115;
      ctx.fillText(`+${this.feverT > 0 ? price * 2 : price}🪙`, tx + tw - 6, ty + 10);

      // Hình món ăn + Nguyên liệu mini trên phiếu Order
      this.drawFoodItem(ctx, tx + 30, ty + 44, g.dish, 0.85);
      ctx.font = '800 10.5px "Baloo 2", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#4e342e';
      if (g.dish === 'pizza') {
        ctx.fillText('🫓+🍅+🧀', tx + 52, ty + 38);
        ctx.fillText(`🔥Nướng ${BAKE_SECONDS}s`, tx + 52, ty + 54);
      } else if (g.dish === 'caprese') {
        ctx.fillText('🍅+🧀', tx + 54, ty + 40);
        ctx.fillText(`🔪Thái ${CHOP_SECONDS}s`, tx + 54, ty + 54);
      } else if (g.dish === 'tomato_salad') {
        ctx.fillText('🍅Cà Chua', tx + 50, ty + 40);
        ctx.fillText(`🔪Thái ${CHOP_SECONDS}s`, tx + 50, ty + 54);
      } else {
        ctx.fillText('🧋Trà Sữa', tx + 50, ty + 40);
        ctx.fillText(`⏱️Rót ${POUR_SECONDS}s`, tx + 50, ty + 54);
      }

      // Thanh thời gian kiên nhẫn dưới đáy phiếu
      this.inkRect(ctx, tx + 6, ty + th - 6, tw - 12, 6, '#cfd8dc');
      ctx.fillStyle = barCol;
      ctx.fillRect(tx + 7, ty + th - 5, Math.max(2, (tw - 14) * pct), 4);
    }

    // 4a. Huy hiệu giai đoạn và tiến trình mở món theo thời gian phục vụ.
    const curPhase = this.difficultyDirector?.phase || 1;
    const phaseBg = curPhase === 3 ? '#ff6d00' : curPhase === 2 ? '#ffa000' : '#2e7d32';
    const phaseShadow = curPhase === 3 ? '#bf360c' : curPhase === 2 ? '#e65100' : '#1b5e20';
    this.inkRoundRect(ctx, 778, 48, 118, 46, 12, phaseShadow);
    this.inkRoundRect(ctx, 778, 44, 118, 44, 12, phaseBg);
    ctx.font = '900 12px "Baloo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      curPhase === 3 ? '🎉 PHASE 3: PIZZA' : curPhase === 2 ? '⚡ PHASE 2: RUSH' : '🥗 PHASE 1: EASY',
      837,
      60
    );
    ctx.font = '800 10px "Baloo 2", sans-serif';
    ctx.fillStyle = '#fff9c4';
    ctx.fillText(curPhase < 3 ? 'Món mới tự mở theo ca' : 'Đã mở đủ thực đơn', 837, 76);

    // Banner Thông Báo Chuyển Phase (Rush Hour / LEVEL UP! Menu Expansion)
    const banner = this.difficultyDirector?.announcementBanner;
    if (banner && banner.timer > 0) {
      const alpha = clamp(banner.timer, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      this.inkRoundRect(ctx, 320, 116, 620, 48, 16, 'rgba(20, 28, 38, 0.94)');
      ctx.font = '900 16px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = banner.color || '#ffe066';
      ctx.fillText(banner.text, 630, 134);
      ctx.font = '700 12px "Baloo 2", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(banner.subText || '', 630, 152);
      ctx.restore();
    } else if (this.feverT > 0) {
      // Huy hiệu FEVER ×2 rực lửa khi đạt chuỗi Combo!
      const pulse = 1 + Math.sin(this.t * 14) * 0.06;
      ctx.save();
      ctx.translate(640, 124);
      ctx.scale(pulse, pulse);
      this.inkRoundRect(ctx, -92, -16, 184, 32, 16, '#ff3d00');
      ctx.font = '900 16px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fffde7';
      ctx.fillText(`🔥 FEVER ×2 XU (${Math.ceil(this.feverT)}s)`, 0, 1);
      ctx.restore();
    }

    // 4b. Nút Bật/Tắt Mèo Phụ Bếp [🐱 Mimi] góc trên phải (x: 904..1040, y: 44..94)
    const mimiBg = this.helperOn ? '#ec407a' : '#546e7a';
    const mimiShadow = this.helperOn ? '#ad1457' : '#37474f';
    this.inkRoundRect(ctx, 904, 48, 134, 46, 12, mimiShadow);
    this.inkRoundRect(ctx, 904, 44, 134, 44, 12, mimiBg);
    ctx.font = '900 14px "Baloo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.helperOn ? '🐱 MIMI: BẬT' : '🐱 MIMI: TẮT', 971, 67);

    // 5. Đồng hồ đếm giờ [3:00 -> 0:00] dưới nút Mimi
    const mins = Math.floor(this.timer / 60);
    const secs = String(Math.floor(this.timer % 60)).padStart(2, '0');
    const timeStr = `${mins}:${secs}`;
    ctx.font = '900 32px "Baloo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 5;
    ctx.strokeText(timeStr, 971, 112);
    ctx.fillStyle = this.timer < 30 ? '#ff5252' : '#ffffff';
    ctx.fillText(timeStr, 971, 112);

    // 6. Nút Tạm dừng / Thoát [||] màu cam 3D góc trên phải + nút [✕] tròn nhỏ sát góc
    this.inkRoundRect(ctx, 1062, 48, 62, 62, 14, '#a04000');
    this.inkRoundRect(ctx, 1062, 44, 62, 60, 14, '#e67e22');
    this.inkRoundRect(ctx, 1079, 57, 10, 34, 4, '#ffffff');
    this.inkRoundRect(ctx, 1097, 57, 10, 34, 4, '#ffffff');

    this.inkCircle(ctx, 1196, 48, 16, '#455a64');
    ctx.font = '900 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('✕', 1196, 49);
  }

  // Cụm điều khiển cảm ứng dành riêng cho Điện Thoại nằm gọn trên thanh dưới (không che bất kỳ quầy bếp nào!)
  drawMobileControlsOverlay(ctx) {
    if (VP.phone && this.touchOrdersEl) {
      const queue = this.getOrderQueue();
      const markup = queue.map((g) => `<button data-kitchen="order" data-guest="${g.id}"><small>Bàn ${g.tableId + 1}</small><b>${g.dish === 'pizza' ? '🍕 Pizza' : g.dish === 'soda' ? '🧋 Trà sữa' : g.dish === 'caprese' ? '🥗 Caprese' : '🍅 Salad'}</b><i><u style="width:${Math.round(clamp(g.patience / g.maxPatience, 0, 1) * 100)}%"></u></i></button>`).join('');
      if (this.touchOrdersEl._html !== markup) { this.touchOrdersEl._html = markup; this.touchOrdersEl.innerHTML = markup; }
      const label = this.matchOver ? 'Chơi lại' : 'Thao tác';
      if (this.touchActionLabel.textContent !== label) this.touchActionLabel.textContent = label;
    }
    const isDragging = this.touchJoy.active && this.touchJoy.dragging;
    const jx = isDragging ? this.touchJoy.sx : JOY_HOME.x;
    const jy = isDragging ? this.touchJoy.sy : JOY_HOME.y;
    const kx = isDragging ? this.touchJoy.cx : JOY_HOME.x;
    const ky = isDragging ? this.touchJoy.cy : JOY_HOME.y;

    ctx.save();
    ctx.fillStyle = 'rgba(20, 34, 48, 0.65)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(jx, jy, isDragging ? 44 : 26, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    this.inkCircle(ctx, kx, ky, 14, '#ffe066');
    if (!isDragging) {
      ctx.font = '800 12px "Baloo 2", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText('🕹️ KÉO ĐI / CHẠM TRẠM', JOY_HOME.x + 34, JOY_HOME.y + 4);
    }
    ctx.restore();

    if (VP.phone) return;
    ctx.save();
    this.inkRoundRect(ctx, ACT_BTN.x - 76, ACT_BTN.y - 22, 152, 44, 20, '#43a047');
    ctx.font = '900 16px "Baloo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('⚡ THAO TÁC', ACT_BTN.x, ACT_BTN.y + 1);
    ctx.restore();
  }

  inkRect(ctx, x, y, w, h, fill) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
  }

  inkRoundRect(ctx, x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
  }

  inkCircle(ctx, x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  inkEllipse(ctx, x, y, rx, ry, fill) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
