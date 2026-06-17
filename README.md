# Cycle Ledger — Profit Tracker

Aplikasi web untuk menghitung profit per cycle (mining/crafting) dengan input pengeluaran detail tiap cycle. Semua nilai ditampilkan dalam Rupiah; modal USD dan harga gold otomatis dikonversi pakai kurs.

## Cara menjalankan

Butuh **Node.js** (versi 18 atau lebih baru). Cek dengan `node -v`. Kalau belum ada, unduh di https://nodejs.org

Buka terminal di folder ini, lalu:

```bash
npm install      # sekali saja, mengunduh dependency
npm run dev      # menjalankan website (mode development)
```

Buka alamat yang muncul (biasanya http://localhost:5173) di browser.

## Membuat versi siap-pakai (opsional)

```bash
npm run build    # hasil ada di folder dist/
npm run preview  # mencoba hasil build
```

Folder `dist/` bisa di-upload ke hosting statis apa pun (Netlify, Vercel, GitHub Pages, dll) untuk jadi website online.

## Fitur

- **Pengeluaran per cycle** — catat tiap item (beli wood, coal, metal, dll) dengan jumlah dan mata uang (IDR/USD).
- **Penjualan gold** — input jumlah gold dan harga per gold (USD).
- **Kurs per cycle** — tiap cycle punya kurs sendiri (rate bisa berubah tiap waktu).
- **Ringkasan total** — total modal, revenue, net profit, dan ROI gabungan; plus cycle terbaik & terendah.
- **Tersimpan otomatis** di browser. Tombol **Backup** mengunduh file JSON; **Muat** memulihkannya (berguna untuk pindah perangkat).

## Catatan

Data disimpan di penyimpanan lokal browser. Kalau membersihkan data browser atau ganti perangkat, gunakan fitur Backup/Muat agar data tidak hilang.
