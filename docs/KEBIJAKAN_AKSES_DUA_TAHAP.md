# Keputusan Akses Dua Tahap — Matriks Kinerja Pegawai BPS Blora

Tanggal: 6 November 2026. **Desain disepakati secara konseptual; belum deploy, belum operasional.**

## Kebutuhan pengguna
1. Seluruh pegawai tidak perlu didata alamat Gmail masing-masing.
2. Masuk menggunakan **satu akun Google kantor** yang ditetapkan untuk *Mode Lihat*.
3. Setelah Google berhasil, tampilkan matriks yang telah diizinkan dibaca, tanpa izin mengubah.
4. Pengguna yang ingin mengubah data masuk lagi dengan username/password sesuai fungsi:
   - `katim_<tim>`: Ketua Tim untuk tim tertentu.
   - `admin`: pengelolaan struktural Matriks, dengan pembatasan perubahan sensitif.
   - `kepala`: persetujuan/finalisasi.
5. Saat keluar dari Mode Pengelola, sesi editor harus ditutup; untuk kembali ke Mode Lihat pengguna bisa masuk Google lagi. Tidak ada hak akses tambahan dari pilihan tombol saja.

## Pengamanan yang tidak boleh dilewati
- **Jangan membagikan sandi Gmail pemilik Firebase/Google Cloud** ke seluruh pegawai. Akun tersebut memiliki kontrol terhadap infrastruktur dan data. Jika alur memakai akun Google bersama, gunakan **akun Google terpisah khusus *viewer*** yang TIDAK mempunyai peran Owner/Editor maupun akses Firebase Console.
- Alternatif kantor yang paling aman adalah SSO individual atau akun personal; tetapi permintaan ini sengaja tidak mensyaratkan daftar Gmail pegawai.
- Karena satu akun Google digunakan bersama, *Mode Lihat* tidak bisa mengaudit pembaca berdasarkan orang. Username/password `admin`, `kepala`, atau `katim_<tim>` yang dipakai bergantian juga hanya menunjukkan **identitas akun peran**, bukan individu yang melakukan perubahan.
- Akun kepala dan admin tidak boleh memakai password literal `kepala`/`admin`; password kuat ditentukan admin, disimpan sebagai hash server-side, dan dapat dirotasi.
- Tidak boleh ada satu akun `katim` global yang otomatis bisa mengubah semua tim. Jika perlu, buat kredensial Ketua Tim **per tim** dengan batas `teamIds` yang disetujui.
- Pemberian hak edit tidak boleh dilakukan dari `localStorage`, pilihan peran UI, atau custom claim pada UID Google viewer. **Satu UID Google viewer tidak pernah diangkat menjadi Admin secara global.**
- Pada login tahap dua, server memverifikasi bahwa pemanggil adalah **UID Google viewer yang ditentukan** dengan email terverifikasi, baru memvalidasi username dan password peran.
- Setelah berhasil, server mengeluarkan Firebase Custom Token untuk UID akun peran (berbeda dari UID viewer). Browser mengganti sesi Firebase. Aturan Firestore/backend wajib membatasi role+tim. Keluar dari peran = signOut; masuk Google lagi untuk Mode Lihat.
- Sesi peran istimewa harus dibatasi durasinya, diamankan pada komputer bersama, bisa dicabut, serta dicatat di audit log. Konfigurasi expiry/rotasi masih diperlukan.
- Mode Lihat hanya mengizinkan membaca **dataset/snapshot yang memang boleh dilihat**, bukan setiap koleksi internal (credential, user profile, audit atau data sensitif).
- Pemilik cloud dan pengelola TI harus menyetujui lokasi PROD, pengelolaan data, akun bersama serta biaya Cloud Functions sebelum deployment.

## Keadaan kode DEV sekarang
- `src/main.js`: form Google dan *Mode Lihat*, lalu form `username/password` peran.
- `VITE_VIEWER_GOOGLE_UID`: UID yang menentukan akun viewer; belum diisi.
- `VITE_ROLE_AUTH_READY=false`: login peran **belum dapat digunakan**.
- `functions/index.js`: login peran menolak permintaan kecuali `AUTH_LOGIN_ENABLED=true` DAN pemanggil login sebagai akun Google viewer dengan UID `VIEWER_GOOGLE_UID` yang sudah ditentukan di backend.
- `firestore.rules`: masih **deny-all** sehingga **belum ada data yang bisa dilihat maupun diubah** di aplikasi.
- Migrasi seluruh fitur Matriks v2.6 belum dilakukan.
- Belum ada deployment, user role aktif, atau credential nyata.

## Pekerjaan berikutnya yang wajib
1. Persetujuan TI untuk akun viewer khusus non-admin dan cloud.
2. Bootstrap akun role melalui backend tepercaya (bukan akun yang dibuat sendiri dari browser).
3. Uji dua tahap login, pengamanan brute-force, App Check, timeout sesi dan penghapusan akses.
4. Desain snapshot read-only untuk Mode Lihat, dengan filter tahun/status final dan perlindungan data pribadi.
5. Uji *Firestore Rules* lewat emulator: viewer hanya snapshot; katim hanya timnya; admin/kepala hanya kewenangannya; tidak ada akses credential langsung.
6. Pengaturan Firebase Blaze dan identitas deployment GitHub Actions hanya dengan persetujuan pengelola; jangan menyimpan service account secret di repo.
7. Deploy DEV dengan data fiktif, baru uji, lalu siapkan PROD sesuai lokasi yang disetujui kantor.

Rujukan teknis:
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/admin/create-custom-tokens
- https://firebase.google.com/docs/rules/rules-and-auth
