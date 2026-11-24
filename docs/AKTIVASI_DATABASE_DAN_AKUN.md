# Aktivasi Matriks Bersama 2026–2027 (Admin, Ketua Tim, Kepala BPS)

Status kode: jalur Firebase Callable Functions + penyimpanan Firestore + alokasi per pegawai + account admin ada di cabang pengembangan. **Backend belum dideploy; belum ada akun Admin/Kepala/Ketua Tim asli.** Hosting otomatis saat ini hanya memperbarui preview anonim.

## A. Batas yang tidak boleh dilewati

1. Proyek DEV `mkp-bps-blora` memakai Firestore `nam5` (AS). JANGAN masukkan data pegawai BPS di sana; hanya uji anonim.
2. Untuk penggunaan kantor, pengelola perlu menyetujui lokasi data, biaya, identitas pembaca, dan kebijakan peran. Disarankan proyek Firebase PROD terpisah dan Firestore `asia-southeast2` (Jakarta). Lokasi Firestore default yang sudah dibuat tidak dapat dipindahkan langsung.
3. Cloud Functions Gen 2 memerlukan Firebase Blaze / akun penagihan sesuai kebijakan proyek. Menyalakan Blaze dan memasang Functions **bukan bagian workflow Hosting saat ini**.
4. Sebaiknya jangan bagikan password Google pemilik Firebase sebagai viewer; Mode Lihat aplikasi tidak mengurangi akses pemilik ke Google Cloud Console. Gunakan akun viewer terpisah atau SSO resmi bila memungkinkan.
5. Tidak boleh ada password peran, nama pegawai, file HTML asal dengan data asli, atau service-account JSON di GitHub.

## B. Koneksi yang sudah dibuat pada kode

- Google Firebase Authentication: satu UID viewer diizinkan dari `VITE_VIEWER_GOOGLE_UID` (frontend), dan nilai yang sama di `VIEWER_GOOGLE_UID` (backend). UID bukan sandi; **server tetap memverifikasi ID token Google dan email verified**.
- Mode Lihat: `listMatrixRecords` dan `getMatrixYearState` membaca data bersama melalui Callable Functions, hanya setelah `MATRIX_BACKEND_ENABLED=true`, tanpa izin tulis.
- Login peran: `usernameSignIn` memverifikasi **sesi Google viewer + bcrypt password** di server, lalu menerbitkan custom token akun berbeda.
- Admin: mengelola data/tahun/pegawai/tim/KRO/standar serta akun dan reset password. Pembuatan akun sensitif Admin/Kepala memerlukan flag terpisah dan otorisasi pengelola.
- Ketua Tim: hanya mengelola kelompok, kegiatan, alokasi bulanan/tahunan, jadwal, target, dan proses kerja pada `teamIds` yang ditetapkan.
- Kepala BPS: membaca semua data serta mengesahkan/finalisasi tahun; tidak bisa mengubah alokasi.
- `firestore.rules` tetap deny-all karena baca/tulis dilakukan lewat Function Admin SDK yang memvalidasi identitas server. Log perubahan disimpan server-side.

## C. Tahapan aktivasi satu kali oleh admin TI (belum dijalankan)

1. Buat/siapkan **project PROD yang disetujui**, pilih database Firestore di Jakarta, dan siapkan billing Blaze dengan anggaran serta alert. Pastikan kepatuhan kebijakan BPS.
2. Aktifkan Google Sign-in dan Authorized Domains untuk Hosting PROD. Siapkan akun Google **viewer** tanpa hak pemilik cloud.
3. Instal dependensi `cd functions && npm install`, jalankan `npm test` dan `npm run check`. Uji Cloud Functions + semua alur hak akses dalam emulator/staging dengan data palsu.
4. Konfigurasikan backend runtime/environment pada project PROD (tidak disimpan ke Git):
   - `MATRIX_FUNCTION_REGION=asia-southeast2`
   - `VIEWER_GOOGLE_UID=<UID_VIEWER_YANG_DISETUJUI>`
   - `AUTH_LOGIN_ENABLED=true` setelah lolos audit
   - `MATRIX_BACKEND_ENABLED=true` setelah lolos audit
   - `ACCESS_ADMIN_ENABLED=true` setelah bootstrap dan lolos audit
   - `ALLOW_ELEVATED_ROLE_MANAGEMENT=false` secara normal; aktifkan hanya sementara dengan persetujuan tambahan jika Admin perlu membuat Kepala/Admin.
5. Deploy **Functions saja** dari terminal admin terautentikasi ke project PROD. Jangan memakai akun layanan GitHub DEV yang hanya berizin Hosting. Validasi daftar endpoint Function dan region.
6. Bootstrap Admin pertama secara interaktif menggunakan `functions/bootstrapAdmin.cjs` dan flag persetujuan. Password diketik tanpa tampil dan tidak boleh dikirim dalam chat.
7. Login Google viewer, kemudian login Admin. Buat akun Ketua Tim per tim (wajib `teamIds`); buat akun Kepala BPS dengan kontrol elevated-role terpisah; segera nonaktifkan elevated-management setelah selesai. Uji login/tolak akses silang, reset password, penonaktifan, dan finalisasi.
8. Dari sumber HTML V25 v2.6 yang **disimpan privat di perangkat kantor**, jalankan DRY RUN `scripts/import-legacy-2026.mjs` dan validasi sumber 1.412 uraian, 40 pegawai, 25 tim, 33 KRO, alokasi tahunan/bulanan. Lanjutkan `--write` hanya ke PROD yang disetujui setelah verifikasi. Impor ditolak pada DEV `mkp-bps-blora`.
9. Siapkan tahun 2027 oleh Admin; kemudian gunakan DRY RUN dan, setelah persetujuan, impor `scripts/import-kro-2027.mjs`. Rekomendasi `suggestedTeamIds` **bukan** penetapan `teamIds`.
10. Build frontend PROD dengan Firebase Web Config PROD, `VITE_FIREBASE_FUNCTION_REGION=asia-southeast2`, `VITE_ROLE_AUTH_READY=true`, `VITE_MATRIX_BACKEND_READY=true`. Deploy Hosting PROD setelah pengujian dan persetujuan, tidak lewat auto-deploy preview DEV.

## D. Pengujian minimum sebelum membuka akses pegawai

- Viewer Google benar dapat melihat data tapi tidak dapat membuat/update/hapus.
- Username/password salah, akun nonaktif, atau Google UID selain approved ditolak.
- Ketua Tim T001 tidak bisa melihat/mengedit data internal T002, mengubah roster tim, KRO global atau standar.
- Admin dapat membuat pegawai/tim/KRO, mengubah standar, dan mengelola akun sesuai izin.
- Kepala tidak mengedit tetapi bisa melakukan finalisasi; setelah final, semua penulisan tahun ditolak.
- Tiga peserta rapat 4 jam masing-masing dicatat 4 jam, **bukan** dibagi 4/3 jam.
- Backup, audit, pemulihan, App Check, penegakan batas percobaan login/IP, dan pemisahan tugas disetujui TI.

## E. Yang belum boleh diklaim selesai

- Aktivasi **runtime** Cloud Functions / Blaze dan data bersama PROD belum dilakukan.
- Sumber V25 asli belum ditulis ke Firestore. Preview tetap 22 contoh anonim agar aman.
- Akun role riil **belum dibuat**, sehingga username/password belum bisa dipakai untuk masuk.
- Tidak ada penerapan aturan Firestore lebih longgar; role di server tetap membutuhkan security review.

Referensi resmi: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans dan https://firebase.google.com/docs/firestore/locations.
