# PortAtlas

Registry nội bộ để tra cứu service trên Linux server bằng tên, alias, IP, port, project và tag. Yêu cầu sản phẩm nằm trong [PORTATLAS.md](PORTATLAS.md); checklist triển khai trong [TODO.md](TODO.md).

Kế hoạch Phase 2 cho monitoring định kỳ, dịch vụ không có `/health`, HTTP/TCP probes và lịch sử trạng thái nằm trong [MONITORING.md](MONITORING.md). Đây là kế hoạch chưa triển khai.

## Trạng thái hiện tại

Đã viết nền tảng mục 1–2, API mục 3–4, giao diện MVP mục 5, Docker Compose và tài liệu bàn giao mục 6–7: khung Next.js, khung FastAPI, settings, database models, schema validation, migration ban đầu, CRUD registry, catalog projects/tags, health/readiness, service access counter, search có filter/ranking, command palette, service/server forms, các trang chi tiết và Compose development có mount source/tự reload. Chưa xác nhận build hoặc hoạt động runtime trên server.

Không cài dependency, chạy migration, build hoặc test trong giai đoạn viết code này. Các phiên bản dependency trực tiếp được pin từ metadata npm/PyPI; chưa có lockfile và chưa xác minh bằng installation/build. Dependency gián tiếp chưa được khoá.

## Cấu trúc

```text
frontend/                 Next.js App Router + TypeScript + Tailwind CSS
frontend/src/app/         Search, service, server và catalog routes
frontend/src/components/  App shell, palette, cards, forms và detail views
backend/app/core/         Settings, database session, error handlers
backend/app/models/       SQLAlchemy models
backend/app/schemas/      Pydantic input/output contracts
backend/app/routers/      Health, CRUD, catalog và search routes
backend/app/services/     Aggregate factory, seed, reindex
backend/migrations/      Alembic revisions và SQL triggers có phiên bản
backend/Dockerfile       Image FastAPI/Alembic, Uvicorn reload
frontend/Dockerfile      Image development chạy next dev
compose.yaml             db, migrate, backend và frontend
.dockerignore             Loại runtime data, secrets và build output khỏi context
.env.example              Biến môi trường mẫu, không chứa secrets thật
data/postgres/            Bind mount PostgreSQL dự kiến, không theo dõi trong Git
data/backups/             Backup local dự kiến, không theo dõi trong Git
```

Các API hiện có:

```text
GET  /api/health                         Liveness
GET  /api/readiness                      Database readiness
GET  POST PUT DELETE /api/servers        Server registry
GET  POST PUT DELETE /api/services       Service aggregate registry
POST /api/services/{id}/access            Atomic recent/frequency counter
GET  /api/projects, /api/tags             Catalog values and counts
GET  /api/search?q=...                    AND search, filters and ranking
```

Service `PUT` nhận toàn bộ aggregate và thay thế ports, aliases, tags, endpoints và commands trong cùng transaction. API search hỗ trợ `tag:gpu`, `server:241`, `project:s2t`, `port:4067`; các token độc lập được AND với nhau. Query rỗng trả `recent` và `frequent`; frontend gọi endpoint `/access` đúng một lần khi trang chi tiết đã mở.

Frontend giữ `/api/*` cùng origin và dùng rewrite server-side tới `BACKEND_ORIGIN` (mặc định `http://localhost:8000`, Compose sẽ dùng tên service backend). Command palette có focus trap, debounce 180 ms và huỷ request cũ bằng `AbortController`. Service detail chỉ mở link endpoint HTTP/HTTPS, còn commands chỉ có thao tác sao chép.

Frontend dùng Node.js 22; backend dùng Python 3.12 trở lên theo giới hạn trong `pyproject.toml`. Compose mặc định chạy development với source mount và tự reload. Cấu hình Tailwind theo [hướng dẫn Next.js chính thức](https://tailwindcss.com/docs/installation/framework-guides/nextjs); các kiểu PostgreSQL theo [SQLAlchemy PostgreSQL](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html).

## Quy ước dữ liệu

**Service type** là danh sách dùng chung: form cho phép chọn loại đã lưu hoặc gõ loại mới, sau đó chọn **Tạo mới …** ngay trong dropdown. Loại mới được lưu ngay vào database và tự chọn cho form, kể cả khi chưa lưu dịch vụ. Loại được trim/chuyển về chữ thường; các loại đang có trong dữ liệu được đưa vào catalog qua migration. Danh sách ban đầu gồm `fastapi`, `worker`, `database`, `postgresql`, `redis`, `rabbitmq`, `nginx`, `tritonserver`, `other`. API GET `/api/service-types` trả catalog có phân trang và filter `q`; POST nhận `{ "value": "tritonserver" }`. Tạo/sửa dịch vụ qua API cũng ghi nhớ loại được nhập.

Chọn `tritonserver` sẽ hiện **Triton model names**, bấm **+ Thêm model** để thêm từng dòng hoặc **Xoá** để gỡ. Payload/detail có `triton_model_names: ["yolor", "whisper"]`, tối đa 200 tên, mỗi tên tối đa 200 ký tự. Tên được trim, bỏ dòng rỗng và trùng chính xác; phân biệt chữ hoa/thường. Detail hiển thị danh sách kèm thao tác copy. Khi đổi sang loại khác và lưu, form gửi danh sách rỗng để gỡ model names; API từ chối danh sách không rỗng cho loại khác `tritonserver`. Đây là metadata nhập thủ công, không gọi Triton hoặc load model.

Màn **Service types** ở `/service-types` dùng để quản trị catalog: tìm kiếm, thêm loại và xem số service đang sử dụng. Chỉ loại có usage count bằng 0 mới xoá được; API trả 409 nếu loại đang được tham chiếu. Tên loại được chuẩn hoá chữ thường như khi thêm tại form service.

Các giá trị catalog trong form service dùng combobox có thể gõ: **Project**, **Environment** và **Service type**. Khi gõ giá trị chưa có trong danh sách, dropdown hiện **Tạo mới …**. Project và Environment được ghi vào service khi bấm Lưu; Service type được ghi nhớ ngay khi chọn tạo mới rồi tự điền vào form. Service type không còn nút tạo riêng bên dưới ô chọn. Server vẫn chỉ chọn từ registry; status, protocol, endpoint type và command type vẫn là enum cố định để giữ validation.

Migration mới nhất là `0004_service_types_triton`; cần áp dụng trước khi ứng dụng nạp source mới. Dừng frontend/backend, pull code, backup database, chạy `docker compose run --rm migrate`, rồi `docker compose up -d` khi migration thành công. Không cần rebuild với cấu hình development hiện tại vì không đổi dependency.

Tag được lưu trong database dùng chung. Trong form dịch vụ/server, nhập tag (có thể phân cách bằng dấu phẩy) và bấm **Thêm** để lưu vào danh sách và chọn cho form. Lần sau có thể tìm và bấm tag ở mục **Tag đã lưu**. Tag trùng được nhận diện không phân biệt hoa/thường; giữ cách viết đã lưu đầu tiên. Gỡ tag khỏi form hoặc xoá dịch vụ/server không xoá tag khỏi danh sách dùng chung. Bấm Thêm lưu tag ngay cả khi bạn chưa lưu hoặc huỷ form; việc gắn tag vào dịch vụ/server chỉ có hiệu lực sau khi lưu record.

Migration `0003_saved_tags` tạo danh sách và nhập tag đã có trên service/server. GET `/api/tags` giữ response catalog `{value, count}`; `count` là số dịch vụ trực tiếp mang tag (không đếm server), có thể bằng 0. POST `/api/tags` nhận `{ "tags": ["gpu", "asr"] }` và trả danh sách tag với cách viết đã lưu. Tag mới khi tạo/sửa service/server qua API cũng được nhớ lại trong cùng transaction.

Khi cập nhật server development, dừng frontend/backend trước khi pull, backup database rồi chạy `docker compose run --rm migrate`. Chỉ chạy `docker compose up -d` sau khi migration thành công; không cần rebuild vì tính năng này không đổi dependency. Các bước migration ở dưới cũng áp dụng cho migration tag mới.

Quan hệ phụ thuộc có hướng: dịch vụ A chọn B và C ở mục **Phụ thuộc vào** của form thêm/sửa. B và C phải là các dịch vụ đã có trong registry và có thể nằm trên server khác. Trang chi tiết A hiển thị B/C; trang B/C hiển thị A ở mục **Được phụ thuộc bởi**. Mỗi liên kết có tên, server/IP, status và toàn bộ port/protocol của dịch vụ đích; dịch vụ chưa khai báo port sẽ hiện rõ trạng thái đó. Quan hệ này dùng để tra cứu, không thay đổi thứ tự khởi động Compose hoặc tự cập nhật status.

POST/PUT `/api/services` nhận `dependency_ids: ["<uuid-B>", "<uuid-C>"]` (tối đa 100). PUT thay thế toàn bộ danh sách; `[]` hoặc bỏ field sẽ gỡ các phụ thuộc hiện có. Response chi tiết trả `dependencies` và `dependents`, mỗi phần tử có `ports` với `name`, `port`, `protocol` và mô tả. API chặn ID không tồn tại, tự phụ thuộc và vòng phụ thuộc (A → B → A, kể cả gián tiếp). Khi còn dịch vụ phụ thuộc vào B, xoá B trả 409; hãy gỡ quan hệ trên các dịch vụ đó trước. Xoá A tự xoá các quan hệ do A khai báo.

Trước lần chạy code có tính năng này trên database cũ, cần áp dụng migration `0002_service_dependencies`. Vì source đang được mount/reload, dừng ứng dụng trước khi pull để tránh API dùng bảng chưa được tạo:

```bash
docker compose stop frontend backend
git pull --ff-only
# Backup database theo hướng dẫn ở phần Backup và restore bên dưới.
docker compose run --rm migrate
# Chỉ thực hiện khi migration thành công.
docker compose up -d
```

Không thay đổi dependency Python/npm cho tính năng này nên không cần rebuild image của cấu hình development hiện tại. Chưa chạy migration/build/test trong môi trường viết code.

- UUID cho mọi record ID; bảng service tags dùng khoá ghép service ID + tag.
- Timestamp lưu bằng PostgreSQL `timestamptz`; môi trường server mặc định UTC. Database quản lý thời gian chỉnh sửa qua trigger.
- Tên server duy nhất không phân biệt hoa thường. Tên service duy nhất trong cùng server, không phân biệt hoa thường.
- Alias/tag trim, bỏ rỗng và deduplicate không phân biệt hoa thường; giữ cách viết của giá trị đầu tiên.
- Xoá service cascade các bản ghi con. Server còn service không được xoá.
- Status nhập thủ công: `unknown`, `running`, `stopped`, `degraded`. Chưa tự kiểm tra trạng thái service.
- URLs chỉ chấp nhận HTTP/HTTPS và không chứa credentials. Commands chỉ là chuỗi được lưu/hiển thị/sao chép.
- Phân trang dự kiến `page=1`, `page_size=20`, tối đa 100. Input service là toàn bộ aggregate; các bản ghi con sẽ cập nhật trong cùng transaction khi viết CRUD.
- Lỗi API có dạng `{ "error": { "code": "...", "message": "...", "details": [] } }`; validation trả field path và message, không phản hồi raw input.

## Search document

Migration `0001_registry` bật `pg_trgm`, tạo `search_text` và generated `search_vector` với cấu hình `simple`, cùng hai GIN indexes. SQL triggers tái tạo document khi thay đổi service, server hoặc ports/aliases/tags/endpoints/commands, trong transaction của lần ghi đó. Cập nhật search index và lượt truy cập không làm thay đổi thời gian chỉnh sửa registry.

Triggers là một phần có phiên bản của migration, không được tạo bằng `Base.metadata.create_all()`. Không dùng create_all thay cho Alembic. Database user chạy migration phải có quyền tạo extension `pg_trgm` hoặc extension phải được quản trị viên cài trước.

## Docker Compose và dữ liệu local

Các lệnh dưới đây là hướng dẫn cho Linux server và chưa được chạy trong môi trường viết code này. Compose dùng bốn service:

```text
db       PostgreSQL 17.5, không publish ra host
migrate  chạy alembic upgrade head, chỉ chạy sau khi db healthy
backend  FastAPI/Uvicorn, chỉ có trên network nội bộ
frontend Next.js dev, publish duy nhất WEB_PORT
```

`backend` chỉ khởi động khi `migrate` kết thúc thành công; `frontend` chỉ khởi động khi `/api/readiness` của backend kiểm tra được database. Job `migrate` có `restart: "no"`, còn các service dài hạn dùng `unless-stopped`. Mỗi service dùng log driver `json-file` với giới hạn 10 MB mỗi file và tối đa 5 file.

PostgreSQL dùng image `postgres:17.5-alpine` với `PGDATA=/var/lib/postgresql/data/pgdata`. Bind mount `./data/postgres` vào `/var/lib/postgresql/data`, vì vậy dữ liệu thực tế nằm ở `./data/postgres/pgdata` trên server. Backend và database không publish cổng host; browser gọi `/api/*` cùng origin với frontend, còn rewrite server-side dùng `BACKEND_ORIGIN=http://backend:8000` trong network Compose.

Compose này dành cho development. `./backend` được mount chỉ đọc vào `/app` của backend và migrate; `PYTHONPATH=/app` bảo đảm dùng source mới, Uvicorn `--reload` theo dõi `app/`. `./frontend` được mount vào `/app`, Next.js chạy `next dev` và tự cập nhật khi source thay đổi. Frontend có anonymous volumes riêng cho `/app/node_modules` và `/app/.next` để source mount không che dependency trong image và cache không ghi vào host. Frontend cần quyền ghi thư mục source cho các file Next.js sinh ra (như `next-env.d.ts`); backend không ghi vào source.

### Lần triển khai đầu tiên

```bash
git clone <repository-url> port-atlas
cd port-atlas
cp .env.example .env
${EDITOR:-vi} .env

# Tạo thư mục bind mount với quyền tối thiểu; không dùng chmod 777.
install -d -m 700 data/postgres
install -d -m 750 data/backups

# Image PostgreSQL quyết định UID/GID chạy database; lấy giá trị thực tế rồi cấp quyền.
POSTGRES_UID="$(docker compose run --rm --no-deps --entrypoint sh db -c 'id -u postgres')"
POSTGRES_GID="$(docker compose run --rm --no-deps --entrypoint sh db -c 'id -g postgres')"
sudo chown -R "${POSTGRES_UID}:${POSTGRES_GID}" data/postgres
sudo chmod 700 data/postgres

# Build từ source đã pull và khởi động theo dependency chain.
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 migrate backend frontend
```

Đặt `POSTGRES_PASSWORD` thành giá trị ngẫu nhiên dài trong `.env` và đặt `APP_ENV=development` (kể cả `.env` đã có từ trước). Không commit `.env`; `.gitignore` đã loại `.env`, `data/`, dependency và build output. `WEB_PORT` là cổng duy nhất publish, mặc định `3000`; `BACKEND_ORIGIN` là biến server-only và không dùng prefix `NEXT_PUBLIC_`. Next.js đọc `BACKEND_ORIGIN` lúc khởi động; nếu đổi `.env`, chạy `docker compose up -d --force-recreate backend frontend` để nạp environment mới.

Kiểm tra nhanh sau khi Compose chạy:

```bash
# Thay 3000 bằng WEB_PORT trong .env nếu đã đổi cổng publish.
curl -fsS "http://127.0.0.1:3000/api/health"
curl -fsS "http://127.0.0.1:3000/api/readiness"
```

### Cập nhật sau khi `git pull`

Lần đầu chuyển từ cấu hình cũ sang development, build/recreate container để áp dụng mounts và lệnh chạy mới:

```bash
git pull --ff-only
docker compose up -d --build --force-recreate --renew-anon-volumes
```

Sau đó, nếu chỉ thay đổi source backend/frontend, watcher tự reload sau pull; không cần build image:

```bash
git pull --ff-only
docker compose logs --tail=100 backend frontend
```

Nếu đổi `backend/pyproject.toml` hoặc `frontend/package.json`, build lại dependency và recreate container. `--renew-anon-volumes` nạp lại `node_modules` từ image mới và tạo cache Next.js mới; dữ liệu PostgreSQL vẫn nằm trong bind mount `./data/postgres`:

```bash
docker compose up -d --build --force-recreate --renew-anon-volumes
```

Nếu đổi migration/schema, dừng ứng dụng, backup trước khi chạy migration rồi khởi động lại. Mount migration mới không tự chạy Alembic. Nếu cũng đổi dependency, rebuild image trước bước `run`:

```bash
docker compose stop frontend backend
backup_file="data/backups/portatlas-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_file"
docker compose run --rm migrate
# Chỉ khởi động lại sau khi migrate thành công.
docker compose up -d
docker compose ps
docker compose logs --tail=100 migrate backend frontend
```

Thay đổi Compose cần `docker compose up -d` để áp dụng cấu hình. Thay đổi ngoài thư mục backend `app/` cần restart backend nếu watcher không phát hiện. Khi migration và code phụ thuộc schema cùng thay đổi, dừng backend/frontend trước `git pull` để watcher không nạp code mới trên schema cũ.

Migration chạy `alembic upgrade head` theo version và không reset database. Nếu migration lỗi, backend sẽ không khởi động; xem `docker compose logs migrate`, sửa code/cấu hình rồi chạy lại `docker compose up -d migrate` trước khi khởi động backend/frontend.

`docker compose down` chỉ dừng và xoá container/network, vẫn giữ `./data/postgres` và `./data/backups`. Không xoá `data/postgres` nếu chưa có backup; xoá thư mục đó sẽ mất database. Không dùng thao tác reset database trong quy trình cập nhật.

### Backup và restore

Backup dùng custom format của `pg_dump`, lưu ngoài container trong `./data/backups`:

```bash
backup_file="data/backups/portatlas-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_file"
```

Restore nên thực hiện khi backend/frontend đã dừng để không có ghi dữ liệu đồng thời:

```bash
docker compose stop frontend backend
cat data/backups/portatlas-YYYYMMDDTHHMMSSZ.dump \
  | docker compose exec -T db sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose up -d
```

Không sao chép trực tiếp thư mục `PGDATA` khi PostgreSQL đang chạy. Giữ nhiều bản backup trước các migration lớn và kiểm tra dung lượng/quyền ghi của `data/backups`.

### Xử lý sự cố thường gặp

- `migrate` thoát lỗi: đọc `docker compose logs migrate`; kiểm tra password, `POSTGRES_*`, quyền `data/postgres` và quyền tạo extension `pg_trgm`, sau đó chạy lại job migrate.
- Database không healthy: xem `docker compose logs db`; xác nhận `data/postgres` thuộc UID/GID của user `postgres` trong image và không có process PostgreSQL khác dùng cùng thư mục.
- Backend không healthy: xem `docker compose logs backend`; kiểm tra migration đã exit code 0 và readiness qua `curl` ở cổng frontend.
- Frontend không proxy được API: kiểm tra `BACKEND_ORIGIN=http://backend:8000`, recreate frontend sau khi đổi `.env` và xem `docker compose logs frontend`; không đổi browser sang hostname container.
- Cổng web bị chiếm: đổi `WEB_PORT` trong `.env`, rồi chạy lại `docker compose up -d`.
- Lỗi quyền backup: giữ `data/backups` thuộc user triển khai với mode `750`, không nới quyền toàn host.

MVP dành cho mạng nội bộ. Nếu cần public Internet, phải đặt reverse proxy có HTTPS và bổ sung xác thực trước khi mở cổng; Compose hiện không cung cấp authentication.

## Bảo trì thủ công ngoài Compose

Nếu chạy backend trực tiếp trong môi trường Python thay vì container, thực hiện từ `backend/` để settings đọc `../.env`:

```bash
alembic upgrade head
portatlas-seed --apply       # tuỳ chọn, IP TEST-NET cho dữ liệu demo
portatlas-reindex --apply   # tuỳ chọn, tái tạo search document
```

Seed không tự chạy lúc startup. Reindex chạy trong một transaction. Migration có advisory lock; downgrade ban đầu xoá các bảng registry nên không dùng để rollback production khi chưa có backup.

## Checklist chạy thử trên server

Sau khi `docker compose up -d --build` thành công, người triển khai kiểm tra lần lượt:

1. `GET /api/health` và `GET /api/readiness` trả thành công; `docker compose ps` hiển thị `db`, `backend`, `frontend` healthy và `migrate` đã hoàn tất.
2. Tạo/sửa/xoá một server; tạo service trên server đó, lưu nhiều port với protocol khác nhau, aliases, tags, endpoints và commands; mở lại để xác nhận dữ liệu.
3. Thử các truy vấn `241 s2t`, `236 triton yolor`, `4067`, `rabbitmq`, `tag:gpu`, `server:241`, `project:s2t port:4067` và một query không có kết quả; kiểm tra AND/filter/ranking.
4. Mở `Ctrl+K`, dùng `↑`/`↓`, `Enter`, `Esc`; thử khi đang ở form và kiểm tra focus không thoát khỏi palette.
5. Từ service detail, copy IP/port/URL/SSH/commands, mở endpoint HTTP/HTTPS, sửa service và xác nhận command chỉ được hiển thị/sao chép.
6. Mở cùng service nhiều lần; xác nhận `recent` và `frequent` thay đổi, không tăng bộ đếm khi chỉ hiện card search.
7. Thử xoá server còn service và xác nhận bị chặn; xoá service rồi xoá server thành công khi không còn liên kết.
8. Tạo backup, chạy `docker compose down`, rồi `docker compose up -d`; xác nhận service vẫn còn. Không xoá `data/postgres` trong bài kiểm tra persistence.

Khả năng build, migration và hoạt động thực tế chỉ được xác nhận sau khi người dùng chạy các bước trên server.
