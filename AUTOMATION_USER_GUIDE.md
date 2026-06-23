# Hướng dẫn sử dụng Automation Test

Tài liệu ngắn gọn cho người viết test case tự động (Playwright) trong hệ thống.  
Cấu hình tại: **Test Cases → Edit test case → khối Automation**.

---

## 1. Cấu hình chung

| Ô | Ý nghĩa |
|---|---------|
| **URL gốc** | Địa chỉ website. Bước `goto` có thể dùng path ngắn `/login` thay vì URL đầy đủ. |
| **Web ID** | Khóa lưu session trình duyệt theo app/môi trường (khi test app cần đăng nhập). |
| **Profile user** | Khóa session theo user (`admin`, `tester`…). |
| **Timeout mặc định (giây)** | Giới hạn thời gian cho cả test case. |
| **Timeout bước (giây)** | Giới hạn cho **từng bước** — hết giờ = bước **FAIL**. |

**Dry run:** Sau khi Save, dùng **Chạy dry run** ở cuối form để thử nhanh từng case.

---

## 2. Engine tìm phần tử thế nào? (theo code thật)

Khi bạn chọn **Loại selector** + điền **Selector / text**, engine (`playwrightExecutor.js`) làm như sau:

| Loại bạn chọn | Engine gọi gì | Bạn điền vào ô Selector | Khớp text |
|---------------|---------------|-------------------------|-----------|
| **CSS** | `page.locator("...")` | Chuỗi CSS đầy đủ | Theo quy tắc CSS |
| **ID** | `page.locator('[id="..."]')` | Chỉ giá trị `id`, **không** gõ `#` | Khớp chính xác `id` |
| **Placeholder** | `page.getByPlaceholder(...)` | Text trong `placeholder="..."` | Khớp một phần |
| **Text** | `page.getByText(...)` | Chữ hiển thị trên trang | Khớp một phần |
| **Label** | `page.getByLabel(...)` | Chữ trên `<label>` hoặc `aria-label` | Khớp một phần |
| **data-testid** | `page.getByTestId(...)` | Giá trị `data-testid="..."` | Khớp chính xác |

**Quy tắc chung sau khi tìm (P3 — locator chặt):**

- Engine **đếm** số phần tử khớp selector — cần **đúng 1** phần tử.
- **Khớp 0** → fail ngay (không tìm thấy).
- **Khớp > 1** → **run thật:** fail; **dry run:** WARNING trong log và vẫn dùng phần tử đầu (để debug).
- **`click` + Text:** tìm **button** hoặc **link** (`<a>`) có chữ đó — không chỉ button.

**Retry bước (P4):** Lỗi **tạm** (timeout, phần tử chưa bấm được…) → engine **thử lại tối đa 2 lần**. **Assert sai** (text/URL không khớp mong đợi) → **không** retry.

**Không được dán HTML vào ô Selector.** Chỉ điền “địa chỉ”, không phải thẻ.

| Sai | Đúng |
|-----|------|
| `<input id="email">` | Loại **ID** → `email` hoặc CSS → `#email` |
| `<button class="btn">` | CSS → `button.btn` hoặc `.btn` |

---

## 3. CSS — khi nào dùng `#`, `.`, và cách viết chuẩn

CSS là **phương án linh hoạt nhất** — dùng được khi trang **không có** id, label, data-testid.

### 3.1. Ba ký hiệu hay gặp nhất

| Ký hiệu | Nghĩa | HTML ví dụ | Bạn điền (loại CSS) |
|---------|-------|------------|---------------------|
| `#tên` | Tìm theo **id** (duy nhất trên trang) | `<button id="submit">` | `#submit` |
| `.tên` | Tìm theo **class** (có thể nhiều phần tử) | `<button class="btn primary">` | `.btn` hoặc `.primary` |
| `thẻ` | Tìm theo **loại thẻ** | `<input>`, `<button>` | `input`, `button` |

**Khi nào dùng `#`?**  
→ Trang có `id="..."` và bạn biết id đó. Ví dụ `id="username"` → CSS: `#username`.

**Khi nào dùng `.`?**  
→ Trang dùng `class="..."`. Ví dụ `class="login-btn"` → CSS: `.login-btn`.  
→ Một thẻ nhiều class: `class="btn green"` → `.btn`, `.green`, hoặc kết hợp `button.green`.

**Không có id, không có class riêng?**  
→ Dùng **thẻ + thuộc tính** (mục 3.2).

### 3.2. Thuộc tính HTML — dùng khi không có id/label

Cú pháp: `thẻ[tên_thuộc_tính="giá trị"]`

| HTML | CSS điền |
|------|----------|
| `<input name="email">` | `input[name="email"]` |
| `<input type="password">` | `input[type="password"]` |
| `<button type="submit">` | `button[type="submit"]` |
| `<a href="/login">` | `a[href="/login"]` hoặc `a[href*="login"]` |
| `<select id="dropdown">` | `#dropdown` hoặc `select` (nếu chỉ có 1) |

`*=` nghĩa là “chứa chuỗi”: `a[href*="login"]` khớp mọi link có `login` trong href.

### 3.3. Kết hợp cho chính xác hơn

Khi trang có **nhiều nút cùng class**, thu hẹp selector:

| Tình huống | CSS gợi ý |
|------------|-----------|
| Nút submit trong form login | `form.login button[type="submit"]` |
| Ô email thứ 2 | `input[name="email"]` (nếu name khác nhau) |
| Nút trong vùng cụ thể | `#sidebar .btn-save` |
| Phần tử con | `.card .title` (`.title` **bên trong** `.card`) |

### 3.4. id là số — không dùng `#5`

HTML: `<input id="5">`

| Cách | Điền |
|------|------|
| Loại **ID** | `5` |
| Loại **CSS** | `[id="5"]` |
| Tránh | `#5` — id bắt đầu bằng số, CSS `#5` thường **sai** |

### 3.5. Lấy CSS bằng F12 (Chrome / Edge)

1. Mở trang web → **F12** → tab **Elements**.
2. Nhấn icon **chọn phần tử** (mũi tên góc trái).
3. Click lên nút/ô cần test trên trang.
4. Trong cây HTML, **chuột phải** thẻ được chọn → **Copy** → **Copy selector**.
5. Dán vào ô **Selector / text** (loại **CSS**).
6. **Dry run** thử — nếu fail, selector copy đôi khi quá dài; rút gọn theo mục 3.2–3.3.

---

## 4. ID / Label / Placeholder / Text / data-testid — cách dùng cụ thể

### ID

- HTML: `<input id="username">`
- Điền: loại **ID** → `username` *(không có `#`)*
- Tương đương CSS: `#username`
- Dùng khi: dev đặt `id` ổn định, ít đổi.

### Label

- HTML:
  ```html
  <label for="email">Email</label>
  <input id="email" />
  ```
  hoặc input nằm **bên trong** `<label>Email <input></label>`
- Điền: loại **Label** → `Email`
- Engine tìm **ô input** gắn với nhãn đó (Playwright `getByLabel`).
- Dùng khi: form có nhãn tiếng Việt/Anh rõ (`Username`, `Mật khẩu`…).
- **Không dùng Label** để click nút — Label dành cho **ô nhập / checkbox có nhãn**.

### Placeholder

- HTML: `<input placeholder="Nhập email">`
- Điền: loại **Placeholder** → `Nhập email`
- Chỉ có trong dropdown cho hành động **`type`**.
- Dùng khi: ô input có chữ mờ bên trong, không có label.

### Text

- HTML: `<button>Đăng nhập</button>` hoặc `<span>Xin chào</span>`
- Điền: loại **Text** → `Đăng nhập`
- Khớp **một phần** chuỗi (không cần đúng 100%).
- **`click` + Text:** tìm **button** hoặc **link** có chữ đó. `<span>` chỉ chữ không click được — dùng CSS hoặc `data-testid`.
- Dùng khi: nút chỉ có chữ, không có id/class.

### data-testid

- HTML: `<button data-testid="login-submit">Gửi</button>`
- Điền: loại **data-testid** → `login-submit`
- Dùng khi: team dev gắn sẵn cho test — **ổn định nhất** nếu có.

---

## 5. Trang không có id / label — chọn gì?

Làm theo thứ tự sau (dừng ở bước đầu tiên làm được):

```
1. Có data-testid?     → data-testid
2. Có id?              → ID hoặc CSS #id
3. Input có label?     → Label
4. Input có placeholder? → Placeholder (chỉ type)
5. Nút chỉ có chữ?     → Text (click) — button hoặc link
6. Còn lại             → CSS (class, name, type, F12 copy)
```

### Bảng tình huống thực tế

| HTML trên trang | Hành động | Loại | Điền |
|-----------------|-----------|------|------|
| `<button>Đăng nhập</button>` | click | Text | `Đăng nhập` |
| `<a href="/login">Đăng nhập</a>` | click | CSS | `a[href="/login"]` |
| `<button class="btn">Gửi</button>` | click | CSS | `button.btn` hoặc `.btn` |
| `<input name="user">` | type | CSS | `input[name="user"]` |
| `<input placeholder="Email">` | type | Placeholder | `Email` |
| `<label>MK</label><input>` | type | Label | `MK` |
| `<select id="country">` | select | CSS | `#country` |
| Chỉ có 1 `<button>` trên trang | click | CSS | `button` |
| Nhiều `.btn`, cần nút "Lưu" | click | Text | `Lưu` *(nếu là button)* |
| Nhiều `.btn`, "Lưu" là link | click | CSS | `a:has-text("Lưu")` hoặc F12 copy |

### Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách sửa |
|-------------|-------------|----------|
| Timeout, không tìm thấy | Selector sai / phần tử chưa load | Thêm bước `waitFor` trước; kiểm tra F12 |
| Click nhầm / flaky | Nhiều phần tử trùng selector | Engine fail (hoặc WARNING ở dry run) — viết CSS cụ thể: `form#login button` |
| Text không click được | Chữ nằm trên `<a>` không phải `<button>` | Đổi sang CSS |
| type không gõ được | Trỏ nhầm `<div>` thay vì `<input>` | Dùng `input[...]` hoặc Label/Placeholder |
| `#5` fail | id là số | Dùng `[id="5"]` hoặc loại ID → `5` |

---

## 6. assertVisible vs assertText (tóm tắt)

| | assertVisible | assertText |
|---|---------------|------------|
| Hỏi gì? | **Phần tử** có đang hiện không? | Trang **có chữ** đó không? |
| Cần Selector? | Có | Không (engine quét cả `body`) |
| Cần chuỗi mong đợi? | Không | Có |

- Chắc **ô menu / form** đã hiện → `assertVisible` + CSS `#dashboard`
- Chắc **thông báo chữ** xuất hiện → `assertText` + `Đăng nhập thành công`

---

## 7. Bảng hành động — điền gì, selector nào?

Cột **Loại selector** = các lựa chọn trong dropdown **Loại selector** của hành động đó.

| Hành động | Làm gì | Bắt buộc điền | Loại selector được chọn |
|-----------|--------|---------------|-------------------------|
| **goto** | Mở trang | URL/path + Timeout; tùy chọn **Chờ trang đến** (`load` mặc định hoặc `domcontentloaded`) | *(không dùng selector)* |
| **click** | Click chuột lên phần tử (nút, link…) | Selector + Timeout | CSS, ID, Text, Label, data-testid |
| **type** | Gõ/xóa rồi điền text vào input | Selector + Giá trị + Timeout | CSS, ID, Placeholder, Label, data-testid |
| **select** | Chọn option trong `<select>` | Selector + Giá trị option + Timeout | CSS, ID, Label, data-testid |
| **hover** | Di chuột (menu, tooltip) | Selector + Timeout | CSS, ID, Text, data-testid |
| **press** | **Nhấn phím bàn phím** (xem mục 4) | Phím + Timeout; Selector tùy chọn | CSS, ID, data-testid *(chỉ khi cần focus phần tử)* |
| **upload** | Chọn file cho `input[type=file]` | Selector + Đường dẫn file + Timeout | CSS, ID, data-testid |
| **dragTo** | Kéo phần tử A thả vào B | Nguồn (selector) + Đích (CSS) + Timeout | CSS, ID, data-testid |
| **wait** | Chờ cố định X giây | Thời gian đợi (= Timeout bước) | *(không dùng selector)* |
| **waitFor** | Chờ phần tử **hiện ra** | Selector + Timeout | CSS, ID, Text, data-testid |
| **assertText** | Kiểm tra trang **có chứa** chuỗi text | Chuỗi mong đợi + Timeout | *(không dùng selector — xem mục 5)* |
| **assertVisible** | Phần tử đang nhìn thấy | Selector + Timeout | CSS, ID, Text, data-testid |
| **assertHidden** | Phần tử đang ẩn | Selector + Timeout | CSS, ID, data-testid |
| **assertUrl** | URL trình duyệt **chứa** chuỗi | Chuỗi mong đợi + Timeout | *(không dùng selector)* |
| **assertTitle** | Tiêu đề tab **chứa** chuỗi | Chuỗi mong đợi + Timeout | *(không dùng selector)* |
| **assertEnabled** | Nút/input **không** bị disabled | Selector + Timeout | CSS, ID, data-testid |
| **assertChecked** | Checkbox/radio **đã tích** | Selector + Timeout | CSS, ID, data-testid, Label |

**Các assert** (`assertText`, `assertUrl`, `assertTitle`…): chuỗi mong đợi chỉ cần **xuất hiện một phần** — không cần khớp 100%.

---

## 8. `press` — nhấn phím bàn phím (không phải click màn hình)

| Câu hỏi | Trả lời |
|---------|---------|
| `press` là gì? | Mô phỏng **gõ phím trên bàn phím** (keyboard), giống bạn bấm Enter/Tab trên máy tính. **Không** phải click/tap lên nút trên màn hình — muốn bấm nút dùng **`click`**. |
| Điền phím ở đâu? | Ô **Phím** (Giá trị). |
| Selector có bắt buộc? | **Không.** Để trống = nhấn phím trên cả trang. Có selector = focus vào phần tử đó rồi mới nhấn phím. |
| `Esc` hay `Escape`? | Dùng tên phím **tiếng Anh theo Playwright**. Phím Escape viết **`Escape`** (không dùng `Esc`). |
| Ví dụ phím thường dùng | `Enter`, `Tab`, `Escape`, `Backspace`, `Delete`, `ArrowDown`, `ArrowUp`, `Space` |
| Tổ hợp phím | Có thể: `Control+A`, `Shift+Tab` (theo cú pháp Playwright). |

**Ví dụ — submit form sau khi gõ todo**

1. `type` → Placeholder `What needs to be done?` → giá trị `Học automation`
2. `press` → Selector CSS `.new-todo` (tùy chọn) → Phím `Enter`

---

## 9. Hành vi đặc biệt cần biết

| Tình huống | Hành vi hiện tại |
|------------|------------------|
| **assertText** | Kiểm tra text trên **toàn bộ trang** (`body`), không giới hạn theo một selector. Muốn kiểm tra một vùng cụ thể → dùng **assertVisible** + selector. |
| **goto** + path `/login` | Ghép với **URL gốc**: `https://app.com` + `/login` → `https://app.com/login`. |
| **wait** (Đợi) | Có trên UI nhưng **chưa lưu được vào database** — tạm dùng **waitFor** hoặc báo team nếu cần bật. |
| **upload** | Đường dẫn file là path trên **máy chạy backend**, không phải path trên máy bạn chọn trong trình duyệt. |
| **click** + Text | Tìm **button** hoặc **link** có chữ đó; nếu fail, thử **CSS** hoặc `data-testid`. |

---

## 10. Case demo có sẵn để thử

Project **Automation Web Demos** → group **Public Site Demos**:

| Case | Thử được |
|------|----------|
| DEMO-EX01 | goto, assertTitle, assertText |
| DEMO-INET | goto, assertTitle, assertText |
| DEMO-WIKI | goto, assertTitle, assertVisible + CSS |
| DEMO-TODO | goto, waitFor + Placeholder, type, press + Enter, assertText |

Seed lại demo: `cd backend && npm run automation:seed-demos`

---

## 11. Khi bước FAIL

1. Đọc log **Dry run** — ghi rõ **Step #** và lỗi.
2. Xem **screenshot** (nếu có) ở cuối panel dry run.
3. Kiểm tra **Timeout** — trang chậm thì tăng 20–30 giây.
4. **assertText / assertTitle / assertUrl:** copy đúng chuỗi từ trang (phân biệt hoa thường nếu cần).
5. **press:** kiểm tra tên phím (`Escape` không phải `Esc`).

---

*Tài liệu bám theo `frontendnext/lib/automationStepMeta.ts` và `backend/src/services/automation/playwrightExecutor.js`. Nếu UI và engine lệch nhau, ưu tiên hành vi engine.*
