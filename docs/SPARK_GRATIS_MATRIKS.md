# Matriks Pegawai di Firebase Spark — tanpa Blaze atau Cloud Functions

**Tujuan:** login Google BPS Blora untuk melihat prototipe, login username/password
peran melalui **Firebase Authentication Email/Password**, dan akun Ketua Tim
dikelola Admin melalui **Firestore Security Rules**. Tetap pada paket Spark
tanpa menghubungkan rekening atau mengaktifkan fungsi server berbayar.

## Keadaan kode

- Frontend GitHub Pages: `src/publicPreview.js`, `src/sparkRoleAuth.js`,
  `src/sparkAccessAdmin.js`, `src/adminAccess.css`.
- Firestore Rules ketat disiapkan di `firestore.spark.rules` (belum dideploy).
- Rilis awal hanya membuka koleksi `sparkRoleProfiles` untuk peran; **seluruh
  database kegiatan/pegawai tetap tertutup**. Tampilan 2026 masih prototipe
  lokal, **belum tersinkronisasi antarpengguna**.
- Cloud Functions dan akun layanan tidak diperlukan untuk login peran Spark.
  Kode lama `functions/` adalah arsip jalur Blaze, tidak perlu dijalankan.

## Aktivasi Firebase Console — tetap di Spark

1. Buka <https://console.firebase.google.com/project/mkp-bps-blora/overview>.
2. Pastikan proyek masih **Spark**; jangan menambahkan metode pembayaran.
3. **Build → Authentication → Sign-in method**: aktifkan **Email/Password**
   (untuk akun peran) dan biarkan **Google** aktif.
4. **Firestore Database**: buat database jika belum tersedia, pada lokasi
   yang disetujui. Jangan pilih aturan publik/allow-all.
5. Buka **Authentication → Users → Add user**. Buat akun Admin pertama:
   - Email internal untuk Firebase Auth: `admin@roles.mkp-bps-blora.invalid`
   - Password baru panjang dan unik (minimal 12 karakter), **berbeda dari
     password Google**. Jangan kirimkan password ke chat/GitHub.
   - Catat **UID** Firebase Auth akun Admin (bukan password).
6. Di **Firestore Database → Data**, buat koleksi `sparkRoleProfiles` dan
   dokumen dengan ID **UID Admin** tersebut, berisi field:
   `username` (string) = `admin`;
   `role` (string) = `admin`;
   `active` (boolean) = `true`;
   `teamIds` (array) = `[]`.
   Dokumen bootstrap pertama hanya dibuat oleh pengelola proyek melalui
   Console, **bukan formulir publik**.
7. Uji aturan di emulator, lalu deploy dari repo dengan Firebase CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   git clone --branch setup/firebase-foundation https://github.com/bpsblora/matriks-kinerja-pegawai.git
   cd matriks-kinerja-pegawai
   firebase deploy --only firestore:rules --project mkp-bps-blora --config firebase.spark.json
   ```
8. Build GitHub Pages dengan `VITE_SPARK_ROLE_AUTH_READY=true`. Jangan
   mengaktifkan `VITE_ROLE_AUTH_READY` (Cloud Functions), `VITE_ACCESS_ADMIN_READY`,
   atau `VITE_MATRIX_BACKEND_READY` hanya untuk menguji login Spark.

## Cara kerja

- Google kantor tetap login di Firebase Auth utama; setelah itu **Mode Lihat**.
- Tombol **Login Peran** meminta username/password. Contoh: `admin`.
- Client mengubah username menjadi alias Auth internal secara deterministik,
  lalu masuk menggunakan Firebase Authentication Email/Password pada **auth
  instance terpisah**. Password tidak disimpan di browser/localStorage.
- Akses Admin ditentukan dari dokumen `sparkRoleProfiles/{uid}`, **bukan**
  sekadar kode JavaScript. Firestore Rules memeriksa Admin aktif sebelum
  mengizinkan pembuatan/perubahan akun Ketua Tim.
- Admin menambahkan Ketua Tim dengan username/password awal, memilih tim
  menggunakan checkbox, atau menonaktifkan akunnya.
- Pemegang akun yang masih mengetahui password lama dapat menggunakan
  **Ubah Password Saya**. Admin tidak dapat membaca atau mengganti password
  milik orang lain dengan Web SDK tanpa backend khusus.

## Batasan Spark yang harus dipahami

1. Email alias `.invalid` adalah identitas internal Auth, **bukan inbox email**.
   Jika password terlupa, Admin dapat membuat akun pengganti dengan username
   baru lalu menonaktifkan akun lama; tidak tersedia email reset untuk alias itu.
2. Firebase Email/Password melalui SDK Web tetap memungkinkan permintaan
   pendaftaran akun dari client. Orang di luar website bisa mencoba membuat
   akun Auth kosong, tetapi **tanpa dokumen profil yang dibuat Admin tidak
   memiliki akses Firestore**. Tetap pantau penyalahgunaan/kuota Auth.
3. **Google login dan password peran adalah dua sesi berbeda di browser.**
   Firestore Rules memverifikasi **akun peran**, bukan dua akun secara
   bersamaan. Gerbang Google tetap berlaku di antarmuka, bukan bukti
   autentikasi ganda di aturan database.
4. Fitur operasional matriks bersama (alokasi, persetujuan, audit, status
   tahunan) perlu aturan Firestore dan migrasi data terpisah. Jangan membuka
   `allow write: if request.auth != null` pada seluruh database.
5. Firestore gratis memiliki kuota harian. Jika terlampaui pada Spark,
   layanan tersebut berhenti sampai kuota pulih; tidak ada tagihan otomatis.

**Jangan mengirimkan password, API admin, atau berkas service account ke chat.**
