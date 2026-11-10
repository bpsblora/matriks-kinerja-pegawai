# Menu Admin — Kelola Akun Akses

**Status 10 November 2026:** frontend GitHub Pages dan workspace Firebase telah terhubung ke kode API pengelolaan akun, **tetapi Cloud Functions belum diaktifkan/dideploy untuk operasional**. Pada GitHub Pages mode default tetap **Mode Lihat** sampai proses aktivasi disetujui.

## Alur pengguna

1. Pengguna masuk ke website dengan Google BPS Blora dan memperoleh **Mode Lihat**.
2. Klik **Login Peran**, kemudian masukkan username dan password Admin yang sebelumnya dibuat melalui *bootstrap* awal.
3. Server memvalidasi username/password dan mengembalikan Firebase token khusus akun peran. Akun Google viewer **tetap terhubung** pada sesi Firebase terpisah.
4. `getAccessContext` memvalidasi kembali status aktif dan `role=admin`. Tombol **Kelola Akun Akses** baru ditampilkan jika Admin terverifikasi; tindakan tidak dapat dilakukan oleh Ketua Tim ataupun Mode Lihat.
5. Admin dapat menggunakan **Kelola Akun Akses** untuk:
   - **Tambah Akun Ketua Tim**: username unik, password awal (12–72 byte), dan centang satu/lebih tim.
   - **Edit Akun**: perbarui username, peran dan cakupan tim yang diizinkan server.
   - **Reset Password**: password baru tanpa pernah menampilkan hash atau password lama.
   - **Aktifkan / Nonaktifkan**: ubah status akun dan cabut sesi terkait.
   - **Muat Ulang**: melihat nama tim yang dikelola, status aktif dan jumlah akun.
6. Ketua Tim login dengan akun yang dibuat Admin; tampilan difilter mengikuti tim yang terdaftar. Apabila beberapa tim ditetapkan, Ketua Tim dapat mengganti **Tim Aktif** di header. Server tetap memeriksa cakupan tim pada setiap permintaan data.
7. **Keluar Peran** mengembalikan pengguna ke Mode Lihat tanpa logout Google.

## Privasi dan aturan keamanan

- Akun username/password **bukan** password Google BPS Blora.
- Password hanya dikirim melalui HTTPS ke Cloud Functions. Hash menggunakan bcrypt dan tidak disimpan di repository, localStorage, atau dikirim kembali ke frontend.
- Hanya peran Admin aktif dengan kredensial *custom token* yang dapat mengelola akun; seluruh endpoint memakai pemeriksaan server `requireAdmin()`.
- Akun Admin pertama dibuat sekali menggunakan `functions/bootstrapAdmin.cjs` pada terminal Cloud Shell tepercaya dengan password tidak terlihat di layar. Pengguna tidak mengirimkan password melalui chat/GitHub.
- Setelah bootstrap, pembuatan akun Ketua Tim dilakukan oleh Admin dari menu. Pembuatan akun Admin/Kepala tambahan membutuhkan izin lebih tinggi (`ALLOW_ELEVATED_ROLE_MANAGEMENT`) dan **tetap nonaktif secara default**.
- Ketua Tim harus memiliki sedikitnya satu ID tim. Akun yang dinonaktifkan tidak boleh membuat sesi baru. Operasi pengelolaan akun dicatat sebagai audit server.
- `firestore.rules` tetap **deny-all**, agar browser tidak dapat mengakses Firestore secara langsung. Permintaan melalui Cloud Functions yang telah memverifikasi identitas.
- Preview DEV menggunakan referensi anonim 2026; data pegawai asli tidak boleh dimigrasikan ke Firestore DEV `nam5` tanpa persetujuan TI.

## Mengaktifkan fitur (membutuhkan pengelola Firebase)

1. Persetujuan TI dan biaya **Firebase Blaze** serta konfigurasi WIF/OIDC untuk deployment DEV; siapkan review keamanan dan pemulihan akun.
2. Aktifkan fungsi login DEV secara manual melalui [workflow login peran](../.github/workflows/deploy-role-login-backend-dev.yml) setelah persyaratannya terpenuhi.
3. Jalankan `bootstrapAdmin.cjs` untuk membuat Admin pertama secara aman, bukan dari halaman login publik.
4. Siapkan variabel repo `FIREBASE_ACCOUNT_ADMIN_DEV_APPROVED=true` dan `MATRIX_ADMIN_BOOTSTRAP_DONE=true` hanya setelah pemeriksaan sebenarnya. Jalankan [workflow Admin Akun DEV](../.github/workflows/deploy-admin-accounts-backend-dev.yml) melalui `workflow_dispatch` dan persetujuan lingkungan `firebase-account-dev-approved`.
5. Setelah pengujian server lulus, aktifkan `VITE_ROLE_AUTH_READY=true` dan `VITE_ACCESS_ADMIN_READY=true` pada build DEV **khusus**. `VITE_MATRIX_BACKEND_READY` tetap terpisah dan tidak perlu diaktifkan untuk pengelolaan akun.
6. Uji dua browser: Admin menambah/menonaktifkan akun, Ketua Tim login dan hanya melihat tim yang menjadi kewenangannya, logout peran tidak mengganti Google viewer, reset password dan pembatalan sesi sesuai kebijakan.

**Jangan mengubah semua flag menjadi true hanya demi membuka tombol.** Tanpa deployment Cloud Functions dan akun Admin yang sudah dibuat, tidak ada login peran yang benar-benar dapat bekerja.

## Kode terkait

- `src/publicPreview.js` — status sesi dan tombol Kelola Akun di header prototipe.
- `src/main.js` — dua sesi Firebase Auth untuk Google viewer dan akun peran.
- `src/adminAccess.js` + `src/adminAccess.css` — formulir Admin, centang tim, daftar akun, reset dan status.
- `src/liveMatrix.js` — akun hanya muncul pada hak akses Admin dan memakai sesi Cloud Functions sesuai peran.
- `functions/index.js` + `functions/accessAdmin.js` + `functions/security.js` — login dan pemeriksaan izin server.
- `functions/bootstrapAdmin.cjs` — pembuatan Admin pertama melalui terminal tepercaya.
