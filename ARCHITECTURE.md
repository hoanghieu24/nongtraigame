# Kiến trúc

```
src/
  core/        Game (điều phối), Renderer/Graphics (Low/Medium/High + tự hạ cấp), CameraRig (3D/FPV/2D), Input, Config, util
  state/       GameState (1 cây JSON duy nhất), Store (theo dõi thay đổi theo path), Sim (host-authoritative)
  data/        Toàn bộ nội dung: cây, thú, cá, món ăn, nội thất, NPC, quest, sự kiện, shop, level, bố cục map
  farming/ animals/ fishing/ combat/ thief/ restaurant/ furniture/ shop/ quests/ events/ economy/ inventory/ npc/ progression/
               *System.js = logic (thuần JS)   *View.js = hiển thị three.js
  world/       Terrain (texture bake), Water (shader), Sky (ngày/đêm/mưa), Scatter (instancing), World (công trình, va chạm)
  player/      LocalPlayer (điều khiển), PlayerView
  multiplayer/ Session (host/client), transports: BroadcastChannel + PeerJS (nạp lazy)
  save/        SaveSystem (IndexedDB + localStorage, có adapter để đổi sang backend)
  audio/       SFX + môi trường + nhạc lo-fi (Web Audio, procedural)
  art/         Kit (dựng hình procedural), Characters, AnimalModels, CropModels, FurnitureModels, Buildings, FX (particles)
  ui/          UI (HUD + panel), Menu, Guide (gợi ý việc tiếp theo)
tests/sim.test.mjs   33 test chạy trên Node
```

## Nguyên tắc
- **`Sim` không biết gì về three.js/DOM** → chạy được trên Node. Muốn chuyển sang server riêng: chạy đúng `state/Sim.js` + transport WebSocket.
- Client **không tự quyết state quan trọng**: chỉ gửi *command* (`farm.till`, `shop.buy`, `furn.place`...). Host validate (khoảng cách, tiền, cấp, vị trí) rồi áp dụng.
- Đồng bộ: `ops` (diff theo path, 10Hz) cho state bền vững; `snap` (10Hz) cho vị trí thú/NPC/trộm; `poses` (15Hz) cho người chơi; `fx` cho hiệu ứng/âm thanh.
- Chỉ vị trí người chơi là client-authoritative (chuẩn cho co-op nhỏ).
- View chỉ **đọc** state mỗi frame và tự đối soát (reconcile) → host/client dùng chung code hiển thị.

## Hiệu năng
InstancedMesh (cây, cỏ, hoa, đá, ô đất), mesh gộp vertex-color (nhân vật/thú/nhà), 1 draw call cho toàn bộ particles, DOM pool cho chữ nổi,
texture mặt đất bake sẵn, bóng đổ theo người chơi, chunk cỏ để frustum culling, tự hạ Low khi FPS < 38, chế độ 2D tắt bóng/cỏ/mây.
Đo (headless, 844×390): Low ≈ 67 draw call / 200k tam giác; Medium/High ≈ 210 draw call / 460k tam giác.

## Phone-first
`core/Viewport.js`: khi là điện thoại cầm dọc, `#app` được xoay 90° bằng CSS và mọi toạ độ chạm được quy đổi (`toLocal`) → mọi code UI/Input làm việc trong hệ toạ độ "ngang". CSS dùng class `.phone` + đơn vị `%` (không dùng vw/vh) để đúng cả khi bị xoay.

## Hạn chế đã biết
- iOS Safari không cho khoá hướng màn hình nên dùng cách xoay giao diện bằng CSS (đã kiểm thử bằng giả lập, chưa thử trên máy thật).
- Đường truyền **PeerJS (khác máy)** chưa kiểm thử được trong môi trường phát triển (không có Internet); đường **BroadcastChannel** đã test 2 tab đầy đủ.
- Mini-game *Thi nấu ăn*, *Đua thu hoạch*, *Vắt sữa* chưa làm (đã có: Thi câu cá, Tiệc Gà bắt gà, săn Thiên thạch).
- Mùa chỉ ảnh hưởng tốc độ lớn/loại cây & nhãn mùa, chưa đổi màu cảnh vật theo mùa.
- Emoji dùng làm icon: hình dạng phụ thuộc font emoji của thiết bị.
