// Viewport: trên điện thoại luôn hiển thị NGANG. iOS Safari không khoá được hướng màn hình nên khi cầm dọc
// ta xoay cả #app 90° bằng CSS và quy đổi toạ độ chạm sang toạ độ "ngang" (local).
export const VP = { rot: false, phone: false, W: typeof innerWidth !== 'undefined' ? innerWidth : 1280, vw: typeof innerWidth !== 'undefined' ? innerWidth : 1280, vh: typeof innerHeight !== 'undefined' ? innerHeight : 760 };
export function setupViewport(app, cb) {
  const apply = () => {
    const w = innerWidth, h = innerHeight;
    const isTouch = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const phone = isTouch && Math.min(w, h) < 920;
    const rot = phone && h > w;
    Object.assign(VP, { phone, rot, W: w, vw: rot ? h : w, vh: rot ? w : h });
    app.classList.toggle('phone', phone); app.classList.toggle('rot', rot);
    if (rot) Object.assign(app.style, { left: '0', top: '0', right: 'auto', bottom: 'auto', width: h + 'px', height: w + 'px', transformOrigin: '0 0', transform: `translateX(${w}px) rotate(90deg)` });
    else app.style.cssText = '';
    cb?.();
  };
  addEventListener('resize', apply); addEventListener('orientationchange', () => { setTimeout(apply, 80); setTimeout(apply, 400); }); apply(); return apply;
}
export const toLocal = (x, y) => (VP.rot ? { x: y, y: VP.W - x } : { x, y });
export const lookDelta = (dx, dy) => (VP.rot ? { x: dy, y: -dx } : { x: dx, y: dy });
