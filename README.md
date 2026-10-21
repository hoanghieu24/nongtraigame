# 🐔 Farm Family Party

Game nông trại **cozy + vui nhộn** cho **2–4 người**, chơi ngay trên trình duyệt (PC & điện thoại, có PWA).
3D procedural (không dùng asset ngoài), nhạc nền lo-fi chill được tạo bằng code.

## Chạy game
```bash
npm install
npm run dev        # http://localhost:3000  (mở được từ điện thoại cùng Wi-Fi: dùng địa chỉ Network)
npm run build      # build ra dist/ — đưa lên bất kỳ hosting tĩnh nào (Netlify, GitHub Pages, itch.io...)
npm test           # logic nông trại, bếp chơi chung, camera và tự cân bằng đồ hoạ
npm run test:browser # cần npm run dev đang chạy và Chrome/Edge trên máy
```
> PWA / cài lên màn hình chính điện thoại cần chạy qua **HTTPS** (hosting tĩnh đều có sẵn).

Trên PowerShell chặn `npm.ps1`, dùng `npm.cmd test`, `npm.cmd run build` và `npm.cmd run dev`. Kiểm tra trình duyệt dùng hai tab với bản lưu tạm, giả lập điện thoại ngang/dọc; không ghi vào các nông trại đang lưu trên server. Có thể đặt `GAME_TEST_URL` để kiểm tra bản build qua `npm run preview`.

## Bếp chơi chung

Mở **Bếp chơi chung** từ menu hoặc nút **Quán**. Hai người trong cùng phòng vào chung một ca 3 phút, dùng chung khách, đơn, nguyên liệu, lò và bốn đĩa. Nhận đơn → lấy và thái nguyên liệu → ghép món → nướng pizza → phục vụ đúng bàn → dọn và rửa đĩa. Ca bắt đầu với salad và trà sữa, sau đó tăng lượng khách và mở thêm caprese/pizza. Kết quả ca và kỷ lục được lưu theo nông trại.

Chạm phiếu đơn để tìm bước tiếp theo, chạm trạm để tự đi tới hoặc dùng WASD/cần điều khiển. Trên điện thoại có phiếu đơn và nút thao tác riêng với vùng bấm từ 44px. Chủ phòng chuyển tab thì ca bếp vẫn tiếp tục khi trình duyệt cho phép chạy nền; đóng game chủ phòng sẽ ngắt kết nối.

Đồ hoạ tự cân bằng số pixel theo tốc độ máy. Cây có hình dáng riêng qua các giai đoạn lớn, góc nhìn cao hơn giúp thấy ruộng và vật nuôi rõ hơn. Chữ và phông tiếng Việt được đóng gói cùng game, không cần tải Google Fonts khi vào chơi.

## Chơi cùng người yêu / bạn bè
1. Người chủ: **Tạo Farm** → hiện **mã phòng 6 ký tự** (xem lại trong ⚙️ Cài đặt).
2. Người kia: **Vào Farm** → nhập mã. Tối đa 4 người.
   - Cùng máy (2 tab): tự nối bằng BroadcastChannel.
   - Khác máy/khác mạng: nối qua WebRTC (PeerJS) — cần Internet. Chủ farm phải đang mở game.
3. **Quỹ chung 🏦**: mỗi lần bán hàng, quỹ nhận thêm 15%. Dùng để xây chuồng, nâng nhà, mở rộng ruộng, mở nhà hàng.
4. **Rương chung 📦** cạnh nhà: cả nhà bỏ nguyên liệu để nấu ăn ở nhà hàng. (Trộm cũng nhòm ngó rương!)

## Điều khiển
| | PC | Điện thoại (chơi ngang) |
|---|---|---|
| Di chuyển | WASD / mũi tên | joystick bên trái |
| Hành động bằng dụng cụ | F / C | nút xanh theo dụng cụ đang chọn |
| Nhảy | Space | nút **Nhảy** |
| Tương tác (thu hoạch, nói chuyện, vào nhà...) | E | nút cam theo ngữ cảnh |
| Dụng cụ | 1–6 | thanh dụng cụ dưới màn hình |
| Đổi góc nhìn 3D / **thứ nhất** / 2D | V | nút 🎥 |
| Xoay / zoom camera | Q-X, chuột phải kéo, lăn chuột | kéo ngón bên phải, chụm 2 ngón |
| Xây dựng / trang trí | B (R xoay, Space/click đặt) | nút 🔨 (chạm sàn chọn chỗ → ✓ Đặt) |
| Túi (kiểu Minecraft: chạm ô → menu bật lên) / Nhiệm vụ / Chat | I / J / Enter | nút bên phải |
| Cảm xúc (hôn gió 😘, tim ❤️...) | nút 😘 | nút 😘 |

## Cách chơi (vòng lặp)
Cuốc đất ⛏️ → gieo 🌱 → tưới 💧 → thu hoạch → **bán** (thùng cạnh nhà / quầy chợ +10%) → mua chuồng & vật nuôi → **cho ăn đều** 🥣 → thu trứng/sữa/len → nấu ăn → nâng nhà, mua nội thất → mở **nhà hàng** → mở rộng farm.
- Game luôn gợi ý **"việc tiếp theo"** ở đầu màn hình kèm mũi tên chỉ đường.
- ⚠️ **Vật nuôi bỏ đói sẽ chết**: đói lả rồi còn 150 giây để cho ăn (có cảnh báo 2 lần + đồng hồ đếm ngược trên HUD).
- Nhà có 4 cấp (Nhà Nhỏ → Biệt Thự), mỗi cấp mở rộng thêm gian/phòng; đồ nội thất mua & đặt ngay trong nhà (🔨).
- Sự kiện ngẫu nhiên: Trộm 🚨, UFO, Tiệc Gà, Mưa, Thú Vàng, Thương nhân du hành, Thiên thạch, Thi câu cá.

## Điện thoại (ưu tiên chơi bằng web trên điện thoại)
- Tự nhận là điện thoại → **luôn hiển thị ngang**. Cầm dọc thì giao diện tự xoay 90° (xoay máy ngang là đọc thẳng). Android: bấm Chơi sẽ tự vào toàn màn hình + khoá ngang. iPhone: **Chia sẻ → Thêm vào Màn hình chính** để chơi toàn màn hình, không còn thanh Safari.
- Joystick cố định có mũi tên (hoặc chạm bên trái màn hình để có joystick nổi). Kéo ngón bên phải để nhìn quanh, chụm hai ngón bên phải để zoom; ngón điều khiển di chuyển hoạt động độc lập.
- Nút to (≥ 52px), dock có nhãn chữ, rung nhẹ khi bấm, thông báo nhỏ gọn ở dưới màn hình, không che HUD.
- Đồ hoạ tự chọn theo máy, tự hạ mức nếu FPS thấp; mặt đất nâng độ nét dần ở nền.

## Ban đêm, thời tiết, chuồng
- Ngày dài 20 phút thật (đêm ~7 phút). **Vào nhà, lại gần giường → Đi ngủ**; khi **cả nhà cùng ngủ** thì qua đêm. Không ngủ → **zombie** ra ăn cây chín và cắn bạn. Đánh bằng dép/chảo (phím 6), hoặc đặt **bù nhìn** để doạ chúng. Sáng ra zombie biến mất.
- Thời tiết đủ bộ theo mùa: nắng, nhiều mây, mưa, **giông (sấm sét)**, sương mù, **tuyết** (mùa đông). Mưa/giông tưới cây, tuyết làm cây lớn chậm.
- **Chuồng có cổng**: lại gần cổng bấm Mở/Đóng. Quên đóng → thú chạy ra ngoài; mở lại cổng thì chúng tự quay về.
- Ruộng chỉ trồng được trong khu ruộng; muốn rộng thêm phải **mua** ở biển "Mở rộng ruộng" (trả từ Quỹ Chung).

## Lưu & chơi tiếp
Mỗi farm lưu theo mã phòng. **Chủ farm và cả người vào cùng đều tự lưu**; lần sau chỉ cần bấm **Tiếp tục**. Nếu chủ farm chưa mở game, khách có thể mở bản lưu của mình làm chủ farm (bạn bè vẫn vào bằng cùng mã).

## Cấu trúc code
Xem [ARCHITECTURE.md](ARCHITECTURE.md).
