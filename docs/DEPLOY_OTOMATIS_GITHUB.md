# Deployment otomatis preview Firebase melalui GitHub

**Tujuan:** setelah satu kali setup izin deployment, permintaan perubahan ke ChatGPT akan diperbarui di GitHub, dan setiap push ke cabang `setup/firebase-foundation` menjalankan build lalu deploy preview Firebase.

## Yang sudah disiapkan
Workflow `.github/workflows/auto-deploy-dev-preview.yml` akan:
1. Memastikan aturan Firestore tetap deny-all dan dataset demo anonim.
2. Melakukan build Vite di runner GitHub.
3. Memperbarui channel Firebase Hosting `matriks-dev`, bukan channel live, **hanya jika secret koneksi sudah ada**.
4. Memperbarui link yang sama: channel `matriks-dev`; masa berlaku channel diperpanjang dengan deploy baru.
5. **Tidak** mendeploy Cloud Functions, Firestore Rules, maupun data pegawai asli.

## Setup izin satu kali oleh pemilik Firebase
Perintah di Google Cloud Shell (dalam folder repo):
```bash
cd ~/matriks-kinerja-pegawai
git pull --ff-only
firebase init hosting:github
```
Ikuti wizard Firebase resmi:
- Pilih repo privat `bpsblora/matriks-kinerja-pegawai`.
- Izinkan akun GitHub `bpsblora` dan akun Google pemilik Firebase pada antarmuka resmi.
- Jika diminta proyek Firebase: `mkp-bps-blora`.
- **Jangan setujui otomatis deploy ke live ketika PR di-merge**. Pilih **No**.
- Jika menawarkan pembuatan workflow tambahan, biarkan wizard selesai; **jangan commit atau push workflow baru** sebelum ditinjau karena repo sudah memiliki workflow khusus preview.
- Wizard biasanya otomatis menyiapkan service account deployment dan GitHub Actions repository secret `FIREBASE_SERVICE_ACCOUNT_MKP_BPS_BLORA`. Cek di GitHub Settings > Secrets and variables > Actions > Repository secrets; **hanya cek nama, jangan kirim nilainya atau JSON service account**.
- Wizard dapat menambahkan file workflow lokal; kirim status `git status --short` (tidak ada token/password) untuk pemeriksaan jika ada perubahan.

## Jika wizard tidak berhasil
Pengelola TI dapat menyiapkan autentikasi GitHub Actions dengan Workload Identity Federation, alur tanpa service-account JSON, melalui workflow manual `deploy-dev-preview.yml`. Alternatif ini memerlukan konfigurasi role IAM dan variabel repo.

## Setelah secret tersedia
ChatGPT dapat mengubah file di branch pengembangan `setup/firebase-foundation`. Tiap commit otomatis memicu Github Actions workflow **Auto-update Firebase Matriks DEV Preview**. Hasilnya tetap preview, bukan website utama.

**Penting:** jangan menjalankan `firebase deploy` tanpa `--only hosting` dan tanpa review, jangan memasukkan data pegawai asli ke proyek DEV `nam5`, dan jangan merge draft PR ini sebelum backend/izin siap.

Referensi resmi: https://firebase.google.com/docs/hosting/github-integration
