# Matriks Pegawai — login username/password di Firebase Spark (gratis)

Tidak perlu **Blaze, Cloud Functions, OTP, atau email pribadi pegawai**. Pengguna
cukup memasukkan **username dan password** yang dibuat oleh Admin. Firebase
Authentication tetap digunakan secara internal agar password tidak disimpan
sebagai teks atau diperiksa hanya dengan JavaScript.

## Komponen yang sudah ditulis

- \`src/publicPreview.js\` — tampilan Login Peran pada website Matriks.
- \`src/sparkRoleAuth.js\` — Firebase Authentication Email/Password untuk akun
  peran, direktori username dan rotasi identitas saat password direset.
- \`src/sparkAccessAdmin.js\` — menu Admin: buat akun, **edit username**,
  centang tim, **reset password**, aktif/nonaktif dan ubah password sendiri.
- \`firestore.spark.rules\` — aturan yang memastikan pengubahan akun hanya
  boleh dilakukan Admin yang aktif. Pembaruan profil dan nama login menggunakan
  *atomic Firestore batch*.
- \`scripts/spark-rules.test.mjs\` — uji aturan di Firestore Emulator.
- \`firebase.spark.json\` — konfigurasi rules dan emulator Spark.
- \`.env.example\` — \`VITE_SPARK_ROLE_AUTH_READY=true\` untuk build prototipe.

**Status:** kode telah disiapkan di GitHub. Aturan role Spark belum dipasang
pada database Firebase yang sebenarnya. \`firestore.rules\` yang berlaku pada
fondasi awal masih *deny-all*. Aktivasi akun sungguhan tetap membutuhkan
pengaturan Firebase Console yang dilakukan pengelola berwenang.

## Aktivasi di Firebase Console (tanpa pembayaran)

1. Buka <https://console.firebase.google.com/project/mkp-bps-blora/overview>.
   Pastikan proyek masih **Spark**; tidak perlu mengaktifkan Blaze.
2. **Authentication → Sign-in method**: aktifkan **Email/Password** (untuk
   akun peran) dan biarkan **Google** aktif (untuk Mode Lihat).
3. **Authentication → Users → Add user**: buat akun Admin pertama dengan
   email internal \`admin@roles.mkp-bps-blora.invalid\` dan password kuat
   berbeda dari password Google. Email internal ini bukan kotak surat dan
   **tidak ditampilkan di antarmuka website**. Catat **UID akun Admin**, bukan
   passwordnya.
4. **Firestore Database → Data**: buat dokumen \`sparkRoleProfiles/{UID Admin}\`
   dengan field:
   - \`username\` (string): \`admin\`
   - \`role\` (string): \`admin\`
   - \`active\` (boolean): \`true\`
   - \`teamIds\` (array): \`[]\`

   Proses ini hanya sekali dan dilakukan dari Firebase Console. Setelahnya,
   akun Ketua Tim dibuat lewat **menu Admin di website**, bukan Console.
5. Pastikan UID Google kantor pada \`firestore.spark.rules\` benar-benar cocok
   dengan akun Google yang ditetapkan sebagai gerbang Mode Lihat. Identitas
   inilah yang boleh melihat direktori username; bukan semua pengguna Google.
6. Jalankan uji emulator terlebih dahulu (lihat bagian berikut), kemudian
   deploy aturan Spark:

   \`\`\`bash
   firebase deploy --only firestore:rules \
     --project mkp-bps-blora --config firebase.spark.json
   \`\`\`

   Deploy hanya aturan Firestore; tidak menjalankan Cloud Functions.
7. Buka website [Matriks Pegawai](https://bpsblora.github.io/matriks-kinerja-pegawai/),
   login Google kantor, klik **Login Peran**, lalu masukkan username \`admin\`
   dan password yang dibuat pada langkah 3.

## Uji aturan di emulator (bukan database kantor)

Dari repo \`bpsblora/matriks-kinerja-pegawai\` pada branch
\`setup/firebase-foundation\`:

\`\`\`bash
npm install --no-save @firebase/rules-unit-testing
npm install -g firebase-tools
firebase emulators:exec --project demo-matriks-spark \
  --config firebase.spark.json --only firestore \
  "node scripts/spark-rules.test.mjs"
\`\`\`

Aturan juga dijadwalkan diperiksa oleh workflow
\`.github/workflows/verify-spark-role-rules.yml\`.

## Ketentuan password baru

Untuk **Tambah Akun Ketua Tim**, **Reset Password**, dan **Ubah Password Saya**:
minimal **6 karakter**, maksimal **72 karakter**, hanya huruf Latin (A–Z, a–z)
dan angka (0–9), wajib memuat paling sedikit satu huruf dan satu angka.
Spasi, tanda baca dan simbol tidak diterima. Password Admin yang sudah dibuat
tetap bisa dipakai untuk login; ketentuan baru hanya berlaku saat password
baru ditetapkan. Gunakan password lebih panjang untuk akun penting.

**Catatan aktivasi:** Jika di menu Admin muncul
`Missing or insufficient permissions`, itu bukan masalah panjang password.
Aturan Firestore sementara hanya mengizinkan akun membaca profilnya sendiri.
Setelah **Firestore Emulator** meluluskan pengujian aturan, pengelola proyek
perlu menerapkan `firestore.spark.rules` khusus akun untuk membuka
pembuatan/edit/reset akun Ketua Tim. Data matriks lain tetap deny-all.

## Perilaku username dan password

| Operasi Admin | Hasil |
|---|---|
| Tambah akun | Username + password awal + tim |
| Edit username | Username baru langsung menjadi nama login; password tetap |
| Edit tim/status | Profil berubah tanpa mengganti username/password |
| Reset password | Admin menetapkan password baru; **username tetap sama**, akses profil akun lama dicabut |
| Nonaktifkan akun | Akun tidak lagi mempunyai izin role di Firestore |
| Ubah password Admin sendiri | Memerlukan password Admin saat ini, langsung dari Authentication |

Tidak ada kolom email pegawai.

### Bagaimana reset password bekerja di Spark?

Firebase Web SDK tidak mengizinkan Admin membaca atau mengganti password
**Auth UID milik orang lain**. Solusi yang dibuat ialah:

1. Admin mengisi password baru melalui menu Reset Password.
2. Firebase Authentication membuat identitas pengganti dengan alamat teknis acak.
3. Firestore melakukan **satu pembaruan atomik**:
   membuat profil peran baru, mengalihkan direktori username yang sama,
   dan menonaktifkan profil peran lama.
4. Ketua Tim login kembali menggunakan **username semula + password baru**.

Akun Auth lama mungkin masih tercatat di Firebase Authentication. Namun profil
lama \`active=false\` sehingga tidak mempunyai akses peran; setiap sesi website
yang masih terbuka dipantau dan dikeluarkan dari Mode Edit. Auth lama dapat
dibersihkan kemudian oleh pengelola Firebase Console jika diperlukan.

### Penting untuk keamanan

- Username dipetakan ke email **internal** acak oleh sistem. Pengguna tidak
  pernah diminta memasukkan email.
- Directory \`sparkRoleHandles\` hanya menyimpan pemetaan username ↔ UID/alias
  Auth tanpa password, dan hanya dapat dibaca akun Google viewer yang
  diotorisasi serta Admin.
- Profil peran dan pemetaan username ditulis bersama dalam transaksi/batch.
  Tidak cukup sekadar menyembunyikan menu di antarmuka.
- Alias \`.invalid\` bukan inbox email; gunakan menu Admin untuk reset password
  Ketua Tim. Untuk pemulihan password Admin pertama, gunakan prosedur
  pengelola Firebase yang tepercaya, bukan tombol publik.
- Di Spark, Firebase Authentication tetap dapat menerima percobaan registrasi
  secara langsung. Akun tanpa profil sah tidak berhak membaca/mengubah data;
  pantau kuota dan penyalahgunaan.
- **Data matriks bersama belum diaktifkan**. Pada tahap ini hanya koleksi
  profil/direktori akun yang disiapkan. Data 2026 masih contoh lokal; migrasi
  alokasi dan kegiatan serta aturannya adalah pekerjaan terpisah.
- Akun Google dan akun peran merupakan dua sesi Firebase di browser. Aturan
  Firestore memvalidasi identitas **akun peran** saja; gerbang Google diterapkan
  oleh website. Ini bukan autentikasi dua faktor yang terjamin server.

Jangan mengunggah password, service account, atau data pegawai asli ke
GitHub maupun chat.
