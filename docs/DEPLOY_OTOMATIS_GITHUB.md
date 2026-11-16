# Otomatisasi Firebase Preview: tanpa login localhost dan tanpa kunci JSON

Konfigurasi otomatis memakai **Google Workload Identity Federation (OIDC)**, bukan `firebase init hosting:github`, yang dapat gagal akibat OAuth callback localhost di Cloud Shell.

## Setup hanya sekali
Masuk ke Google Cloud Shell dengan akun pengelola proyek dan GitHub CLI `bpsblora` yang sudah terautentikasi. Pada direktori repo:

```bash
cd ~/matriks-kinerja-pegawai
git pull --ff-only
bash scripts/setup-github-preview-wif.sh
```

Script menjelaskan perubahan dan meminta konfirmasi **LANJUT**:
- Memastikan project aktif `mkp-bps-blora`.
- Mengaktifkan API IAM, IAM Credentials, Security Token Service.
- Membuat Workload Identity Pool `matriks-github-preview`, dengan provider `repo-branch` yang **hanya** menerima token repo `bpsblora/matriks-kinerja-pegawai` pada ref `refs/heads/setup/firebase-foundation`.
- Membuat service account `matriks-gh-preview@mkp-bps-blora.iam.gserviceaccount.com`.
- Memberi peran Firebase Hosting Admin dan API Keys Viewer; tidak memberi akses Firestore/Admin/Cloud Functions.
- Mengizinkan provider impersonation dan menyimpan 2 variabel GitHub:
  `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT`.
- Tidak membuat atau mengunggah file JSON private key, OAuth code, maupun password.

## Penggunaan setelah setup
1. Pengguna menyampaikan revisi di chat.
2. ChatGPT mengubah kode di branch `setup/firebase-foundation`.
3. GitHub Actions workflow `.github/workflows/auto-deploy-dev-preview.yml` menjalankan build dan, setelah koneksi tersedia, memperbarui channel `matriks-dev` di Firebase.
4. Link preview lama masih bisa dipakai (perhatikan kedaluwarsa diperpanjang 7 hari per deployment).

GitHub Actions **tidak akan deploy ke live**, tidak menulis Rules/Firestore dan tidak mengaktifkan fungsi login peran. Semua data preview tetap anonim.

## Jika ada error
- `PERMISSION_DENIED`: akun GCP mungkin tidak punya izin membuat IAM Pool/Service Account atau mengubah IAM. Hubungi admin GCP.
- `gh: not logged in`: jalankan `gh auth status` dan periksa login GitHub bpsblora.
- Jika workflow tidak memicu setelah commit, periksa tab GitHub Actions dan pengaturan eksekusi untuk branch PR.
- Jangan gunakan kembali callback localhost `firebase init hosting:github` untuk Cloud Shell tanpa port forwarding.

Rujukan:
- https://github.com/google-github-actions/auth
- https://firebase.google.com/docs/projects/iam/roles-predefined-product
