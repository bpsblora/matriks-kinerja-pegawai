# Matriks Kinerja Pegawai — BPS Kabupaten Blora

Repository **privat** untuk pengembangan Matriks Kinerja Pegawai dan migrasi prototipe HTML v2.6 menuju Firebase.

## Status saat ini

- Repository telah terhubung dengan ChatGPT melalui akun GitHub pengembang.
- Cabang `setup/firebase-foundation` memuat konfigurasi **persiapan**, bukan aplikasi operasional.
- Firebase DEV `mkp-bps-blora` sudah dibuat. Google Authentication aktif; Firestore `(default)` sudah ada di lokasi `nam5` tetapi **tetap deny-all**.
- **Belum ada login operasional, akun pegawai, pembagian peran, atau deployment.**
- Prototipe v2.6 masih menggunakan data lokal dan login simulasi; jangan unggah atau publikasikan begitu saja.

## Arah arsitektur

GitHub (kode + review) -> Firebase Hosting (web) -> Authentication (Google untuk mode lihat; custom token akun peran untuk pengelolaan) + Cloud Firestore (data bersama).
Tindakan sensitif seperti pengaturan role dan finalisasi harus divalidasi oleh proses server tepercaya.

## Dokumen

- [Langkah setup Firebase](docs/SETUP_FIREBASE.md)
- [Arsitektur dan rencana migrasi](docs/ARSITEKTUR_DAN_MIGRASI.md)
- [Rancangan akses dua tahap: Google lihat + login peran](docs/KEBIJAKAN_AKSES_DUA_TAHAP.md)
- [Fondasi backend username/password peran](docs/AUTENTIKASI_USERNAME_PASSWORD.md)

## Pengendalian keamanan

- `firestore.rules` sengaja **deny all**. Jangan mengubahnya sebelum aturan hak akses diuji.
- `.env` dan `.env.*` diabaikan Git (kecuali `.env.example`). **Dilarang** menyimpan password, service account private key, ataupun data pegawai di Git.
- `index.html` menampilkan form login DEV yang **nonaktif secara default**. `public/index.html` adalah placeholder statis lama.
- Tidak ada workflow deployment otomatis ke Firebase sampai infrastruktur dan perizinan siap.

## Penanggung jawab

- Pemilik repository: akun GitHub `bpsblora`.
- Pengembangan kode: kolaborator yang ditugaskan secara resmi.
- Pemilik proyek Firebase DEV/PROD: akun Google resmi kantor dan administrator cadangan, setelah persetujuan TI.

## Alur pembaruan

`branch -> pull request -> pemeriksaan -> persetujuan -> merge -> deployment DEV -> uji -> promosi PROD terkontrol`.

Dokumen ini tidak merupakan persetujuan untuk memasukkan data pegawai asli ke layanan cloud.
