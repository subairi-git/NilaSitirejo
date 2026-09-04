# NilaSitirejo - MongoDB Atlas Update

Bundle ini berisi file yang perlu di-replace / ditambahkan ke repository:
1. `package.json` — menambah `mongodb` dan `xlsx`.
2. `server.ts` — koneksi persistence, API history/stats/export CSV, health-triggered snapshot.
3. `server/databaseService.ts` — FILE BARU untuk MongoDB Atlas.
4. `src/components/TelemetryCharts.tsx` — grafik MongoDB 1/7/30 hari + CSV/Excel.
5. `src/components/TelemetryHistoryTable.tsx` — tabel MongoDB 1/7/30 hari + CSV/Excel.
6. `.env.example` — contoh variable MongoDB, tanpa secret nyata.

## Environment Variables di Render

Tambahkan pada Render > Service > Environment:

- `MONGODB_URI` = connection string MongoDB Atlas Anda.
- `MONGODB_DB` = `nilasitirejo`
- `JWT_SECRET` = secret aplikasi Anda (jika belum diset).

Contoh MONGODB_URI:
`mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

Jangan commit URI asli ke GitHub.

## MongoDB Atlas Network Access

Pastikan Render dapat mencapai Atlas. Untuk pengujian awal, Atlas Network Access dapat mengizinkan `0.0.0.0/0`, kemudian gunakan database user dengan password kuat dan hak minimum yang diperlukan.

## cron-job.org

Arahkan cron 5 menit ke:

`https://DOMAIN-RENDER-ANDA.onrender.com/api/health`

Endpoint ini:
- menjaga web service menerima request,
- mengecek status,
- menjalankan `saveTelemetryIfDue()`,
- menyimpan maksimal satu snapshot per device per bucket 5 menit.

`setInterval` 5 menit di server tetap menjadi backup. Unique index `{ device, bucket5m }` mencegah data dobel.

## API Baru

- `GET /api/health`
- `GET /api/telemetry/history?days=1&limit=10000`
- `GET /api/telemetry/history?days=7&limit=10000`
- `GET /api/telemetry/history?days=30&limit=10000`
- `GET /api/telemetry/stats?days=1`
- `GET /api/telemetry/export.csv?days=1`

`days` hanya menerima 1, 7, atau 30 (nilai lain kembali ke 1 hari).

## Setelah upload ke GitHub

Render harus melakukan build ulang karena dependency berubah.

Build Command:
`npm install && npm run build`

Start Command:
`npm start`

Jika Render Anda sudah menggunakan build command yang berhasil sebelumnya, cukup pastikan `npm install` dijalankan sehingga `mongodb` dan `xlsx` terpasang.

## Verifikasi

1. Buka `/api/health`
2. Pastikan `"mongodbConnected": true`
3. Tunggu cron / data MQTT aktual.
4. Buka `/api/telemetry/history?days=1`
5. Pastikan `"source": "mongodb"` dan data mulai muncul.
6. Buka tab grafik dan tab log pada aplikasi.
7. Uji 1 Hari, 7 Hari, 30 Hari, CSV, dan Excel.

## Catatan

Snapshot hanya disimpan setelah telemetry MQTT aktual sudah diterima (`received_at` tersedia). Ini mencegah nilai default aplikasi tersimpan sebagai data sensor nyata.


## Tambahan PLTS pada versi ini

Setiap snapshot 5 menit sekarang juga menyimpan object `plts`:
- `pvPowerW` / `pvPowerKW` = daya PLTS
- `batterySocPct` = persen baterai
- `batteryPowerW` = daya charge/discharge baterai
- `loadPowerW` = daya beban
- `gridPowerW` = daya PLN
- `gridVoltageV` = tegangan PLN
- `gridFrequencyHz` = frekuensi PLN
- `isGridAvailable` = PLN secara fisik tersedia (berdasarkan tegangan dari service)
- `isGridActive` = ada aliran daya grid/impor-ekspor
- `batteryDirection`
- `gridDirection`
- `connected`
- `lastUpdated`

History/Analitik menambahkan:
- statistik daya PLTS (avg/min/max)
- statistik baterai (avg/min/max)
- statistik daya beban (avg/min/max)
- status PLN terakhir
- grafik Daya PLTS vs Beban
- grafik SOC baterai 0–100%
- kolom PLTS/Baterai/Beban/PLN di log
- semua field PLTS ikut export CSV dan Excel

Tidak perlu mengubah `server/pltsService.ts`, karena field sumber sudah tersedia di service yang ada.
