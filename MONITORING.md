# Kế hoạch Phase 2: monitoring tự động

Trạng thái: kế hoạch, chưa triển khai. Phạm vi được người dùng yêu cầu thêm sau MVP. Tiếp tục chỉ viết code/config/migration/tài liệu khi triển khai; agent không tự build, test, chạy Compose hoặc probe dịch vụ thật.

## 1. Mục tiêu và phạm vi

- Kiểm tra định kỳ service từ network của server chạy PortAtlas, kể cả service không có `/health`.
- Ghi kết quả, thời gian phản hồi, nguyên nhân lỗi, lịch sử chuyển trạng thái và lần kiểm tra gần nhất.
- Cho mỗi service có nhiều probe, ví dụ Triton có HTTP và gRPC/TCP; phân biệt probe bắt buộc và phụ.
- Giữ `services.status` là status nhập tay; thêm trạng thái monitoring riêng. Không tự chuyển `running`/`stopped` từ một kết quả mạng.
- Ưu tiên HTTP/HTTPS và TCP trong đợt đầu. Protocol probe và heartbeat cho worker không có cổng là các đợt sau.
- CPU/RAM/GPU, auto-discovery, remote SSH, auto-restart và thực thi command trong registry nằm ngoài kế hoạch này.

## 2. Các cách kiểm tra

| Loại dịch vụ | Probe | Điều kiện và ý nghĩa |
| --- | --- | --- |
| Có endpoint health/readiness | HTTP GET tới URL được khai báo | Status code và nội dung đúng kỳ vọng; có thể kiểm tra JSON field |
| Web/API không có `/health` | HTTP GET tới `/`, trang login, `/docs`, `/openapi.json` hoặc endpoint đọc nhẹ do người dùng chọn | So sánh code/body; không bắt buộc sửa service để thêm health endpoint |
| Chỉ cần biết HTTP còn phản hồi | HTTP với chế độ `reachable` | Nhận được phản hồi HTTP bất kỳ nghĩa là reachable; code lỗi vẫn được hiển thị, không gọi là application healthy |
| HTTP có hỗ trợ HEAD | HTTP HEAD hoặc `HEAD → GET` | Không tải body; auto fallback GET khi HEAD trả 405/501 |
| Database, broker, SSH, gRPC chưa có adapter | TCP connect tới host:port | Mở được kết nối; chỉ chứng minh listener/network reachable |
| Redis/PostgreSQL/gRPC có hỗ trợ health | Adapter giao thức ở đợt sau | Redis PING, PostgreSQL SELECT 1, gRPC health khi service hỗ trợ; adapter cố định trong code |
| Job/worker không có endpoint và không có port | Heartbeat do service gửi về PortAtlas | Quá thời hạn heartbeat thì báo trễ/mất heartbeat; cần bổ sung tích hợp vào worker đó |
| UDP hoặc dịch vụ chỉ có thể kiểm tra bằng thao tác nghiệp vụ | Adapter chuyên dụng ở đợt sau | Chưa có adapter thì unknown/unsupported; không suy ra healthy từ UDP send hoặc ICMP ping |

Worker thực hiện HTTP bằng thư viện HTTP và TCP bằng socket bất đồng bộ, không chạy subprocess `curl`. “Curl thông” được hiểu là cấu hình HTTP probe; command vận hành lưu trong registry vẫn chỉ để sao chép.

Đề xuất probe từ `healthcheck_url`, endpoints và ports hiện có: ưu tiên health URL, sau đó HTTP endpoint/HTTP port, sau đó TCP. Chỉ tạo gợi ý để người dùng kiểm tra URL, chọn tiêu chí và bật; không tự quét path hoặc tự gọi mọi URL trong database.

### Chính sách HTTP

- `response`: mặc định GET, status mong đợi `200–299`. Có thể cấu hình tập code cụ thể, ví dụ `200,204` hoặc `401` cho trang cần đăng nhập.
- `reachable`: mọi HTTP response là đạt tiêu chí kết nối, kể cả 4xx/5xx. UI ghi rõ chế độ này và hiện response code; không coi là kiểm tra nghiệp vụ.
- Root `/` trả 404: chế độ response thất bại trừ khi người dùng chủ động chấp nhận 404. Nên chọn endpoint đọc có ý nghĩa nếu có.
- HEAD không có body; chỉ cho phép assert code/header. Nếu chọn kiểm tra body/JSON, dùng GET. Auto fallback chỉ dành cho chế độ `HEAD → GET` đã cấu hình.
- Redirect mặc định tắt. Nếu bật: tối đa 3 lần, đánh giá code cuối, kiểm tra lại destination policy từng hop; không gửi credential sang origin khác.
- TLS verify mặc định bật. Hỗ trợ CA nội bộ mount read-only; tắt verify phải cấu hình rõ và hiển thị trong UI.
- Assert body: contains literal hoặc JSON path đơn giản + expected value, giới hạn response đọc 64 KiB; không chạy script/eval/regex tuỳ ý. Nội dung bị cắt hoặc JSON không hợp lệ phải trả lý do rõ.
- Đợt đầu chỉ GET/HEAD, tránh route có tác dụng ghi hoặc request inference nặng. POST synthetic check chỉ bổ sung sau với adapter/endpoint được chọn rõ.

Các ví dụ cấu hình (địa chỉ minh hoạ, chưa được gọi):

```text
TTCP-S2T: HTTP GET http://10.9.3.241:4067/docs, response, expected=200
Web login: HTTP GET https://app.internal/login, response, expected=200
API có auth: HTTP GET https://api.internal/, response, expected=401
API chỉ cần còn phản hồi: HTTP GET http://10.9.3.241:4067/, reachable
RabbitMQ: TCP 10.9.3.236:5672, required=true
RabbitMQ management: HTTP GET http://10.9.3.236:15672/, required=false
Triton gRPC: TCP 10.9.3.236:8001; UI ghi là TCP reachability
```

## 3. Lịch và trạng thái

Các giá trị dưới đây là mặc định thiết kế, có thể điều chỉnh theo số service và network:

| Tham số | Mặc định / giới hạn |
| --- | --- |
| Chu kỳ | 60 giây; cho phép 15–3600 giây |
| Connect timeout | 3 giây |
| Deadline một lượt | 10 giây, bao gồm DNS/connect/TLS/redirect/body và retry |
| Retry trong lượt | 1 lần cho timeout/connect error/5xx, delay 0.5 giây; không retry lỗi config/4xx/assert |
| Đổi sang down | 3 lượt liên tiếp fail |
| Phục hồi up | 2 lượt liên tiếp pass; lượt đầu tiên sau cấu hình có thể xác lập up ngay |
| Jitter | Khoảng ±10% chu kỳ để tránh mọi probe chạy cùng lúc |
| Concurrency | Tối đa 20 probe toàn worker, 2 mỗi host |
| Stale | Chưa có kết quả mới quá `max(3 × interval, 120 giây)` |
| Lưu dữ liệu | Kết quả chi tiết 30 ngày; sự kiện chuyển trạng thái 90 ngày |

Một lượt có thể gồm hai attempt nhưng chỉ tính một success/failure streak. `timeout`, `connection_refused`, `dns_error`, `tls_error`, `unexpected_status`, `assertion_failed`, `invalid_target`, `worker_error` là các mã lý do riêng. Lỗi worker/config không được quy thành target down; hiển thị unknown/error để phân biệt.

Trạng thái probe: `unknown`, `up`, `degraded`, `down`, `stale`, `paused`. Kết quả thô pass/fail hiển thị ngay; trạng thái ổn định dùng streak để hạn chế nhấp nháy. Trước ngưỡng down, các lượt fail chuyển sang degraded. Probe down vẫn down cho đến đủ ngưỡng phục hồi; UI có thể hiện “đang phục hồi 1/2”.

Tổng hợp service:

- Không có probe bật: unknown; tất cả paused: paused.
- Có probe bắt buộc down: down.
- Có probe bắt buộc stale/unknown: unknown hoặc stale và ghi rõ chưa đủ dữ liệu; không tuyên bố up.
- Có probe degraded, hoặc probe phụ down/stale/unknown: degraded.
- Tất cả probe đạt tiêu chí: up. Nhãn kèm mức kiểm tra `HTTP response`, `TCP connect` hoặc `heartbeat` để tránh hiểu quá mức.

Một service cần ít nhất một probe bắt buộc khi bật monitoring. Maintenance dùng `paused_until` có thời hạn; không tạo failure streak trong thời gian pause. Đổi target/tiêu chí tăng config version, reset streak và trạng thái unknown; lịch sử cũ giữ version cũ.

Uptime ban đầu là **tỷ lệ lượt pass**, không gọi là uptime theo thời gian: pass / (pass + fail) trong cửa sổ 24 giờ/7 ngày. Loại paused, stale và worker/config error khỏi mẫu; hiển thị số mẫu và độ phủ. Thời gian outage dùng sự kiện chuyển trạng thái, với sai số do chu kỳ/thử lại/ngưỡng, không suy ra thời điểm chính xác service chết.

## 4. Kiến trúc và vận hành

```text
Frontend → API CRUD/history/check-now → PostgreSQL
                                        ↑       ↓ claim due probes
                                    results   Monitor worker → HTTP/TCP targets
```

- Thêm service `monitor` vào Compose, dùng image backend và entrypoint riêng `portatlas-monitor`. Không nhúng scheduler vào FastAPI lifespan để tránh chạy trùng khi API có nhiều process.
- Dùng PostgreSQL làm nơi lưu lịch/check-now/results; đợt đầu không cần Redis/Celery. Worker chạy async I/O, database transaction ngắn; không giữ connection/row lock trong lúc chờ network.
- Poll jobs tới hạn mỗi 2 giây. Claim theo batch bằng `FOR UPDATE SKIP LOCKED`, commit lease trước khi probe; lease chứa token, config_version và expires_at.
- Lease hết hạn khi worker chết cho phép worker khác nhận lại. Chỉ lease token/version đang hợp lệ mới được ghi kết quả; kết quả cũ sau sửa/xoá/pause bỏ đi. Unique run ID chống ghi trùng, không cam kết request ra mạng exactly-once.
- Không chạy chồng cùng probe; không bù hàng loạt lịch bị bỏ lỡ khi worker restart. Tính next_due từ lượt hiện tại + jitter.
- Worker heartbeat lưu database; API/UI hiển thị worker mất heartbeat và queue lag. Compose healthcheck đọc heartbeat; API vẫn chạy khi monitor dừng, các kết quả trở thành stale.
- Dừng worker: ngừng claim mới, chờ các probe đang chạy trong deadline, thoát; job chưa hoàn tất được nhận lại sau lease expiry.
- Cleanup chạy theo batch mỗi ngày, xoá history quá retention; dữ liệu monitoring nằm trong PostgreSQL bind mount hiện tại. Với 100 probe mỗi phút có khoảng 4.32 triệu lượt/30 ngày: chỉ lưu metadata nhỏ, có index, theo dõi dung lượng trước khi bật nhiều probe.
- Log cấu trúc có probe ID, run ID, duration và error code; không log response body hoặc credential.

## 5. Dữ liệu và migration dự kiến

Tạo revision mới sau `0001_registry`; không sửa migration đã triển khai.

| Bảng | Nội dung |
| --- | --- |
| `monitor_probes` | id, service_id, name, kind, target_url hoặc host/port, HTTP method/mode/expected codes/assertion, required, enabled, interval, timeouts, thresholds, credential_ref, config_version, paused_until, next_due_at, lease_token/expiry, created_at/updated_at |
| `monitor_probe_state` | probe_id, stable_state, latest_outcome/error, success/failure streak, last_checked_at, last_success_at, last_failure_at, latency_ms, last_http_status, state_changed_at |
| `monitor_check_runs` | run_id, probe_id, config_version, scheduled_at/started_at/finished_at, outcome, error_code, sanitized message, latency_ms, HTTP status, attempt_count |
| `monitor_state_events` | probe_id/service_id, scope, old_state, new_state, reason, occurred_at |
| `monitor_workers` | worker_id, heartbeat_at, started_at, phiên bản, thông tin queue lag |

Index `(enabled, next_due_at)`, `(probe_id, finished_at DESC)`, retention timestamp và lease expiry; FK cascade khi xoá service/probe. Snapshot trạng thái service có thể được lưu hoặc tính từ probe state nhưng API search phải đọc theo batch, không N+1. Kết quả monitoring không cập nhật `services.updated_at`, search document, `last_accessed_at` hay `access_count`.

## 6. API và giao diện dự kiến

- `GET/POST /api/services/{id}/probes`: danh sách/tạo cấu hình.
- `PUT/DELETE /api/probes/{id}`: sửa/xoá probe độc lập; không thay aggregate `PUT /services` để tránh form service cũ vô tình xoá probes.
- `POST /api/probes/{id}/check-now`: enqueue và trả 202 + run ID; không probe ngay trong API request. Cooldown 10 giây, reuse job đang queued/running.
- `POST /api/probes/{id}/pause` và `/resume`: pause có thời hạn hoặc tiếp tục lịch.
- `GET /api/probes/{id}/history`: pagination và time range, giới hạn tối đa 30 ngày/lượt query.
- `GET /api/monitoring/summary`: trạng thái service, worker heartbeat, queue lag và bộ lọc theo monitoring state.
- Thêm `monitoring` snapshot vào service/search response, giữ `status` hiện tại và ngữ nghĩa filter cũ. Nếu thêm filter mới, dùng `monitor:down` thay vì đổi `status`.
- Service detail có tab Monitoring: cấu hình probe, bật/tắt, chạy ngay, trạng thái + lý do + lần kiểm tra, history/latency và maintenance.
- Search card/palette hiển thị badge monitoring và tuổi dữ liệu bên cạnh status nhập tay; không thêm dashboard nặng vào luồng tìm kiếm.
- Poll UI 15 giây khi tab đang visible; đợt đầu không cần WebSocket. Probe credentials chỉ hiện tên tham chiếu.

## 7. Phạm vi truy cập mạng và credential

Monitoring chủ động gọi các địa chỉ trong registry nên cần target policy trong worker và validate API:

- Cho phép CIDR mạng nội bộ của hệ thống do người triển khai cấu hình, không chặn toàn bộ private IP vì đây là mục tiêu chính. Cho phép public network chỉ khi cấu hình rõ.
- Chặn loopback, link-local/metadata, unspecified, multicast, địa chỉ database/control plane của PortAtlas; kiểm tra IPv4/IPv6, DNS và mỗi redirect. Resolve và kết nối tới IP đã được kiểm tra, giữ hostname cho Host/SNI, tránh DNS đổi đích sau validation.
- Không dùng proxy environment ngầm; không đưa shell command, userinfo URL hoặc credential vào target. Header override chỉ dùng danh sách cho phép, không cho sửa Host để vượt policy.
- Đợt đầu hỗ trợ probe không credential. Credential adapter đợt sau dùng mapping tham chiếu cố định sang Compose secrets/read-only files; không đọc path/env tuỳ ý do database cung cấp. Token không trả về frontend hoặc log/history.
- HTTP/TCP probes chạy bằng user không root, không Docker socket/privileged/SSH. Network phải có route từ container tới server đích; localhost trong container là container đó, không phải server được monitor.
- API quản lý monitoring vẫn theo mô hình mạng nội bộ của MVP; không mở public endpoint check-now. Heartbeat ingestion đợt sau phải có token theo probe và rate limit, độc lập với registry commands.

## 8. TODO theo thứ tự triển khai

### Đợt 1 — Schema và contract

- [ ] Migration cho probes, state, runs/events và worker heartbeat; indexes/retention constraints.
- [ ] Schema HTTP/TCP, validation target policy, interval/timeout/threshold bounds và config version.
- [ ] CRUD probe độc lập service aggregate; pause/resume; API trả trạng thái unknown khi chưa có dữ liệu.
- [ ] Giữ tương thích status nhập tay và không tác động timestamps/search/access counter.

### Đợt 2 — Probe và worker

- [ ] HTTP GET/HEAD/fallback, response/reachable, code/assertion, bounded body, redirect/TLS policy.
- [ ] TCP connect IPv4/IPv6, timeout, host/port và error classification.
- [ ] Scheduler/lease/stale-result rejection, jitter, retry budget, concurrency và graceful shutdown.
- [ ] State machine/streak, service aggregation, history/events và cleanup retention.
- [ ] Queue check-now có cooldown; worker heartbeat và monitoring summary.
- [ ] Compose service monitor, dependency migration/db, healthcheck, restart/log rotation và environment mẫu.

### Đợt 3 — UI và bàn giao HTTP/TCP

- [ ] Form probes trong service detail, gợi ý từ URL/ports, pause/resume và check-now.
- [ ] Badge riêng trong search/detail/palette; history, latency, pass ratio và worker stale.
- [ ] Tài liệu network/allowlist/CA, dung lượng, backup và checklist chạy thử trên server.
- [ ] Rà soát tĩnh toàn bộ diff; người dùng tự build/chạy trên server theo quy trình hiện tại.

### Đợt 4 — Các trường hợp không thể kiểm tra bằng HTTP/TCP

- [ ] Adapter Redis PING, PostgreSQL SELECT 1, gRPC health; timeout và tài khoản read-only riêng.
- [ ] Credential references qua secrets và cơ chế rotation.
- [ ] Heartbeat token cho job/worker không có cổng, kiểm tra age và phân biệt job interval với long-running worker.
- [ ] Nếu cần UDP, thiết kế adapter theo từng giao thức; không dùng probe UDP chung để báo up.

### Đợt 5 — Cảnh báo, nếu cần

- [ ] Chọn kênh và người nhận do người dùng chỉ định trước khi tích hợp gửi bên ngoài.
- [ ] Chỉ cảnh báo khi down đã xác nhận, recovered hoặc worker stale; deduplicate theo event, cooldown, maintenance suppression.
- [ ] Outbox/retry cho notification; không gắn việc gửi cảnh báo vào transaction ghi kết quả probe.
- [ ] Không tự restart service khi nhận cảnh báo.

## 9. Checklist nghiệm thu trên server (chưa chạy)

1. HTTP 200/204, root 404, login 401, 500/503: response và reachable cho kết quả đúng chế độ; code vẫn hiển thị.
2. HEAD 405/501 fallback GET đúng cấu hình; body assertion dùng GET; redirect loop/external redirect không vượt limit/policy.
3. TCP mở/đóng, connection refused, DNS lỗi, IPv6, timeout và TLS CA nội bộ được phân biệt đúng.
4. Ba lượt fail mới down, hai lượt pass phục hồi; một retry không tăng streak hai lần; pause/resume/reset config hoạt động đúng.
5. Service nhiều probes required/optional tổng hợp đúng; worker chết dẫn tới stale, không biến toàn bộ target thành down.
6. Restart worker, hai worker claim đồng thời, lease hết hạn và sửa/xoá config trong lúc check: không ghi trùng hoặc ghi kết quả cũ.
7. Check-now trả 202, không giữ request chờ network, cooldown chống bấm liên tục; status nhập tay vẫn giữ nguyên.
8. Target ngoài allowlist, metadata/loopback, DNS đổi IP, redirect đổi origin và credential không bị lộ.
9. History pagination/retention, dữ liệu còn sau recreate container và không làm thay đổi search ranking/access history.
10. Kiểm tra tải theo quy mô thực tế: queue lag, database rows/dung lượng, concurrency mỗi host; điều chỉnh interval/retention trước khi mở rộng.

## 10. Tài liệu đối chiếu

- HTTP HEAD, status code và semantics: [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html). Các mặc định code/fallback ở trên là quyết định thiết kế PortAtlas.
- Claim queue bằng row locking: [PostgreSQL 17 SELECT / SKIP LOCKED](https://www.postgresql.org/docs/17/sql-select.html). Lease/token/version là thiết kế bổ sung để phục hồi worker.
