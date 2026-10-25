# SEO Manager — Quản lý dự án SEO

Web app quản lý dự án SEO: quản lý từ khoá, bài viết và backlink cho nhiều dự án (mỗi dự án gắn với một website).

## Tính năng

- **Tổng quan (dashboard):** số từ khoá, từ khoá lọt top 3 / top 10, bài viết đã xuất bản, backlink đang sống, phân bố thứ hạng, danh sách mục cần chú ý.
- **Từ khoá:** nhóm theo topic cluster, ý định tìm kiếm, volume, độ khó, vị trí hiện tại, URL đích; tìm kiếm và lọc theo nhóm.
- **Bài viết:** gắn với từ khoá mục tiêu, quy trình Ý tưởng → Đang viết → Chờ duyệt → Đã xuất bản, người viết, số từ, ngày xuất bản.
- **Backlink:** URL nguồn / URL đích, anchor text, loại link, dofollow / nofollow, trạng thái sống / chờ / mất, chi phí và tổng chi phí.

Mọi mục đều thêm, sửa, xoá được; số liệu ở trang tổng quan tự cập nhật từ dữ liệu đã nhập.

## Cấu trúc thư mục

- `client/` — giao diện React + TypeScript (`client/src/App.tsx` là thành phần chính).
- `server/src/actions.ts` — các hành động phía máy chủ (CRUD cho dự án, từ khoá, bài viết, backlink).
- `server/src/schema.ts` — lược đồ dữ liệu.
- `drizzle/` — các migration SQL của cơ sở dữ liệu.

## Ghi chú

Mã nguồn này được xuất từ ứng dụng đang chạy trên nền tảng Muse (TypeScript space: React client + server actions + Drizzle/SQLite, đóng gói bằng Bun). Một số phụ thuộc (ví dụ `@hatch/space-sdk` trong `package.json`) thuộc runtime của Muse, nên mã nguồn ở đây phục vụ mục đích lưu trữ, tham khảo và phát triển tiếp — muốn chạy độc lập ngoài Muse sẽ cần thay lớp runtime tương ứng.
