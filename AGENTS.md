# Quy tắc làm việc với PortAtlas

## Phạm vi và tài liệu

- Đọc `PORTATLAS.md` và `TODO.md` trước khi triển khai tính năng.
- `PORTATLAS.md` là mô tả sản phẩm; `TODO.md` là danh sách triển khai MVP. Cập nhật checkbox theo phần việc thực sự hoàn thành, không đánh dấu phần chưa xác minh là đã chạy thành công.
- Giữ MVP tập trung vào registry và tìm kiếm. Không tự mở rộng sang monitoring, discovery, server agents hoặc RBAC.
- Người dùng đã yêu cầu quan hệ phụ thuộc giữa các dịch vụ: có thể triển khai schema/API/form và hiển thị hai chiều; đây chỉ là dữ liệu registry, không điều khiển khởi động hoặc trạng thái container.
- Tag dùng lại phải lưu trong database dùng chung, không chỉ localStorage. Form dịch vụ/server cho phép bấm chọn tag đã lưu; gỡ tag khỏi record không xoá tag trong danh sách dùng chung.

## Quy trình được người dùng yêu cầu

- Công việc của agent là viết và chỉnh sửa code, cấu hình, migration và tài liệu trong repo.
- Không chạy build, test, cài dependency, migration, Docker Compose hoặc khởi động ứng dụng để kiểm thử, trừ khi người dùng yêu cầu rõ ràng sau này.
- Có thể đọc file, tìm kiếm và kiểm tra diff để rà soát tĩnh. Báo rõ build/test chưa chạy theo yêu cầu người dùng.
- Không tự commit, git push, deploy hoặc thao tác trên server. Người dùng sẽ git push để đồng bộ code, git pull trên server, rồi build và chạy thử.
- Không tự tạo sub-agent hoặc phân công song song nếu người dùng chưa yêu cầu.

## Triển khai và dữ liệu

- Dự án chạy trên Linux server bằng Docker Compose; chuẩn bị Dockerfile và `compose.yaml` phù hợp luồng build tại server sau git pull.
- Compose mặc định chỉ phục vụ development: bind mount source backend/frontend, Uvicorn reload và Next.js dev để source cập nhật sau git pull. Dependency thay đổi cần rebuild image; migration vẫn chạy thủ công có phiên bản. Không tự thêm cấu hình production nếu người dùng chưa yêu cầu.
- Lưu dữ liệu bền vững bằng bind mount vào thư mục local của dự án, mặc định `./data/postgres`; không dùng named volume cho dữ liệu PostgreSQL.
- Không commit dữ liệu runtime, backup, secrets hoặc `.env`. Cung cấp `.env.example` với giá trị mẫu và hướng dẫn cấu hình.
- Không mount Docker socket, không dùng privileged container, không thực thi lệnh SSH/Docker do registry lưu. Các lệnh vận hành chỉ hiển thị và sao chép.
- Tránh publish cổng database và backend ra host khi không cần; trình duyệt truy cập API qua cùng origin với frontend.
- Dùng migration có phiên bản; không tự xoá dữ liệu hoặc reset database khi khởi động.
- Tài liệu phải nêu đường dẫn bind mount, quyền ghi của container, backup/restore và quy trình cập nhật trên server.

## Chất lượng code

- Theo stack trong kế hoạch: Next.js + Tailwind CSS, FastAPI, PostgreSQL với `pg_trgm`, `tsvector` và GIN indexes.
- Validate dữ liệu ở backend; xử lý lỗi và trạng thái loading/empty/error ở frontend.
- Dùng truy vấn có tham số. Không thực thi command lưu trong database và không fetch URL healthcheck từ backend trong MVP.
- Khi bàn giao, nêu thay đổi, phần còn lại và giới hạn xác minh; không tuyên bố đã build/test hoặc chạy server nếu chưa làm.
