# Matriks Kinerja Pegawai — BPS Kabupaten Blora

Repository **privat** untuk pengembangan Matriks Kinerja Pegawai dan migrasi prototipe HTML v2.6 menuju Firebase.

## Status saat ini

- Repository telah terhubung dengan ChatGPT melalui akun GitHub pengembang.
- Cabang `setup/firebase-foundation` memuat konfigurasi **persiapan**, bukan aplikasi operasional.
- **Belum ada proyek Firebase yang dihubungkan, belum ada database bersama, dan belum ada deployment.**
- Prototipe v2.6 masih menggunakan data lokal dan login simulasi; jangan unggah atau publikasikan begitu saja.

## Arah arsitektur

GitHub (kode + review) -> Firebase Hosting (web) -> Authentication (login Google individual) + Cloud Firestore (data bersama).
Tindakan sensitif seperti pengaturan role dan finalisasi harus divalidasi oleh proses server tepercaya.

## Dokumen

- [Langkah setup Firebase](docs/SETUP_FIREBASE.md)
- [Arsitektur dan rencana migrasi](docs/ARSITEKTUR_DAN_MIGRASI.md)

## Pengendalian keamanan

- `firestore.rules` sengaja **deny all**. Jangan mengubahnya sebelum aturan hak akses diuji.
- `.env` dan `.env.*` diabaikan Git (kecuali `.env.example`). **Dilarang** menyimpan password, service account private key, ataupun data pegawai di Git.
- Halaman `public/index.html` hanya pemberitahuan bahwa sistem masih disiapkan.
- Tidak ada workflow deployment otomatis ke Firebase sampai infrastruktur dan perizinan siap.

## Penanggung jawab

- Pemilik repository: akun GitHub `bpsblora`.
- Pengembangan kode: kolaborator yang ditugaskan secara resmi.
- Pemilik proyek Firebase DEV/PROD: akun Google resmi kantor dan administrator cadangan, setelah persetujuan TI.

## Alur pembaruan

`branch -> pull request -> pemeriksaan -> persetujuan -> merge -> deployment DEV -> uji -> promosi PROD terkontrol`.

Dokumen ini tidak merupakan persetujuan untuk memasukkan data pegawai asli ke layanan cloud.
