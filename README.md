# PIMA Catalogue AutoSync · chưa cài đặt

Mục tiêu: Drive là nguồn gốc, Cloudflare chứa sẵn ảnh từng trang cho mọi catalogue. Khách xem ảnh tĩnh, không dựng PDF khi lật. Mã nguồn hiện chỉ được chuẩn bị và kiểm tra cục bộ, chưa tạo repository, chưa thêm Secret, chưa bật lịch và chưa triển khai.

Không tải ZIP này trực tiếp lên Pages. Đây là bộ mã cho GitHub Actions, không phải một bản deployment đã tạo ảnh.

## Luồng vận hành

GitHub Actions kiểm tra thư mục công khai 1vXwfcLCZpB9rEHypkNlpGdJ1J4kuKATu theo lịch ở phút 7,22,37,52 mỗi giờ. File mới hoặc thay phiên bản được tải và chuyển thành WebP rộng 1600 px. Cache giữ ảnh các phiên bản đã xử lý để tránh dựng lại. Tất cả catalogue phải hoàn tất và danh sách Drive phải không thay đổi trong lúc xử lý thì mới gửi một bản triển khai đầy đủ lên dự án Pages hiện có pima-catalogue. Nếu có lỗi, không triển khai; khách tiếp tục xem bản cũ.

Danh sách phía khách được đọc từ catalogues.json đã xuất bản. Không tự hiển thị một PDF chưa có ảnh. Thay đổi danh sách theo lần triển khai thành công, không theo chu kỳ đọc Drive 60 giây cũ. 1.CATALOGUE PIMA vẫn là mặc định. Bản PDF gốc chỉ được đọc khi người dùng bấm tải xuống qua backend hiện tại.

## Cài đặt một lần

Tạo repository GitHub mới và tải toàn bộ nội dung bộ này lên thư mục gốc, gồm .github/workflows/sync.yml. Không tải ZIP nguyên khối. Nhánh mặc định và nhánh production trong lệnh triển khai phải là main. Không đưa API key hoặc token vào mã nguồn.

Tại repository > Settings > Secrets and variables > Actions, thêm các Repository secrets:

DRIVE_API_KEY: key tiêu chuẩn chỉ giới hạn Google Drive API, Application restrictions None. Không cấp quyền OAuth Drive cá nhân.

CLOUDFLARE_ACCOUNT_ID: ID tài khoản chứa dự án Pages.

CLOUDFLARE_API_TOKEN: token có quyền Account > Cloudflare Pages > Edit, giới hạn đúng tài khoản. Không dùng Global API Key.

Giữ Secret DRIVE_API_KEY phía Pages để nút tải PDF gốc tiếp tục hoạt động. Secret GitHub và Secret Pages là hai cấu hình riêng.

Chọn Actions > Sync public catalogues > Run workflow lần đầu. Theo dõi Prepare all catalogues và Publish only a complete changed build. Chỉ xác nhận hoạt động sau khi khách ẩn danh xem được cả ba catalogue, lật trang và tải PDF được. Thêm một PDF thử, chạy workflow thủ công để xác nhận đủ ảnh; sau đó xác nhận lần chạy theo lịch. Thử PDF hỏng trong bản thử riêng để xác nhận không triển khai một bộ thiếu.

## Miễn phí và giới hạn

GitHub xác nhận runner tiêu chuẩn miễn phí cho repository công khai. Nội dung catalogue là tài liệu công khai, nhưng token luôn phải nằm trong Secrets. Repository riêng có hạn mức phút chạy tùy tài khoản. Lịch Actions là best effort, có thể trễ và repository công khai không hoạt động 60 ngày có thể bị tắt lịch. Do đó không cam kết live tức thời hoặc miễn phí vô hạn. Cloudflare và Google API vẫn có hạn mức. Trước khi vận hành dài hạn cần kiểm tra usage, bộ nhớ cache và trạng thái workflow.

Mỗi ảnh là bản raster dành cho web, không thay file in. Chữ nhỏ khi zoom lớn có giới hạn độ nét. Không thay logo, cấu tạo hoặc thông số; chuyển ảnh trực tiếp từ PDF gốc.

## Nguồn kiểm tra 09/11/2026

https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows

VERIFIED: script và frontend đã qua kiểm tra cú pháp; quy trình có chặn deploy nếu xử lý lỗi hoặc nguồn thay đổi. Chưa kiểm thử token, lịch GitHub hay deployment thực tế.
UNKNOWN: nguyên nhân render của PDF cửa trong ảnh; chưa kiểm thử bản đồng bộ với tài khoản GitHub của người dùng.
