import { Game } from './core/Game.js';
import { UI } from './ui/UI.js';
import { setupViewport } from './core/Viewport.js';

// Xoá Service Worker cache cũ tránh lỗi kẹt trắng trang trên IP LAN (192.168.x.x)
try {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  }
  if ('caches' in window) {
    caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
  }
} catch { /* ignore */ }

// main.js khởi động: tạo Game + UI rồi nối chúng lại.
let game;
setupViewport(document.getElementById('app'), () => game?.resize());
game = new Game(document.getElementById('c'));
const ui = new UI();
ui.bind(game);
game.init(ui);
if (game.params.has('autostart')) ui.menu.quickStart();
document.getElementById('rotOk')?.addEventListener('click', () => document.getElementById('rotate')?.classList.add('dismissed'));
