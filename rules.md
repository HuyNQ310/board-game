# Mèo Nổ — Đặc tả v1 (đầy đủ để triển khai)

> Đây là nguồn chân lý duy nhất cho agent. Nếu code và spec mâu thuẫn, sửa code theo spec. Nếu spec thiếu, dừng và ghi vào `OPEN_[QUESTIONS.md](http://QUESTIONS.md)`, không tự quyết. File này độc lập: không đi kèm mã nguồn nào. Mọi thứ, kể cả engine luật chơi, được viết lại từ đầu theo đặc tả này. Tên làm việc: "Mèo Nổ". Thẻ, tên lá và minh họa phải thiết kế riêng, không sao chép từ game thương mại.

---

## 0. Mục tiêu v1 (Definition of Done)

Một nhóm 4 người vào phòng bằng mã trên điện thoại, chơi trọn một ván đến khi có người thắng, một người rớt mạng giữa chừng rồi quay lại và ván tiếp tục đúng, không có lỗi nào làm treo ván. Sau đó bấm "Chơi lại" và chơi ván thứ hai.

Ngoài phạm vi v1: credit, giới hạn lượt theo ngày, quảng cáo, thanh toán, tài khoản, bạn bè, bảng xếp hạng, lưu lịch sử dài hạn, ứng dụng gốc iOS/Android, bot, chat, hẹn giờ mỗi lượt.

---

## 1. Quyết định đã chốt


| #   | Vấn đề                  | Quyết định                                                                                                                                               |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Số lá chia ban đầu      | **5 lá**: 1 gỡ bom + 4 lá thường.                                                                                                                        |
| D2  | Favor và cat lấy lá     | **Ngẫu nhiên**, người bị lấy không chọn. Không thêm pha chọn lá trong v1.                                                                                |
| D3  | Hẹn giờ lượt            | **Không có** trong v1. Lượt chờ vô hạn cho tới khi người chơi hành động hoặc bị loại do mất kết nối.                                                     |
| D4  | Nguồn sự kiện cho UI    | Engine **ghi nhật ký công khai** vào `state.log`. Client render từ log, không tự suy luận.                                                               |
| D5  | Chuyển host             | Khi host rời phòng, người vào phòng sớm nhất còn lại trở thành host.                                                                                     |
| D6  | Vào phòng đang chơi     | **Từ chối** với `ROOM_PLAYING`. Khi phòng ở trạng thái `finished`, người mới vào được và sẽ ở lobby khi chơi lại.                                        |
| D7  | Mất kết nối trong lobby | Giữ chỗ 120 giây. Hết giờ thì xóa khỏi phòng.                                                                                                            |
| D8  | Mất kết nối trong ván   | Giữ chỗ 120 giây, lượt của họ chờ. Hết giờ thì bị loại (xem mục 5.4).                                                                                    |
| D9  | Tên trùng               | Cho phép. Giao diện phân biệt bằng số ghế.                                                                                                               |
| D10 | Chơi lại                | Chỉ host bấm. Giữ những người đang kết nối, xóa người offline, về lobby. Thứ tự ghế giữ nguyên.                                                          |
| D11 | Đồng thời               | Mỗi phòng có một hàng đợi xử lý tuần tự. Mỗi hành động là nguyên tử.                                                                                     |
| D12 | Tốc độ                  | Tối đa 10 sự kiện/giây cho mỗi socket. Vượt thì trả `RATE_LIMIT`.                                                                                        |
| D13 | Dọn phòng               | Phòng không còn kết nối nào trong 10 phút thì xóa. Kiểm tra mỗi 60 giây.                                                                                 |
| D14 | Xác thực                | Không có tài khoản. `playerId` (UUID) lưu trong `localStorage` để giữ chỗ. Chấp nhận rủi ro giả mạo ở v1, ghi vào [`DECISIONS.md`](http://DECISIONS.md). |
| D15 | Triển khai              | Một tiến trình Node phục vụ cả API/socket và file tĩnh đã build, cổng `PORT` (mặc định 3000). HTTPS do reverse proxy đảm nhận khi triển khai.            |


---

## 2. Yêu cầu engine (Phase 0, viết từ đầu)

Engine được viết mới theo đặc tả này. Phải export đúng các API sau, và mỗi yêu cầu dưới đây có test riêng:

- `CARD`: object đóng băng với các giá trị `boom`, `defuse`, `attack`, `skip`, `shuffle`, `favor`, `peek`, `cat`.
- `GameError`: lớp lỗi cho mọi vi phạm luật.
- `createGame(playerIds, rng)`
- `applyAction(state, playerId, action, rng)`
- `eliminatePlayer(state, playerId, reason, rng)`
- `viewFor(state, playerId)`

`rng` là hàm trả về số trong [0, 1). Mặc định là `Math.random`.

**E1. Phiên bản.** Mỗi `applyAction` thành công tăng `state.version` lên 1. `createGame` đặt `version: 0`.

**E2. Nhật ký công khai.** `state.log` là mảng các sự kiện theo thứ tự. Mỗi sự kiện là một trong các dạng sau (không bao giờ chứa tên lá, trừ khi là lá đã lộ công khai):


| `type`            | Các trường                                | Khi nào                              |
| ----------------- | ----------------------------------------- | ------------------------------------ |
| `draw`            | `actor`                                   | Rút lá thường vào tay                |
| `bomb_drawn`      | `actor`                                   | Rút phải bom                         |
| `defused`         | `actor`                                   | Gỡ bom xong (không kèm vị trí)       |
| `eliminated`      | `actor`, `reason` (`bomb` | `disconnect`) | Người chơi bị loại                   |
| `skip`            | `actor`                                   | Đánh skip                            |
| `attack`          | `actor`, `target` (id người kế tiếp)      | Đánh attack                          |
| `shuffle`         | `actor`                                   | Đánh xáo bài                         |
| `peek`            | `actor`                                   | Đánh nhìn trước (không kèm nội dung) |
| `favor`           | `actor`, `target`                         | Đánh nhờ vả (không kèm lá đã lấy)    |
| `cat`             | `actor`, `target`                         | Chơi cặp mèo (không kèm lá đã lấy)   |
| `deck_reshuffled` | —                                         | Xáo lại phần bỏ đi vì hết bộ rút     |
| `game_over`       | `winnerId` (hoặc `null` nếu hòa)          | Ván kết thúc                         |


Actor và target đều là `playerId`, không phải chỉ số.

**E3. Loại người chơi.** `eliminatePlayer(state, playerId, reason, rng)`:

- Đặt `alive = false`, bỏ hết bài trên tay vào bài đã đánh, ghi sự kiện `eliminated`.
- Nếu người đó đang là người có lượt, chuyển lượt sang người sống kế tiếp và đặt `turnsLeft = 1`.
- Nếu còn đúng một người sống thì kết thúc ván như mục 4 luật.
- Nếu đang ở pha `defuse` và người bị loại là `pendingDefuse`, hủy pha đó rồi xử lý như trên.

**E4. Hình dạng** `viewFor(state, playerId)`**.** Trả về đúng cấu trúc ở mục 6.6. Không được trả về chỉ số mảng (`current`, `pendingDefuse`, `winner`) mà phải dùng id.

**E5. Thuần.** Mọi hàm: không đổi tham số đầu vào, không dùng biến toàn cục, không dùng `Date` hay `Math.random` trực tiếp (chỉ qua `rng` truyền vào).

**Test bắt buộc cho Phase 0:** mọi luật ở mục 4 có test; test cho E1–E5; test `viewFor` không lộ bài người khác, không lộ nội dung `deck`, không lộ nội dung `peek` của người khác.

---

## 3. Công nghệ và phiên bản


| Hạng mục                  | Chọn                                                                             | Ghi chú                                                 |
| ------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Runtime                   | Node.js 20 LTS                                                                   | `"engines": {"node": ">=20"}`                           |
| Module                    | ES modules (`.mjs` cho shared và server, `.js/.jsx` cho client)                  |                                                         |
| Server                    | `express` 4.x, [`socket.io`](http://socket.io) 4.x                               | Chỉ dùng Express để phục vụ file tĩnh và `GET /healthz` |
| Client                    | `react` 18, `react-dom` 18, `vite` 5, `[socket.io](http://socket.io)-client` 4.x |                                                         |
| Kiểm thử engine và server | `node:test` + `node:assert/strict`                                               | Không cài Jest                                          |
| Kiểm thử client           | `vitest` + `@testing-library/react` + `jsdom`                                    |                                                         |
| E2E                       | `@playwright/test`                                                               | Phase 5                                                 |
| Lint/format               | `eslint` (flat config) + `prettier`                                              |                                                         |


Không dùng: TypeScript, Next.js, Redux, ORM, cơ sở dữ liệu, UI framework (Material, Chakra...), thư viện animation ngoài CSS.

Phiên bản chính xác ghi trong `package-lock.json`. Thêm thư viện mới phải ghi vào [`DECISIONS.md`](http://DECISIONS.md) kèm lý do.

---

## 4. Luật chơi

Đây là định nghĩa luật. Engine phải tuân theo đúng. Nếu luật thay đổi thì sửa đặc tả trước, rồi mới sửa engine và test.

### 4.1 Bộ bài


| Lá        | Số lượng                 | Tác dụng                                                                    |
| --------- | ------------------------ | --------------------------------------------------------------------------- |
| `boom`    | n − 1                    | Rút phải là bị loại, trừ khi có gỡ bom                                      |
| `defuse`  | 2 + n (tổng cả chia tay) | Cứu mạng khi rút phải bom. Không đánh riêng được                            |
| `attack`  | 4                        | Kết thúc lượt không rút; người kế tiếp chơi 2 lượt                          |
| `skip`    | 4                        | Kết thúc lượt không rút                                                     |
| `shuffle` | 4                        | Xáo bộ rút; lượt tiếp tục                                                   |
| `favor`   | 4                        | Lấy ngẫu nhiên 1 lá của người khác; lượt tiếp tục                           |
| `peek`    | 5                        | Xem 3 lá trên cùng; lượt tiếp tục                                           |
| `cat`     | 8                        | Chơi đúng 2 lá cùng lúc, chọn một người, lấy ngẫu nhiên 1 lá; lượt tiếp tục |


Tổng gỡ bom = 1 mỗi người (trên tay) + 2 (trong bộ rút). Số bom trong bộ rút = n − 1.

### 4.2 Chia bài

- Mỗi người: 1 `defuse` + 4 lá lấy từ phần bài thường (không tính bom và gỡ bom), lấy ngẫu nhiên.
- Bộ rút = phần thường còn lại + (n − 1) `boom` + 2 `defuse`, xáo kỹ.
- Chia cho n từ 2 đến 10. Với n <= 6, dùng đúng 29 lá bài thường gốc. Với n > 6, số lượng mỗi loại lá thường (attack, skip, shuffle, favor, peek, cat) được nhân tỉ lệ theo n/6 (làm tròn lên; cat luôn làm tròn lên số chẵn) để đủ chia 4 lá thường/người và còn dư cho bộ rút.

### 4.3 Lượt chơi

- Người có lượt có thể đánh nhiều lá không rút (`skip`, `attack`, `shuffle`, `peek`, `favor`, `cat`) và có thể đánh nhiều lá trước khi kết thúc lượt.
- Lượt kết thúc bằng một trong các cách:
  - `draw`: rút 1 lá. Nếu là lá thường thì vào tay, lượt kết thúc.
  - `skip`: không rút, lượt kết thúc.
  - `attack`: không rút, lượt kết thúc, người kế tiếp chơi `2 + (số lượt còn lại của người đánh − 1)` lượt.
- `shuffle`, `peek`, `favor`, `cat` không kết thúc lượt.

### 4.4 Rút phải bom

- Không có `defuse` trên tay: bị loại (`eliminated`, `reason: bomb`). Bài trên tay vào bài đã đánh. Nếu còn 1 người sống thì ván kết thúc.
- Có `defuse`: vào pha `defuse`. Người đó phải gửi `defuse` với `insertAt` (số nguyên từ 0 đến số lá trong bộ rút). `0` là đặt trên cùng, số lớn hơn là sâu hơn; giá trị ngoài khoảng được kẹp về biên. Lá `defuse` bị bỏ vào bài đã đánh. Lượt kết thúc.

### 4.5 Ràng buộc

- `defuse` và `boom` không được đánh như lá thường.
- `cat` phải đúng 2 lá (trong v1 chỉ có một loại mèo nên hai lá bất kỳ đều hợp lệ).
- Không được nhắm chính mình hoặc người đã bị loại.
- Khi rút mà bộ rút trống: xáo bài đã đánh thành bộ rút mới, ghi `deck_reshuffled`. Nếu cả hai đều trống thì ván kết thúc không có người thắng (`game_over` với `winnerId: null`).

### 4.6 Kết thúc

Còn đúng 1 người sống: người đó thắng, `phase = 'over'`, ghi `game_over`.

---

## 5. Phòng, người chơi, vòng đời

### 5.1 Phòng

- Mã phòng: 5 ký tự từ bảng `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (bỏ 0, O, 1, I, L). Sinh ngẫu nhiên, kiểm tra trùng.
- Thuộc tính: `code`, `hostId`, `status` (`lobby` | `playing` | `finished`), `players` (theo thứ tự vào phòng), `game` (state engine, `null` khi ở lobby), `createdAt`, `lastActiveAt`.
- Tối đa 10 người. Người thứ 11 nhận `ROOM_FULL`.

### 5.2 Người chơi

- `playerId`: UUID v4, sinh ở client, lưu `localStorage["meo-no:playerId"]`.
- `name`: sau khi `trim()` còn 1–16 ký tự. Không cần duy nhất.
- Mỗi người có `connected` (boolean) và `joinedAt`.

### 5.3 Vòng đời

```
Home ──(tạo / vào phòng)──> Lobby ──(host bắt đầu, ≥2 người đang kết nối)──> Playing
                              ▲                                                   │
                              └────────(host chơi lại)──── Finished <─(có người thắng / hòa)

```

- `Lobby`: có thể vào, rời, đổi tên không (v1 không cho đổi tên).
- `Playing`: không vào mới. Người rời thì giữ chỗ theo D8.
- `Finished`: người mới vào được và sẽ ở lobby khi chơi lại. Người đang trong phòng vẫn xem được kết quả.

### 5.4 Mất kết nối

- Khi socket của một người ngắt, đánh dấu `connected = false` và bắt đầu đếm 120 giây.
- Nếu họ kết nối lại trong 120 giây (qua `room:resume`), hủy đếm.
- Hết 120 giây:
  - Ở `lobby` hoặc `finished`: xóa khỏi phòng. Nếu là host thì chuyển host theo D5.
  - Ở `playing`: gọi `eliminatePlayer(state, id, 'disconnect')`. Nếu họ là người có lượt, lượt chuyển tiếp ngay (không chờ thêm).
- Không đếm giờ cho người đã bị loại hoặc đã bị xóa.

### 5.5 Host

- Người vào phòng đầu tiên là host. Host rời thì chuyển cho người vào sớm nhất còn lại (theo `joinedAt`).
- Chỉ host được `game:start` và `room:rematch`.

### 5.6 Bắt đầu ván

- Chỉ từ `lobby`, cần ít nhất 2 người đang `connected`. Người offline bị xóa trước khi bắt đầu.
- Tạo state bằng `createGame` với các id theo thứ tự ghế hiện tại. Đặt `status = 'playing'`.

### 5.7 Chơi lại

- Chỉ từ `finished`, chỉ host. Xóa người offline, đặt `game = null`, `status = 'lobby'`, giữ thứ tự ghế.
- Nếu sau khi xóa còn dưới 2 người, vẫn ở lobby và hiện thông báo cần thêm người.

### 5.8 Kết nối lại trình duyệt

- Khi tải trang, client đọc `localStorage` (`playerId`, `roomCode`). Nếu có, gửi `room:resume`.
- Server gắn socket mới vào người chơi đó. Nếu socket cũ còn mở, gửi `session:replaced` cho socket cũ rồi ngắt nó.
- Nếu phòng không còn hoặc người chơi không còn trong phòng: trả `ROOM_NOT_FOUND` hoặc `NOT_IN_ROOM`, client xóa `roomCode` và về Home.

---

## 6. Hợp đồng dữ liệu

### 6.1 Ack chung

Mọi sự kiện client gửi đều nhận ack một lần với một trong hai dạng:

```json
{ "ok": true, "...": "dữ liệu thêm tùy sự kiện" }
{ "ok": false, "code": "NOT_YOUR_TURN", "message": "Chưa đến lượt bạn" }

```

### 6.2 Mã lỗi và thông báo tiếng Việt


| code               | message                                     |
| ------------------ | ------------------------------------------- |
| `NAME_INVALID`     | Tên phải từ 1 đến 16 ký tự                  |
| `ROOM_NOT_FOUND`   | Không tìm thấy phòng                        |
| `ROOM_FULL`        | Phòng đã đủ 10 người                        |
| `ROOM_PLAYING`     | Phòng đang chơi, không thể vào lúc này      |
| `NOT_IN_ROOM`      | Bạn không còn trong phòng này               |
| `NOT_HOST`         | Chỉ chủ phòng mới làm được việc này         |
| `NEED_TWO_PLAYERS` | Cần ít nhất 2 người đang kết nối để bắt đầu |
| `NOT_YOUR_TURN`    | Chưa đến lượt bạn                           |
| `DEFUSE_PENDING`   | Bạn đang phải gỡ bom                        |
| `NO_CARD`          | Không có lá này trong tay                   |
| `INVALID_CARD`     | Lá này không thể đánh riêng                 |
| `INVALID_TARGET`   | Mục tiêu không hợp lệ                       |
| `INVALID_ACTION`   | Hành động không hợp lệ                      |
| `GAME_OVER`        | Ván đã kết thúc                             |
| `RATE_LIMIT`       | Thao tác quá nhanh, thử lại sau chút        |
| `SERVER_ERROR`     | Có lỗi xảy ra, vui lòng thử lại             |


Mọi lỗi từ engine (`GameError`) map sang `INVALID_ACTION` nếu không khớp mã cụ thể hơn.

### 6.3 Client → Server


| Sự kiện        | Payload                               | Ack thêm                                    |
| -------------- | ------------------------------------- | ------------------------------------------- |
| `room:create`  | `{ playerId, name }`                  | `{ code }`                                  |
| `room:join`    | `{ playerId, name, code }`            | `{ code }`                                  |
| `room:resume`  | `{ playerId, code }`                  | `{ code, room, game }` (game có thể `null`) |
| `room:leave`   | `{}`                                  | `{}`                                        |
| `game:start`   | `{}`                                  | `{}`                                        |
| `game:action`  | `{ type, card?, target?, insertAt? }` | `{}`                                        |
| `room:rematch` | `{}`                                  | `{}`                                        |


`game:action` ánh xạ trực tiếp sang `applyAction`:

- `{ type: "draw" }`
- `{ type: "play", card: "skip"|"attack"|"shuffle"|"peek"|"favor", target? }` (`target` bắt buộc với `favor`)
- `{ type: "catPair", target }`
- `{ type: "defuse", insertAt }`

Engine nhận `target` là `playerId`, không nhận chỉ số.

### 6.4 Server → Client


| Sự kiện            | Gửi cho               | Payload                         |
| ------------------ | --------------------- | ------------------------------- |
| `room:state`       | mọi người trong phòng | xem 6.5                         |
| `game:state`       | từng người, riêng     | xem 6.6 (`viewFor` + `version`) |
| `game:error`       | một người             | `{ code, message }`             |
| `session:replaced` | socket cũ             | `{}`                            |


### 6.5 `room:state`

```json
{
  "code": "K7M2Q",
  "hostId": "f3b1…",
  "status": "lobby",
  "players": [
    { "id": "f3b1…", "name": "An", "connected": true, "seat": 0 },
    { "id": "9c02…", "name": "Bình", "connected": false, "seat": 1 }
  ]
}

```

### 6.6 `game:state`

Đây là `viewFor(state, playerId)` của engine, cộng với `version`. Ví dụ với người xem là An (đang đến lượt An, có 2 người):

```json
{
  "version": 14,
  "phase": "play",
  "currentPlayerId": "f3b1…",
  "turnsLeft": 1,
  "pendingDefuseId": null,
  "winnerId": null,
  "deckCount": 17,
  "discardCount": 6,
  "discardTop": "attack",
  "players": [
    { "id": "f3b1…", "name": "An", "alive": true, "handCount": 3, "hand": ["defuse", "skip", "cat"] },
    { "id": "9c02…", "name": "Bình", "alive": true, "handCount": 5 }
  ],
  "peek": null,
  "log": [
    { "type": "draw", "actor": "9c02…" },
    { "type": "attack", "actor": "9c02…", "target": "f3b1…" }
  ]
}

```

- `hand` chỉ có ở người xem. Người khác chỉ có `handCount`.
- `peek` là mảng 3 lá khi người xem vừa đánh `peek` và chưa làm hành động tiếp theo, ngược lại `null`.
- `discardTop` là lá trên cùng của bài đã đánh, `null` nếu trống.
- `log` là toàn bộ nhật ký từ đầu ván (mục E2).
- Không có `deck`, không có bài người khác.

### 6.7 Thứ tự và đồng bộ

- Mỗi `game:state` có `version` tăng dần. Client bỏ qua bản có `version` nhỏ hơn bản đang giữ.
- Sau mỗi hành động thành công, server gửi `game:state` cho từng người trong phòng.
- Sau `room:resume`, server gửi `game:state` cho người đó ngay cả khi không đổi.

---

## 7. Xử lý phía server

### 7.1 Hàng đợi theo phòng

Mỗi phòng có một hàng đợi (promise chain). Mọi thao tác thay đổi phòng (join, leave, start, action, rematch, timeout mất kết nối, dọn phòng) đều đi qua hàng đợi này. Không thao tác nào đọc rồi ghi bên ngoài hàng đợi.

### 7.2 Giới hạn tốc độ

Đếm sự kiện theo socket trong cửa sổ 1 giây. Vượt 10 sự kiện thì trả `RATE_LIMIT`, không xử lý. Sự kiện `room:resume` không bị tính.

### 7.3 Xử lý lỗi

- `GameError` từ engine: trả `game:error` cho người gửi, không đổi state.
- Lỗi khác: ghi log có `roomCode`, `event`, trả `SERVER_ERROR`, không làm sập tiến trình.

### 7.4 Dọn dẹp

Mỗi 60 giây: xóa phòng không có kết nối nào và `lastActiveAt` cách hiện tại hơn 10 phút. Hủy mọi bộ đếm 120 giây của phòng đó.

### 7.5 Endpoint phụ

- `GET /healthz` → `{ "ok": true, "rooms": <số phòng> }`.
- Mọi đường dẫn khác không phải `/[socket.io](http://socket.io)` trả về file tĩnh từ `client/dist`, với fallback `index.html`.

---

## 8. Giao diện

### 8.1 Nguyên tắc

- Mobile trước: thiết kế cho 360px, mở rộng lên 1440px.
- Toàn bộ chuỗi hiển thị nằm trong `client/src/i18n/vi.js`. Không viết tiếng Việt cứng trong component.
- Mọi nút tối thiểu 44×44px. Mọi nút chỉ có biểu tượng có `aria-label`.
- Trạng thái không chỉ dựa vào màu: luôn có chữ hoặc biểu tượng kèm theo.
- Hiệu ứng dưới 300ms. Tôn trọng `prefers-reduced-motion`.
- Không dùng thư viện UI.

### 8.2 Màn hình và trạng thái

**Home**

- Ô tên (bắt buộc), nút "Tạo phòng", ô mã (5 ký tự, tự chuyển in hoa) và nút "Vào phòng".
- Đang có `roomCode` trong `localStorage`: tự gửi `room:resume` khi tải trang, hiện "Đang vào lại phòng…".

**Lobby**

- Mã phòng lớn, nút sao chép, nút chia sẻ (Web Share nếu có, nếu không thì sao chép).
- Danh sách người chơi theo ghế: tên, nhãn "Chủ phòng", nhãn "Đang offline".
- Host: nút "Bắt đầu" (tắt và hiện lý do nếu chưa đủ 2 người đang kết nối).
- Không phải host: "Đang chờ chủ phòng bắt đầu".
- Nút "Rời phòng".

**Game**

- Vùng ghế người chơi: mỗi ghế có tên, số lá trên tay, nhãn "Đến lượt" khi `currentPlayerId`, nhãn "Đã bị loại", nhãn "Offline". Ghế của mình ở dưới.
- Vùng giữa:
  - Bộ rút: hiện số lá (`deckCount`), không lật.
  - Bài đã đánh: lá trên cùng (`discardTop`) và số lượng (`discardCount`).
  - Nếu `turnsLeft > 1`: nhãn "Còn N lượt".
- Vùng tay bài: lá của mình, cuộn ngang nếu nhiều. Lá không đánh được thì mờ.
- Thanh hành động:
  - "Rút bài" (nổi bật, chỉ bật khi đến lượt và `phase === 'play'`).
  - "Bỏ qua" (skip) và "Tấn công" (attack): hiện khi có lá tương ứng và đến lượt.
  - "Nhờ vả" và "Chơi cặp mèo": hiện khi có lá tương ứng. Cặp mèo cần đủ 2 lá.
  - "Nhìn trước" (peek), "Xáo bài" (shuffle): hiện khi có lá tương ứng.
- Nhật ký: danh sách từ `log`, hiển thị dòng tiếng Việt từ template, cuộn xuống dòng mới nhất.
- Nếu `status` là `finished`: chuyển sang màn kết quả.

**Hộp thoại chọn mục tiêu** (`TargetPicker`)

- Dùng cho `favor` và `catPair`. Liệt kê người còn sống, trừ mình. Có nút hủy.

**Hộp thoại gỡ bom** (`DefuseDialog`)

- Hiện khi `phase === 'defuse'` và `pendingDefuseId === mình`.
- Có thanh trượt chọn vị trí 0 đến `deckCount` (nhãn: "Trên cùng" ở 0, "Sâu nhất" ở max).
- Không có nút đóng. Chỉ có nút "Đặt bom" gửi `defuse` với `insertAt`.
- Người khác thấy trạng thái "Người X đang gỡ bom…", không thấy thanh trượt.

**Nhìn trước** (`PeekPanel`)

- Khi `peek` không null: hiện 3 lá theo thứ tự từ trên xuống. Chỉ hiện cho mình. Ẩn khi `peek` về null (sau hành động tiếp theo của mình).

**Bị loại**

- Vẫn xem được bàn chơi. Tay bài ẩn, các nút hành động tắt, có banner "Bạn đã bị loại. Bạn đang xem".

**Mất kết nối**

- Banner trên cùng: "Đang kết nối lại…". Khóa mọi nút hành động.
- Khi socket nối lại, gửi `room:resume` và cập nhật state.

**Kết thúc ván**

- Tên người thắng, hoặc "Không ai thắng" nếu hòa.
- Nút "Chơi lại" (host), nút "Rời phòng".
- Người không phải host thấy "Đang chờ chủ phòng chơi lại".

### 8.3 Thông báo

- Lỗi từ server: `Toast` ở đầu màn hình, tự tắt sau 3 giây, không chặn thao tác.
- Toast dùng `role="status"` và `aria-live="polite"`.

### 8.4 Điều hướng bàn phím (máy tính)

Tab theo thứ tự: thanh hành động, tay bài, nhật ký. Enter kích hoạt nút. Esc đóng hộp thoại (trừ hộp thoại gỡ bom).

---

## 9. Cấu trúc thư mục

```
meo-no/
├── SPEC.md
├── DECISIONS.md          ← ghi quyết định kỹ thuật phát sinh
├── OPEN_QUESTIONS.md     ← câu hỏi chưa có đáp án
├── CHANGELOG.md          ← mỗi phase một mục
├── package.json          ← workspaces: shared, server, client; scripts: test, dev, build, start, lint
├── eslint.config.js
├── .prettierrc
├── shared/
│   ├── package.json
│   ├── engine.mjs         ← viết mới, Phase 0
│   └── engine.test.mjs
├── server/
│   ├── package.json
│   ├── index.mjs         ← khởi động Express, Socket.IO, static
│   ├── rooms.mjs         ← model phòng, mã phòng, hàng đợi, dọn dẹp
│   ├── timers.mjs        ← bộ đếm 120 giây mất kết nối
│   ├── handlers.mjs      ← đăng ký sự kiện socket, giới hạn tốc độ, ack
│   ├── errors.mjs        ← bảng mã lỗi
│   ├── rooms.test.mjs
│   └── handlers.test.mjs
└── client/
    ├── package.json
    ├── vite.config.js    ← proxy /socket.io sang http://localhost:3000 khi dev
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx        ← chọn màn hình theo trạng thái
        ├── net/socket.js  ← tạo socket, emit có Promise, xử lý nối lại
        ├── state/store.js ← useReducer + context; version guard
        ├── i18n/vi.js     ← toàn bộ chuỗi tiếng Việt và template nhật ký
        ├── screens/Home.jsx
        ├── screens/Lobby.jsx
        ├── screens/Game.jsx
        ├── screens/GameOver.jsx
        ├── components/Card.jsx
        ├── components/Hand.jsx
        ├── components/SeatRing.jsx
        ├── components/DrawPile.jsx
        ├── components/DiscardPile.jsx
        ├── components/ActionBar.jsx
        ├── components/TargetPicker.jsx
        ├── components/DefuseDialog.jsx
        ├── components/PeekPanel.jsx
        ├── components/LogPanel.jsx
        ├── components/Toast.jsx
        └── styles/

```

`shared/` chỉ được chứa logic thuần. Không import Express, [Socket.IO](http://Socket.IO), React hay DOM.

### 9.1 Lệnh

- `npm test`: chạy test của shared, server, client.
- `npm run dev`: chạy server ở 3000 và Vite ở 5173 song song.
- `npm run build`: build client vào `client/dist`.
- `npm start`: chạy server đã build, phục vụ cả client, cổng `PORT` hoặc 3000.
- `npm run lint`: ESLint trên toàn bộ.

---

## 10. Phi chức năng

- **Bảo mật**: server là nguồn sự thật. Không gửi bài người khác, không gửi nội dung `deck`. Kiểm tra `playerId` của socket khớp người trong phòng trước mọi hành động. Không log tên người chơi ở mức debug trong production.
- **Độ bền**: lỗi trong một phòng không ảnh hưởng phòng khác. Tiến trình không thoát khi có lỗi không bắt được (`process.on('unhandledRejection')` ghi log và tiếp tục).
- **Hiệu năng**: 100 phòng đồng thời trên một tiến trình, không quá 300ms từ hành động đến khi các máy khác nhận được `game:state` trong điều kiện mạng bình thường.
- **Khả năng truy cập**: theo mục 8.
- **Trình duyệt**: Chrome, Edge, Firefox (máy tính); Safari iOS 16+, Chrome Android (điện thoại).
- **Kích thước**: bản build client dưới 300 KB gzip.

---

## 11. Kiểm thử và tiêu chí hoàn thành từng phase

### Phase 0 — Engine hoàn chỉnh

- Viết engine theo mục 2 và mục 4, kèm test.
- Test: mọi luật mục 4 có ít nhất một test; `viewFor` không lộ bài người khác, không lộ `deck`, không lộ `peek` của người khác; log đúng thứ tự và đúng dạng mục 2.
- Xong khi: `node --test shared/` pass.

### Phase 1 — Khung dự án và server phòng

- Thiết lập workspaces, ESLint, Prettier, các script mục 9.1.
- Server: `rooms.mjs` (mã phòng, hàng đợi, vào/rời, host, dọn dẹp), `timers.mjs`, `handlers.mjs` (mục 6.3–6.4), giới hạn tốc độ, ack.
- Test: tạo, vào, phòng đầy, vào phòng đang chơi, chuyển host, mất kết nối trong lobby và trong ván (dùng fake timer), resume, chơi lại, từ chối người không thuộc phòng, `game:state` không chứa bài người khác, giới hạn tốc độ.
- Xong khi: `npm test` pass cho shared và server; `npm run dev` chạy được; `GET /healthz` trả đúng.

### Phase 2 — Home và Lobby

- Màn hình Home và Lobby theo mục 8.2, store, socket client, lưu `playerId`.
- Test UI: nút "Bắt đầu" chỉ hiện cho host và bật đúng điều kiện; sao chép mã; resume khi tải lại trang.
- Xong khi: hai tab khác trình duyệt vào cùng phòng và thấy nhau; host bắt đầu được ván (chuyển sang Game với state rỗng là chấp nhận ở phase này).

### Phase 3 — Bàn chơi

- `Game.jsx` và các component mục 8.2–8.3, `i18n/vi.js` cho toàn bộ nhật ký.
- Test UI: nút "Rút bài" chỉ bật khi đến lượt; `DefuseDialog` không đóng được khi chưa đặt bom; `TargetPicker` không liệt kê mình hoặc người đã loại; `PeekPanel` chỉ hiện cho người đánh.
- Xong khi: 4 tab (hoặc 2 tab và 2 cửa sổ ẩn danh) chơi một ván đến khi có người thắng, qua được cả pha gỡ bom và pha nhìn trước, không có lỗi console.

### Phase 4 — Ổn định

- Mất kết nối và nối lại, banner, người bị loại vẫn xem được, chơi lại, dọn phòng, giới hạn tốc độ phía client (nút không gửi lặp khi đang chờ ack).
- Xong khi: mục 5.4, 5.7, 5.8 và 7.2 đều có test và pass.

### Phase 5 — Mobile và E2E

- Tối ưu 360px và kiểm tra thủ công trên thiết bị thật.
- Playwright: kịch bản 4 người chơi trọn một ván; kịch bản một người rớt mạng giữa ván rồi quay lại.
- Kiểm tra khả năng truy cập bằng bàn phím và trình đọc màn hình cơ bản.
- Xong khi: mục 0 Definition of Done đạt.

---

## 12. Quy ước cho agent

- Làm đúng một phase mỗi lần. Kết thúc phase: test pass, lint sạch, thêm mục vào [`CHANGELOG.md`](http://CHANGELOG.md), dừng và báo cáo.
- Không đổi luật ở mục 4 và quyết định ở mục 1. Nếu thấy cần đổi, ghi vào `OPEN_[QUESTIONS.md](http://QUESTIONS.md)` và dừng.
- Không thêm thư viện ngoài mục 3 khi chưa ghi vào [`DECISIONS.md`](http://DECISIONS.md).
- Không đưa asset có bản quyền vào repo. Biểu tượng và minh họa phải tự vẽ hoặc dùng giấy phép mở và ghi nguồn.
- Mỗi thay đổi hành vi phải có test. Commit nhỏ, một việc mỗi commit, thông điệp commit tiếng Anh.
- Không ghi bí mật vào repo.