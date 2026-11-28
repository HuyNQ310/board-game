# Mèo Nổ — Docker Deployment Guide / Hướng dẫn triển khai Docker

Concise bilingual guide for building, running, backing up SQLite persistence, and configuring HTTPS + `PUBLIC_URL` for **Mèo Nổ** (Exploding Kittens).

---

## 1. Quick Start / Khởi chạy nhanh

### English
1. Optionally create a `.env` file from `.env.example` and adjust `PORT`, `PUBLIC_URL`, or `DISCONNECT_GRACE_MS`:
   ```bash
   cp .env.example .env
   ```
2. Build and start the container in the background:
   ```bash
   docker compose up -d --build
   ```
3. Inspect logs and container health:
   ```bash
   docker compose logs -f
   docker compose ps
   ```
4. Open `http://localhost:3000` (or your configured `PORT`). Health check endpoint: `GET /healthz`.
5. Stop the stack (keeps SQLite data intact in the named volume):
   ```bash
   docker compose down
   ```

### Tiếng Việt
1. (Tuỳ chọn) Tạo file `.env` từ `.env.example` và chỉnh `PORT`, `PUBLIC_URL`, hoặc `DISCONNECT_GRACE_MS`:
   ```bash
   cp .env.example .env
   ```
2. Build image và chạy container ở chế độ nền:
   ```bash
   docker compose up -d --build
   ```
3. Theo dõi log và trạng thái healthcheck:
   ```bash
   docker compose logs -f
   docker compose ps
   ```
4. Truy cập `http://localhost:3000` (hoặc cổng `PORT` bạn đã cấu hình). Endpoint kiểm tra sức khỏe: `GET /healthz`.
5. Dừng container (dữ liệu SQLite trong volume vẫn được giữ nguyên):
   ```bash
   docker compose down
   ```

---

## 2. Persistent SQLite Volume & Backups / Lưu trữ & sao lưu SQLite

- **Database file / Tệp cơ sở dữ liệu**: `/app/data/meo-no.sqlite` (configured via `DB_PATH`, stored using Node 24 built-in `node:sqlite` in WAL mode).
- **Named Docker volume**: `meo_no_data` mounted to `/app/data` (owned by non-root user `node:node`).
- **Important / Lưu ý**: Do **not** run `docker compose down -v` unless you intentionally want to delete all user accounts, sessions, preferences, and match history.

### Backup / Sao lưu

Because SQLite runs with `PRAGMA journal_mode = WAL`, recent writes may sit in `meo-no.sqlite-wal` and `meo-no.sqlite-shm`. Choose one of these safe methods:

1. **Consistent cold backup (recommended / khuyên dùng):**
   ```bash
   docker compose stop app
   docker run --rm \
     -v "$(basename "$(pwd)")_meo_no_data:/data:ro" \
     -v "$(pwd)/backups:/backup" \
     alpine tar czf "/backup/meo-no-data-$(date +%Y%m%d-%H%M%S).tar.gz" -C /data .
   docker compose start app
   ```
   *(If you run outside the project folder or use a custom Compose project name, verify the exact volume name with `docker volume ls`.)*

2. **Copy database files directly / Sao chép trực tiếp file từ container đang dừng:**
   ```bash
   mkdir -p backups
   docker compose stop app
   docker compose cp app:/app/data/. ./backups/meo-no-data/
   docker compose start app
   ```

### Restore / Khôi phục

```bash
docker compose stop app
docker run --rm \
  -v "$(basename "$(pwd)")_meo_no_data:/data" \
  -v "$(pwd)/backups:/backup:ro" \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/<your-backup-file>.tar.gz -C /data && chown -R 1000:1000 /data"
docker compose start app
```

---

## 3. SEO & `PUBLIC_URL` Configuration / Cấu hình `PUBLIC_URL` cho SEO

Set `PUBLIC_URL` in `.env` to your public HTTPS origin (without a trailing slash):

```env
PUBLIC_URL=https://meono.example.com
```

- **English**: Use your real canonical domain so Open Graph links, canonical URLs, and shared room links match your deployed origin.
- **Tiếng Việt**: Đặt đúng domain HTTPS công khai (không có dấu `/` ở cuối) để thẻ SEO, Open Graph, và liên kết chia sẻ phòng khớp với tên miền thực tế.

---

## 4. HTTPS Reverse Proxy for WebRTC Mic (`getUserMedia`) / Reverse Proxy HTTPS cho Mic WebRTC

Browsers only allow `navigator.mediaDevices.getUserMedia()` (used by Mèo Nổ's WebRTC voice chat) in **secure contexts** (`https://` or `http://localhost`). When deploying on a VPS/server with a domain or LAN IP, terminate TLS in front of the container and forward WebSocket upgrades for Socket.IO (`/socket.io/`).

Trình duyệt chỉ cho phép bật micro (`getUserMedia`) trong ngữ cảnh bảo mật (`https://` hoặc `http://localhost`). Khi triển khai lên server/domain thật, hãy đặt reverse proxy HTTPS phía trước và bật chuyển tiếp WebSocket cho Socket.IO.

### Example: Caddy (`Caddyfile`)
Caddy automatically provisions Let's Encrypt HTTPS and proxies WebSockets out of the box:

```caddyfile
meono.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

### Example: Nginx
```nginx
server {
    listen 443 ssl http2;
    server_name meono.example.com;

    ssl_certificate     /etc/letsencrypt/live/meono.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/meono.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```
