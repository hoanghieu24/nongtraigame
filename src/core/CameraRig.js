import * as THREE from 'three';
import { damp, clamp } from './util.js';

const _screen = new THREE.Vector2(), _raycaster = new THREE.Raycaster();
const _projV = new THREE.Vector3();

// Camera: 3D cận cảnh sắc nét chuẩn game nông trại Mobile HD, Góc nhìn thứ nhất chuẩn FPS, và 2D top-down.
export class CameraRig {
  constructor(aspect) {
    // Giảm far plane xuống 125m (thay vì 420m) để tăng độ chính xác Z-buffer và tự động cắt bỏ (cull) vật thể ở quá xa
    this.persp = new THREE.PerspectiveCamera(54, aspect, 0.4, 125);
    this.ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, -80, 260);
    this.cam = this.persp; this.mode = '3D'; this.aspect = aspect;
    // Góc nhìn 3D gần hơn (dist = 14.5 thay vì 26), góc nghiêng 0.58 giúp nhân vật, cây trồng và thú cưng to rõ, sắc nét
    this.yaw = 0.08; this.pitch = 0.66; this.dist = 15.5; this.tYaw = 0.08; this.tPitch = 0.66; this.tDist = 15.5;
    this.fpPitch = 0; this.tFpPitch = 0;
    this.velYaw = 0; this.velPitch = 0;
    // Tuỳ chỉnh người chơi: fov (45..90, mặc định 54 cho 3D nét căng), sens (0.3..2.2, mặc định 1.0), smooth (0.1..1.0, mặc định 0.8)
    this.fov = 54; this.sens = 1.0; this.smooth = 0.8;
    this.sleeping = false;
    this.target = new THREE.Vector3(0, 0, -8); this.interior = false; this.shake = 0; this.time = 0;
    this.bounds = null;
  }
  applyPrefs({ fov, sens, smooth } = {}) {
    if (fov !== undefined) this.fov = clamp(+fov || 54, 44, 90);
    if (sens !== undefined) this.sens = clamp(+sens || 1.0, 0.25, 2.5);
    if (smooth !== undefined) this.smooth = clamp(Number.isFinite(+smooth) ? +smooth : 0.8, 0.05, 1.0);
    this.updateFov();
  }
  updateFov() {
    // Ở chế độ FPS, góc nhìn tự động cộng thêm 24 độ chuẩn game FPS góc rộng
    this.persp.fov = this.mode === 'FP' ? clamp(this.fov + 24, 68, 105) : this.fov;
    this.persp.near = this.mode === 'FP' ? 0.12 : 0.4;
    this.persp.far = this.mode === 'FP' ? 110 : 125;
    this.persp.updateProjectionMatrix();
  }
  setMode(m) {
    this.mode = m;
    this.cam = m === '2D' ? this.ortho : this.persp;
    this.velYaw = this.velPitch = 0;
    this.updateFov();
    this.resize(this.aspect);
  }
  // Nhìn quanh (chuột / cảm ứng đa điểm): tích hợp độ nhạy (sens) và quán tính trượt mượt (velYaw/velPitch)
  look(dx, dy) {
    const s = this.sens;
    if (this.mode === 'FP') {
      const dY = -dx * 0.0062 * s, dP = -dy * 0.0054 * s;
      this.tYaw += dY;
      this.tFpPitch = clamp((this.tFpPitch ?? 0) + dP, -1.25, 1.25);
      this.velYaw = dY * 18 * this.smooth;
      this.velPitch = dP * 14 * this.smooth;
    } else if (this.mode === '3D') {
      const dY = -dx * 0.0066 * s, dP = dy * 0.0044 * s;
      this.tYaw += dY;
      this.tPitch = clamp((this.tPitch ?? this.pitch) + dP, 0.28, 1.08);
      this.velYaw = dY * 20 * this.smooth;
      this.velPitch = dP * 14 * this.smooth;
    }
  }
  resize(aspect) {
    this.aspect = aspect; this.persp.aspect = aspect; this.persp.updateProjectionMatrix();
    const H = this.orthoH(); this.ortho.left = -H * aspect; this.ortho.right = H * aspect; this.ortho.top = H; this.ortho.bottom = -H; this.ortho.updateProjectionMatrix();
  }
  orthoH() { return clamp(this.dist * 0.46, 5.5, 18); }
  rotate(d) { if (this.mode === '3D') this.tYaw += d * this.sens; }
  zoomBy(f) { this.tDist = clamp(this.tDist * f, 7.5, 28); }
  // Chuyển nhanh 3 mức cự ly camera 3D: Gần sát rõ nét (11m) -> Vừa chuẩn (14.5m) -> Rộng (20m)
  cycleZoomPreset() {
    if (this.tDist > 17) { this.tDist = 11.0; this.tPitch = 0.62; return '🔍 Nhìn gần'; }
    if (this.tDist < 13) { this.tDist = 15.5; this.tPitch = 0.66; return '🎥 Góc nhìn tiêu chuẩn'; }
    this.tDist = 19.5; this.tPitch = 0.74; return '🌄 Nhìn toàn cảnh';
  }
  forward() { const y = this.mode === '2D' ? 0 : this.yaw; return { x: -Math.sin(y), z: -Math.cos(y) }; }
  right() { const y = this.mode === '2D' ? 0 : this.yaw; return { x: Math.cos(y), z: -Math.sin(y) }; }
  update(dt, focus, shake = 0, bob = 0) {
    this.time += dt;
    // Quán tính vuốt mượt (glide inertia) giảm dần tự nhiên
    const friction = Math.exp(-(14 - this.smooth * 8) * dt);
    this.velYaw *= friction;
    this.velPitch *= friction;
    if (Math.abs(this.velYaw) > 1e-4) this.tYaw += this.velYaw * dt;
    if (Math.abs(this.velPitch) > 1e-4) {
      if (this.mode === 'FP') this.tFpPitch = clamp(this.tFpPitch + this.velPitch * dt, -1.25, 1.25);
      else this.tPitch = clamp(this.tPitch + this.velPitch * dt, 0.28, 1.08);
    }
    const kLook = 36 - this.smooth * 24;
    if (this.mode === 'FP') {
      if (this.sleeping) {
        this.tFpPitch = damp(this.tFpPitch, 0.72, 4, dt);
      }
      this.yaw = damp(this.yaw, this.tYaw, kLook, dt);
      this.fpPitch = damp(this.fpPitch ?? 0, this.tFpPitch ?? 0, kLook, dt);
      this.target.set(focus.x, focus.y, focus.z);
      const baseEye = this.sleeping ? 0.92 : 1.56;
      const eyeY = focus.y + baseEye + Math.sin(this.time * 10) * bob * 0.035 + Math.sin(this.time * 61) * shake * 0.04;
      this.cam.position.set(focus.x, eyeY, focus.z);
      this.cam.rotation.set(this.fpPitch, this.yaw, 0, 'YXZ');
      return;
    }
    this.yaw = damp(this.yaw, this.tYaw, kLook, dt);
    this.pitch = damp(this.pitch, this.tPitch ?? this.pitch, kLook, dt);
    const targetDist = this.sleeping ? 9.5 : this.interior ? Math.min(this.tDist, 14.5) : this.tDist;
    this.dist = damp(this.dist, targetDist, 9, dt);
    this.target.x = damp(this.target.x, focus.x, 12, dt);
    this.target.y = damp(this.target.y, focus.y, 12, dt);
    this.target.z = damp(this.target.z, focus.z, 12, dt);
    const sx = (Math.sin(this.time * 61) * shake) * 0.35, sy = (Math.cos(this.time * 53) * shake) * 0.3;
    const pitch = this.mode === '2D' ? 1.22 : this.sleeping ? 0.52 : this.interior ? Math.min(this.pitch, 0.74) : this.pitch;
    const yaw = this.mode === '2D' ? 0 : this.yaw;
    const d = this.mode === '2D' ? 50 : this.dist, cp = Math.cos(pitch);
    this.cam.position.set(this.target.x + Math.sin(yaw) * cp * d + sx, this.target.y + Math.sin(pitch) * d + sy, this.target.z + Math.cos(yaw) * cp * d);
    this.cam.lookAt(this.target.x + sx * 0.4, this.target.y + (this.sleeping ? 0.65 : 0.92), this.target.z);
    if (this.mode === '2D') { const H = this.orthoH(); if (Math.abs(this.ortho.top - H) > 0.01) this.resize(this.aspect); }
  }
  // tia từ toạ độ màn hình (px) -> điểm trên mặt phẳng y = h (Zero GC allocation)
  groundPoint(px, py, w, h, y = 0) {
    if (w <= 0 || h <= 0) return null;
    _screen.set((px / w) * 2 - 1, -(py / h) * 2 + 1);
    // Camera 2D có các tia song song; không bắn tia từ vị trí camera như phối cảnh 3D.
    this.cam.updateMatrixWorld();
    _raycaster.setFromCamera(_screen, this.cam);
    const { origin: o, direction: dir } = _raycaster.ray; if (Math.abs(dir.y) < 1e-4) return null;
    const t = (y - o.y) / dir.y; if (t < 0) return null;
    return { x: o.x + dir.x * t, z: o.z + dir.z * t };
  }
  project(v3, w, h) {
    _projV.copy(v3).project(this.cam); if (_projV.z > 1 || _projV.z < -1) return null;
    return { x: (_projV.x * 0.5 + 0.5) * w, y: (-_projV.y * 0.5 + 0.5) * h };
  }
}

