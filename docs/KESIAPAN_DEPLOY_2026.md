# Persiapan Deploy Matriks Pegawai 2026

Status: **belum deploy operasional**; tersedia cabang `setup/firebase-foundation` dengan pengujian kode lulus.

## Tersedia untuk DEV
- Halaman Mode Lihat dengan referensi anonim 2026: 25 tim, 40 pegawai anonim, 33 KRO, 22 contoh kegiatan (bukan seluruh 1.412).
- Form login Google kantor lalu login username/password peran, **belum aktif**.
- Menu Admin **Kelola Akun Akses** untuk membuat/mengedit akun, reset password, status.
- Backend autentikasi serta pengelolaan akun (default nonaktif).
- Firestore `(default)` tetap deny-all.
- Hosting dikonfigurasi menyajikan Vite `dist`, bukan placeholder.
- Workflow manual preview Firebase dengan GitHub Workload Identity Federation.

## Syarat untuk deployment percobaan
1. Hubungkan plugin Firebase ke ChatGPT, atau minta admin GitHub `bpsblora` dan admin Firebase menyiapkan Workload Identity Federation untuk workflow.
2. Aktifkan Hosting dan deploy channel preview DEV.
3. Daftarkan domain preview di Firebase Authentication.
4. Tetapkan UID Gmail BPS Blora sebagai viewer (tanpa memberikan akses tulis).
5. Jika ingin fungsi login peran/kelola akun, diperlukan **paket Blaze** untuk Cloud Functions serta review keamanan, izin biaya, dan bootstrap akun Admin pertama.
6. Uji Firestore Rules, otorisasi peran, akses lintas tim, audit log, pemulihan dan masa sesi.
7. Data pegawai asli **tidak** dimasukkan ke DEV `nam5`; siapkan proyek PROD terpisah di lokasi sesuai izin TI.
8. Import seluruh referensi 2026 dari sumber yang divalidasi. Saat ini hanya 22 contoh kegiatan siap ditampilkan, bukan daftar lengkap.
9. Selesaikan migrasi fitur input alokasi/monitoring/standar/rekonsiliasi/finalisasi v2.6 sebelum mengklaim operasional penuh.

Jangan bagikan sandi Gmail atau service account JSON lewat GitHub, dokumen, maupun ChatGPT. Build berhasil bukan berarti database/role sudah aman.
