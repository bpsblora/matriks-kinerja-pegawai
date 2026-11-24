# Integrasi Firebase Matriks Kinerja Pegawai V25 v2.6

Tanggal: 6 November 2026. **KODE TERSEDIA; LOGIN PERAN & DATA RIIL BELUM DIAKTIFKAN.**

## Komponen siap pada branch setup/firebase-foundation

- Login Google UID BPS Blora sebagai **Mode Lihat** (referensi anonim).
- Login username/password akun peran melalui Cloud Function custom token (tetap `AUTH_LOGIN_ENABLED=false`).
- Akun `admin`, `ketua_tim`, dan `kepala`, masing-masing UID Firebase berbeda.
- Menu Admin **Kelola Akun Akses** melalui endpoint server: tambah, edit, reset password, aktif/nonaktif, audit.
- Menu Matriks V25 berbasis backend:
  - Dashboard jumlah tim, pegawai, KRO, uraian dan alokasi yang tercatat;
  - Kelola Tim + Daftar Pegawai;
  - Pembagian KRO dan tim pengampu;
  - Input Alokasi berurutan Tim → KRO → Kegiatan → Uraian, pegawai multi-select;
  - Timeline Kerja (jadwal);
  - Monitoring Pegawai;
  - Rekonsiliasi (indikasi belum dialokasikan/belum memiliki KRO);
  - Standar Waktu;
  - Riwayat server;
  - Finalisasi Tahun oleh Kepala BPS.
- Server `functions/matrixApi.js`: membaca, membuat, mengubah, menghapus data sesuai peran dan tim, membuat alokasi bersama secara atomik, audit, mengunci tahun yang telah difinalisasi.
- Keamanan: Firebase Web SDK **tidak boleh mengubah database secara langsung**. `firestore.rules` tetap deny-all. Operasi menggunakan Firebase Admin SDK pada Cloud Functions yang memeriksa ulang identitas dan role. Endpoint Matriks saat ini nonaktif kecuali `MATRIX_BACKEND_ENABLED=true`.
- Hak Ketua Tim berdasarkan susunan tim di `teamIds` dan daftar anggota; akun Kepala BPS hanya diberi persetujuan/finalisasi.
- Tiga pegawai menghadiri rapat 4 jam: setiap pegawai mendapat **4 jam**, ditulis sebagai tiga baris terpisah.

## Referensi tahun 2026 yang siap dimigrasikan secara privat

Berdasarkan HTML prototipe `Matriks_Kinerja_BPS_Blora_V25_Revisi_Terpadu_v2_6.html` (file yang ada dalam konteks proyek, **tidak** dimasukkan ke repo):
- 25 tim
- 40 pegawai (nama asli)
- 33 KRO
- 1.412 uraian kegiatan
- 3.224 catatan alokasi tahunan
- 2.779 catatan alokasi bulanan
- 16.941 baris sumber kegiatan bulanan
- 30 standar waktu

`scripts/import-legacy-2026.mjs` mempersiapkan objek Firestore per jenis, tetapi **default dry-run**. Untuk menulis:
1. Gunakan proyek PROD yang telah mendapat izin TI dan penempatan database disetujui. Script menolak proyek DEV `mkp-bps-blora` (region `nam5`).
2. Tinjau sumber asli dan satuan, termasuk perhitungan jam serta pemetaan KRO yang masih ambigu.
3. Operator wajib memberikan persetujuan terpisah melalui `MATRIX_IMPORT_APPROVAL=YES_TI_APPROVED_PRIVATE_PROD` serta `--write`.
4. File HTML tetap lokal pada lingkungan tepercaya; **jangan diunggah ke GitHub atau Hosting**.
5. Tahun yang sudah ada tidak ditimpa oleh importer secara diam-diam.

Beberapa hasil konversi jam adalah perkiraan `volume × standar jam` yang **perlu diverifikasi** sebelum menjadi data operasional.

## Prasyarat SEBELUM login Admin/Ketua Tim/Kepala diaktifkan

1. **Persetujuan TI** atas pemrosesan data pegawai pada cloud dan risiko satu Gmail kantor yang menjadi pemilik Firebase sekaligus digunakan sebagai akses bersama.
2. Proyek Firebase PROD **terpisah** dari `mkp-bps-blora`. Pilih lokasi Firestore sesuai kebijakan kantor, misal `asia-southeast2` (Jakarta). Lokasi `nam5` di DEV tidak dapat diubah.
3. Pengelola memberikan persetujuan **Firebase Blaze**. Dokumentasi Firebase menyatakan Cloud Functions hanya dapat dideploy di Blaze. Biaya bisa muncul jika melampaui kuota gratis; pasang budget alert.
4. Siapkan provider Google Sign-In, Authorized domains, dan Firebase web config untuk proyek PROD.
5. Setup Cloud Functions di region `MATRIX_FUNCTION_REGION=asia-southeast2` atau region disetujui, serta `VITE_FIREBASE_FUNCTION_REGION` yang sama.
6. Uji keamanan App Check, brute-force protection, penonaktifan user/sesi, reset password, kontrol role, dan audit sebelum deployment produksi.
7. Bootstrap Admin pertama melalui `functions/bootstrapAdmin.cjs` pada terminal tepercaya dengan password yang diketik tersembunyi. Jangan mencatat password di kode, git, atau chat.
8. Setelah lolos, aktifkan `AUTH_LOGIN_ENABLED`, `ACCESS_ADMIN_ENABLED`, `MATRIX_BACKEND_ENABLED`; dan frontend `VITE_ROLE_AUTH_READY=true`.
9. Import data asli hanya ke proyek PROD yang disetujui.
10. Uji dua browser terpisah: perubahan Admin terlihat setelah sinkronisasi, Ketua Tim tidak bisa mengubah tim lain, Kepala dapat memfinalisasi dan seluruh perubahan tahun terkunci.
11. Pastikan audit seluruh fitur lama (ekspor laporan, detail kalender, rekonsiliasi lanjutan, input data lintas tahun) selesai sebelum rilis resmi. **Kode sekarang bukan kloning penuh seluruh perilaku v2.6**.

## Persiapan aktivasi login peran pada Firebase DEV (10 November 2026)

Pop-up sekarang berjudul **Login Sesuai Peran**. Google BPS Blora membuka **Mode Lihat**; username dan password Admin/Ketua Tim tetap wajib diverifikasi oleh Cloud Function `usernameSignIn` dan identitas peran wajib diperiksa ulang melalui `getAccessContext`.

Workflow **[`deploy-role-login-backend-dev.yml`](../.github/workflows/deploy-role-login-backend-dev.yml)** telah ditambahkan sebagai jalur deployment **manual saja**. Workflow tidak berjalan pada push dan tidak mengaktifkan akses data matriks/Firestore. Prasyarat:

1. Persetujuan TI untuk akun viewer, penyimpanan data simulasi di DEV `nam5`, dan penggunaan Cloud Functions/biaya Blaze. Jangan gunakan data pegawai asli di DEV.
2. Variabel GitHub pada lingkungan yang disetujui: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT`, `VIEWER_GOOGLE_UID`, dan `FIREBASE_AUTH_DEV_APPROVED=true`. Konfigurasikan proteksi environment `firebase-auth-dev-approved` beserta review.
3. Jalankan **Actions → Deploy Role Login Backend — Firebase DEV → Run workflow**, isikan konfirmasi `APPROVE_DEV_ROLE_AUTH`. Backend DEV akan men-deploy hanya `usernameSignIn` dan `getAccessContext`; `MATRIX_BACKEND_ENABLED=false`, `ACCESS_ADMIN_ENABLED=false`, dan aturan Firestore tetap deny-all.
4. Bootstrap Admin pertama dari Cloud Shell tepercaya menggunakan `functions/bootstrapAdmin.cjs`, lalu uji login benar/salah, rate limit, penguncian akun, isolasi Ketua Tim dan pembatalan sesi. Password tidak boleh dikirim ke GitHub/chat.
5. **Hanya setelah hasil pengujian aman**, aktifkan frontend `VITE_ROLE_AUTH_READY=true` dan `VITE_MATRIX_BACKEND_READY=true` melalui build khusus lingkungan yang disetujui. Website publik GitHub Pages tetap **Mode Lihat** sampai seluruh prasyarat lengkap.

**Status sekarang:** workflow siap diperiksa, **belum dijalankan**. Backend peran **belum aktif**; keberhasilan tes GitHub saja bukan bukti fungsi telah dideploy atau akun peran telah dibuat. Database bersama belum diaktifkan.

## Mengapa belum langsung deploy Cloud Functions sekarang?
- Akun Firebase DEV masih **Spark**, belum disetujui upgrade Blaze;
- database DEV berada di **AS (nam5)** dan data pegawai asli belum disetujui diproses di sana;
- belum dilakukan pengujian Emulator end-to-end untuk semua peran.

**Penting:** otomatisasi GitHub yang sudah aktif hanya deploy preview Hosting data anonim pada channel `matriks-dev`, bukan fungsi, rules, atau data privat. Jangan mengubah workflow ini menjadi deploy backend tanpa review.

Referensi:
- https://firebase.google.com/docs/functions/get-started
- https://firebase.google.com/docs/auth/admin/create-custom-tokens
- https://firebase.google.com/docs/rules/rules-and-auth
