# Matriks Kinerja Pegawai — BPS Kabupaten Blora

Repository **privat** untuk pengembangan Matriks Kinerja Pegawai dan migrasi prototipe HTML v2.6 menuju Firebase.

## Status saat ini

- Repository telah terhubung dengan ChatGPT melalui akun GitHub pengembang.
- Cabang `setup/firebase-foundation` memuat konfigurasi **persiapan**, bukan aplikasi operasional.
- Firebase DEV `mkp-bps-blora` sudah dibuat. Google Authentication aktif; Firestore `(default)` sudah ada di lokasi `nam5` tetapi **tetap deny-all**.
- Preview Hosting `matriks-dev` telah terbit untuk pengujian dengan data anonim. **Login peran dan data bersama belum operasional.**
- Prototipe v2.6 masih menggunakan data lokal dan login simulasi; jangan unggah atau publikasikan begitu saja.

## Preview Matriks 2026 dan Admin
- Dashboard referensi 2026: 25 tim, 40 pegawai anonim, 33 KRO, 22 contoh kegiatan.
- Referensi mencatat 1.412 uraian sumber, tetapi detail semuanya belum dimigrasikan.
- Menu Admin **Kelola Akun Akses**: tambah/edit username, peran, tim, reset password, serta aktif/nonaktif.
- Menu Admin dan login peran **belum aktif** sampai Cloud Functions, Rules, dan akun Admin pertama siap.
- Firebase Hosting menggunakan hasil build `dist`. Preview `matriks-dev` sudah tersedia; pengaturan Workload Identity Federation GitHub → Firebase telah selesai di Cloud Shell pada 6 November 2026. Workflow `auto-deploy-dev-preview.yml` sedang diuji untuk pembaruan otomatis.

## Arah arsitektur

GitHub (kode + review) -> Firebase Hosting (web) -> Authentication (Google untuk mode lihat; custom token akun peran untuk pengelolaan) + Cloud Firestore (data bersama).
Tindakan sensitif seperti pengaturan role dan finalisasi harus divalidasi oleh proses server tepercaya.

## Dokumen

- [Langkah setup Firebase](docs/SETUP_FIREBASE.md)
- [Arsitektur dan rencana migrasi](docs/ARSITEKTUR_DAN_MIGRASI.md)
- [Rancangan akses dua tahap: Google lihat + login peran](docs/KEBIJAKAN_AKSES_DUA_TAHAP.md)
- [Fondasi backend username/password peran](docs/AUTENTIKASI_USERNAME_PASSWORD.md)
- [Kelola Akun Akses](docs/MENU_ADMIN_AKUN_AKSES.md)
- [Checklist deploy 2026](docs/KESIAPAN_DEPLOY_2026.md)

## Pengendalian keamanan

- `firestore.rules` sengaja **deny all**. Jangan mengubahnya sebelum aturan hak akses diuji.
- `.env` dan `.env.*` diabaikan Git (kecuali `.env.example`). **Dilarang** menyimpan password, service account private key, ataupun data pegawai di Git.
- `index.html` menampilkan form login DEV yang **nonaktif secara default**. `public/index.html` adalah placeholder statis lama.
- Workflow DEV `auto-deploy-dev-preview.yml` hanya memperbarui **preview anonim**; tidak mendeploy ke live, Firestore, atau Functions. Pengaturan izin cloud telah disiapkan.

## Deploy otomatis preview

Setiap perubahan di cabang `setup/firebase-foundation` akan melewati build dan memperbarui channel preview `matriks-dev` melalui federasi identitas GitHub–Google Cloud. Perubahan operasional/data pegawai tetap memerlukan review terpisah. Lihat [panduan deployment otomatis](docs/DEPLOY_OTOMATIS_GITHUB.md).

## Penanggung jawab

- Pemilik repository: akun GitHub `bpsblora`.
- Pengembangan kode: kolaborator yang ditugaskan secara resmi.
- Pemilik proyek Firebase DEV/PROD: akun Google resmi kantor dan administrator cadangan, setelah persetujuan TI.

## Alur pembaruan

`branch -> pull request -> pemeriksaan -> persetujuan -> merge -> deployment DEV -> uji -> promosi PROD terkontrol`.

Dokumen ini tidak merupakan persetujuan untuk memasukkan data pegawai asli ke layanan cloud.
