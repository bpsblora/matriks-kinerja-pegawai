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
- Login peran dan **Kelola Akun Akses sekarang memakai jalur Spark**, tanpa Cloud Functions: Firebase Authentication Email/Password untuk kredensial internal dan Firestore Rules untuk izin. Edit username dan Reset Password Ketua Tim tersedia di kode, tetapi aktivasi Firebase Console + pengujian Rules masih diperlukan.
- Firebase Hosting menggunakan hasil build `dist`. Preview `matriks-dev` sudah tersedia; pengaturan Workload Identity Federation GitHub → Firebase telah selesai di Cloud Shell pada 6 November 2026. Workflow `auto-deploy-dev-preview.yml` sedang diuji untuk pembaruan otomatis.

## Integrasi V25 menuju database bersama

Fondasi backend dan antarmuka akun Admin/Ketua Tim/Kepala sudah ditambahkan:
- `src/liveMatrix.js` dan `src/liveMatrix.css`: dashboard peran, Kelola Tim/Pegawai, Pembagian KRO, Input Alokasi, Timeline, Monitoring, Rekonsiliasi, Standar Waktu, Riwayat, dan Finalisasi.
- `functions/matrixApi.js` dan `functions/matrixSchema.js`: API Firestore terproteksi, perubahan atomik, validasi peran/tim, finalisasi Kepala, dan pencatatan audit.
- `functions/bootstrapAdmin.cjs`: pembuatan akun Admin pertama melalui terminal tepercaya.
- `scripts/import-legacy-2026.mjs`: impor PRIVAT seluruh seed data 2026 dari file asli V25 v2.6. Data asli tidak dibundel ke website.
- Endpoint Cloud Functions lama tetap **nonaktif** dan tidak diperlukan untuk login Spark. **Database matriks operasional** masih belum diaktifkan/migrasi; preview GitHub menggunakan referensi anonim dan data lokal.
- [Rincian dan prasyarat operasional](docs/INTEGRASI_OPERASIONAL_V25.md).

## Arah arsitektur

Jalur akun yang dipilih: GitHub Pages/Firebase Hosting → Google BPS Blora (Mode Lihat) → Firebase Authentication Email/Password internal untuk peran → Firestore Security Rules untuk membatasi pembuatan/perubahan akun oleh Admin.

**Tanpa Blaze/Cloud Functions untuk pengelolaan akun.** Data bersama, alokasi dan finalisasi masih tahap terpisah, tidak boleh dianggap aktif sebelum migrasi dan pengujian hak akses.

## Dokumen

- [Aktivasi Spark gratis dan Reset Password via Admin](docs/SPARK_GRATIS_MATRIKS.md)
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

### Pemeriksaan otomatis November 2026

- Koneksi identitas GitHub ke Google Cloud berhasil dibuat tanpa private key JSON.
- Izin Service Usage Viewer telah diberikan kepada akun layanan deployment melalui Google Cloud Shell.
- Perubahan README ini memicu uji ulang workflow preview Firebase pada cabang pengembangan; hasil deployment diperiksa melalui GitHub Actions.
- Channel tetap `matriks-dev` untuk **referensi anonim 2026**, bukan website operasional dengan database pegawai.

## Penanggung jawab

- Pemilik repository: akun GitHub `bpsblora`.
- Pengembangan kode: kolaborator yang ditugaskan secara resmi.
- Pemilik proyek Firebase DEV/PROD: akun Google resmi kantor dan administrator cadangan, setelah persetujuan TI.

## Alur pembaruan

`branch -> pull request -> pemeriksaan -> persetujuan -> merge -> deployment DEV -> uji -> promosi PROD terkontrol`.

Dokumen ini tidak merupakan persetujuan untuk memasukkan data pegawai asli ke layanan cloud.

## GitHub Pages untuk pengujian publik (data anonim)

- Alamat: https://bpsblora.github.io/matriks-kinerja-pegawai/
- Sumber: cabang `setup/firebase-foundation`, workflow `.github/workflows/deploy-github-pages.yml`.
- GitHub Settings > Pages > Source harus `GitHub Actions`.
- Preview membuka V25 Terpadu v2.6 secara langsung tanpa login; data hanya simulasi anonim dan penyimpanan masih lokal di browser.
- Bukan layanan operasional: kode login Spark tersedia, tetapi akun awal dan aturan `firestore.spark.rules` harus disiapkan/deploy serta diuji sebelum login nyata. Penyimpanan matriks masih lokal.
- Setiap push pada cabang ini memicu pemeriksaan prototipe dan deployment ulang GitHub Pages.
