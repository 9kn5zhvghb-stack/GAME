# ARENA CLASH — PvP tối đa 5 người chơi

Game PvP thời gian thực, chạy thuần HTML/CSS/JS, đồng bộ nhiều người chơi qua **Firebase Realtime Database**, host miễn phí trên **GitHub Pages**.

> **Lưu ý bản quyền:** 2 nhân vật trong game (**Hắc Ảnh** – sát thủ ẩn thân, **Độc Hành Kiếm Khách** – kiếm sĩ cận chiến) là nhân vật **gốc do mình thiết kế**, lấy cảm hứng theo đúng lối chơi sát thủ / kiếm khách mà bạn mô tả. Mình không thể sao chép tên, tạo hình hay bộ chiêu thức nguyên văn của các nhân vật có bản quyền (Raz trong Liên Quân Mobile hay nhân vật trong game bạn nhắc tới). Bạn có thể tự đổi tên/màu sắc trong `game.js` (object `CHAR_DEFS`) và `style.css` (`.char-portrait`) thoải mái vì đây là code của riêng bạn.

## 1. Cấu trúc file
```
pvp-game/
├── index.html          # Giao diện: đăng nhập, chọn nhân vật, phòng chờ, canvas game
├── style.css            # Giao diện đấu trường tối, neon
├── firebase-config.js   # ⚠️ Bạn PHẢI điền config Firebase của bạn vào đây
├── game.js               # Toàn bộ logic game + đồng bộ realtime
└── README.md
```

## 2. Tạo Firebase Realtime Database (miễn phí)

1. Vào https://console.firebase.google.com → **Add project** → đặt tên bất kỳ → tạo project.
2. Trong project, vào menu trái **Build → Realtime Database** → **Create Database** → chọn khu vực gần bạn (vd Singapore) → chọn **Start in test mode** (cho phép đọc/ghi tự do, phù hợp để chạy thử nhanh với bạn bè).
3. Vào **Project settings** (icon bánh răng) → tab **General** → kéo xuống **Your apps** → bấm biểu tượng `</>` (Web) → đặt tên app → **Register app**.
4. Firebase sẽ hiện ra object `firebaseConfig` — copy toàn bộ và dán đè vào file `firebase-config.js` (thay các giá trị `YOUR_...`).
5. Vào tab **Realtime Database → Rules**, đảm bảo rules đang là:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
   ⚠️ Đây là rule **mở hoàn toàn** — chỉ dùng để chơi thử với bạn bè, không dùng cho sản phẩm thật vì ai cũng có thể ghi/xoá dữ liệu. Nếu muốn chặt chẽ hơn, sau này có thể thêm Firebase Authentication.

## 3. Chạy thử local

Vì trình duyệt chặn một số API khi mở file trực tiếp (`file://`), hãy chạy qua server local đơn giản:

```bash
cd pvp-game
python3 -m http.server 8080
```

Rồi mở `http://localhost:8080` trên nhiều tab/trình duyệt khác nhau để test nhiều người chơi.

## 4. Đưa lên GitHub + GitHub Pages (chơi cùng bạn bè qua internet)

```bash
cd pvp-game
git init
git add .
git commit -m "Arena Clash - PvP game"
git branch -M main
git remote add origin https://github.com/<TÊN_GITHUB_CỦA_BẠN>/<TÊN_REPO>.git
git push -u origin main
```

Sau đó:
1. Vào repo trên GitHub → **Settings → Pages**.
2. Ở mục **Branch**, chọn `main` và thư mục `/ (root)` → **Save**.
3. Đợi 1-2 phút, GitHub sẽ cấp link dạng: `https://<TÊN_GITHUB_CỦA_BẠN>.github.io/<TÊN_REPO>/`
4. Gửi link đó cho bạn bè — ai vào cũng nhập tên, tạo phòng hoặc nhập mã phòng để chơi chung (tối đa 5 người/phòng).

## 5. Cách chơi

**Trên PC:**
- **Di chuyển:** W A S D (hoặc phím mũi tên)
- **Đánh thường:** Click chuột trái (đánh theo hướng con trỏ)
- **Chiêu Q / E / R:** phím Q, E, R
- Ai đạt **5 mạng hạ gục** đầu tiên → thắng trận. Chết sẽ hồi sinh sau ~2.5 giây.

**Trên điện thoại (tự động bật khi phát hiện màn hình cảm ứng):**
- **Joystick ảo** góc dưới bên trái để di chuyển.
- **Nút "Đánh" / Q / E / R** góc dưới bên phải — nhân vật sẽ **tự ngắm vào địch gần nhất** khi ra chiêu, không cần điều khiển chuột.
- Xoay ngang điện thoại (landscape) sẽ nhìn thấy đấu trường rõ hơn.

## 6. Hình ảnh & hiệu ứng nhân vật

- Cả 2 nhân vật đều là **đòn cận chiến**: Hắc Ảnh đâm dao nhanh tầm gần, Độc Hành Kiếm Khách chém kiếm tầm gần.
- Hình nhân vật là **vector gốc do mình vẽ trực tiếp bằng SVG** trong `game.js` (biến `SVG_HACANH`, `SVG_DOCLINH`) — muốn đổi tạo hình chỉ cần sửa đoạn SVG đó.
- Khi tấn công, nhân vật có hoạt ảnh vung vũ khí (lao nhẹ về phía trước + vệt chém trắng), khi bị trúng đòn có hiệu ứng tia lửa đỏ bắn ra, và luôn có hoạt ảnh nhấp nhô nhẹ khi đứng/di chuyển.

## 7. Có thể mở rộng thêm

- Thêm nhân vật mới: chỉ cần thêm entry vào `CHAR_DEFS` trong `game.js` và 1 thẻ `.char-card` trong `index.html`.
- Thêm âm thanh: dùng thẻ `<audio>` hoặc Web Audio API khi trúng đòn / hạ gục.
- Thêm bản đồ chướng ngại vật: vẽ thêm hình trong hàm `render()` và kiểm tra va chạm trong `updateMovement()`.
- Bảo mật hơn: thêm Firebase Anonymous Auth để mỗi người chơi có UID xác thực, và viết Realtime Database Rules chặt chẽ theo UID thay vì mở toàn bộ.
