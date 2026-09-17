# Lò Rèn Hỗn Loạn – created by Shin

- `Lo_Ren_Hon_Loan.html` – trang web hoàn chỉnh (mở trực tiếp bằng trình duyệt).
- `src/builds.js` – hồ sơ build từng tướng (hướng build, 2 món Core, kho đồ Optional).
- `src/augtags.js` – nhãn thiên hướng của từng lõi + đồ bắt buộc.
- `src/engine.js` – bộ máy gợi ý đồ; `src/app.js` + `src/page.html` – giao diện.
- `data/` – dữ liệu gốc bản 26.18: `ddragon.json` (tướng, trang bị, icon), `augs.json` (lõi), `builds_aramgg.json` (bộ đồ cốt lõi / tình huống / lõi đề xuất của từng tướng theo thống kê aramgg.com).
- `src/builds.js` giờ chỉ dùng làm hướng build bổ sung khi thống kê aramgg chưa có nhóm đó.

Dựng lại trang sau khi sửa dữ liệu: `python build.py` (tạo `dist/index.html`).
