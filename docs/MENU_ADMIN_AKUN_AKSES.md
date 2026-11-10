# Kelola Akun Akses — Firebase Spark (gratis)

**Arsitektur utama:** Firebase Authentication **Email/Password** dan Cloud Firestore
dengan Security Rules, **tanpa Cloud Functions, tanpa Blaze, dan tanpa pembayaran**.

Panduan aktivasi lengkap: **[SPARK_GRATIS_MATRIKS.md](./SPARK_GRATIS_MATRIKS.md)**.

## Alur pengguna

1. Login Google BPS Blora → **Mode Lihat**.
2. Pilih **Login Peran**, lalu masukkan username dan password akun Firebase
   (username internal dipetakan ke alamat email alias Auth).
3. Firestore memeriksa dokumen `sparkRoleProfiles/{uid}` untuk membaca
   `role`, `active` dan `teamIds`.
4. Setelah akun `admin` terverifikasi, menu **Kelola Akun Akses** tersedia.
5. Admin dapat **membuat akun Ketua Tim**, memilih satu atau lebih tim dengan
   checkbox, mengedit cakupan tim, serta mengaktifkan/nonaktifkan akun.
6. Ketua Tim yang mengetahui password lama dapat menggantinya sendiri melalui
   fasilitas ganti password. **Admin tidak bisa mengatur ulang password orang
   lain dengan Web SDK Spark**; untuk akun yang terlupa password, buat akun
   pengganti dan nonaktifkan akun lama.
7. Logout peran → **Mode Lihat**; akun Google tidak ikut keluar.

## Ketersediaan

- Login Spark dan menu akun sudah ditulis pada
  `src/sparkRoleAuth.js`, `src/sparkAccessAdmin.js`, `src/publicPreview.js`
  serta `src/main.js`.
- Aturan role collection dipersiapkan dalam `firestore.spark.rules`, sedangkan
  `firestore.rules` saat ini **deny-all** untuk mencegah aktivasi diam-diam.
- Admin pertama wajib dibuat dan disahkan melalui **Firebase Console**.
- Website GitHub Pages memuat kode login Spark tetapi belum dapat masuk sebelum
  pengaturan Email/Password, akun pertama dan Firestore Rules selesai.
- Database kegiatan dan data pegawai belum tersinkronisasi; pemindahan data
  dan aturan tiap kegiatan harus dilakukan terpisah.

## Batasan dan keamanan

- Username/password tidak disimpan dalam source, localStorage atau dokumen
  Firestore: hanya Firebase Authentication menyimpan kredensialnya.
- Profil Admin **tidak dapat dibuat oleh pengguna baru**; hanya pengelola
  Firebase Console yang menyiapkan Admin awal.
- Aturan Firestore, bukan sekadar menyembunyikan tombol, yang membatasi aksi.
- Pada Spark, Firebase Auth Email/Password masih dapat menerima permintaan
  registrasi langsung; akun tanpa profil yang ditetapkan Admin tidak punya
  izin membaca/mengubah data. Tetap perlu memantau kuota dan abuse.
- Dua sesi Google dan peran di browser **bukan** autentikasi ganda yang dapat
  diperiksa bersamaan oleh Security Rules tanpa backend khusus.
- Alias `.invalid` tidak memiliki kotak surat untuk pemulihan password.
- Jangan pernah mengubah aturan menjadi `allow read, write: if true` atau
  `allow write: if request.auth != null` pada seluruh database.

**Folder `functions/` dan workflow Blaze lama tidak diperlukan untuk jalur
Spark ini. Jangan menjalankannya untuk mengaktifkan akun.**
