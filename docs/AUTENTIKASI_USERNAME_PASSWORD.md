> **Perubahan keputusan (6 November 2026):** Pengguna memilih **Google BPS Blora untuk Mode Lihat, ditambah login username/password akun peran bila perlu mengubah data**. Panduan utama saat ini adalah [KEBIJAKAN_AKSES_DUA_TAHAP.md](KEBIJAKAN_AKSES_DUA_TAHAP.md). Dokumen berikut merekam fondasi backend yang masih dapat digunakan untuk **login tahap kedua**, bukan login langsung pegawai. Akun Google pemilik Firebase tidak boleh dibagikan sebagai akun viewer.

# Backend Username dan Password Peran — Autentikasi Tahap Kedua

**Status: rancangan teknis DEV, BELUM DIAKTIFKAN.** Jangan masukkan password asli ke repository/ChatGPT dan jangan melakukan deploy Cloud Functions sampai disetujui pengelola TI.

## Arsitektur yang disepakati
- Akun Google viewer kantor: gerbang Mode Lihat (bukan pemilik Firebase).
- Pengelola memakai **username/password akun peran** (katim per tim, admin atau kepala), tanpa mendata Gmail tiap pegawai. Akun peran yang dipakai bersama tidak dapat mengidentifikasi orang secara individual.
- Setelah masuk sebagai viewer Google, frontend memanggil Cloud Function `usernameSignIn` untuk memverifikasi username/password peran di sisi server. Backend juga mewajibkan UID viewer yang disetujui.
- Jika benar, Firebase Admin SDK menandatangani **custom token** UID unik. Frontend memanggil `signInWithCustomToken` untuk membuka sesi Firebase.
- Seluruh akses Firestore dikontrol dengan Rules dan/atau backend yang memeriksa UID, status aktif, keanggotaan tim serta peran. Dropdown peran di browser tidak bisa memberikan akses.
- Peran: `kepala`, `admin`, `ketua_tim`, `pegawai`.
- Audit log tindakan harus mencatat UID, target, waktu server, perubahan lama/baru yang diizinkan, dan tahun.

## Yang sudah diimplementasikan sebagai fondasi
- `functions/index.js`: endpoint callable `usernameSignIn` yang memeriksa credential/hash dan profil.
- `functions/security.js`: validasi username/password serta peran.
- `functions/security.test.js`: unit test untuk aturan validasi.
- `src/main.js`: form username/password menggantikan login Google bersama.
- `src/firebase/client.js`: koneksi Functions pada region DEV.
- `VITE_VIEWER_GOOGLE_UID` belum diisi dan `VITE_ROLE_AUTH_READY=false`, sehingga **login role masih nonaktif**.
- Backend login juga hanya aktif jika `AUTH_LOGIN_ENABLED=true` disetel secara sengaja oleh operator setelah audit keamanan.
- `firestore.rules` tetap **deny all**. Tidak boleh otomatis mengubahnya untuk menyalakan login.

## Model data backend — belum ada akun riil
Dokumen credential (hanya Firebase Admin SDK dapat membaca):
`authCredentials/{hash(username)}`
- `uid`: UID akun Firebase Auth yang unik
- `passwordHash`: hasil **bcrypt** dari password unik, bukan password asli
- `disabled`: apakah credential dinonaktifkan

Profil pengguna:
`users/{uid}`
- `username`: username normalisasi
- `active`: status diizinkan
- `role`: peran (kepala/admin/ketua_tim/pegawai)
- `employeeId`: identitas internal pegawai
- `teamIds`: tim yang boleh diakses sesuai penetapan

`authThrottle/{hash(username)}` mencatat batas percobaan login (DEV). Jangan membuat koleksi manual pada proyek dengan data nyata.

## Pekerjaan wajib sebelum login boleh diaktifkan
1. **Persetujuan TI dan pengelola proyek** atas identitas pegawai, penempatan cloud, penggunaan layanan berbayar, dan kontrol keamanan.
2. **Aktifkan Blaze hanya jika disetujui.** Firebase Cloud Functions tidak tersedia untuk deployment pada Spark; Blaze memiliki kuota bebas biaya tertentu namun dapat menimbulkan tagihan.
3. Siapkan server-side **provisioning Admin**: hanya admin resmi yang boleh membuat akun baru, mengatur/menonaktifkan peran, menyetel ulang password. Tidak ada pendaftaran mandiri dari browser.
4. Siapkan **bootstrap Admin pertama** melalui metode administrator tepercaya, bukan memilih role Admin di halaman login.
5. Tambahkan perlindungan brute force di seluruh IP/pengguna, App Check, audit akses, dan pemulihan akun. Pembatasan 5 percobaan per username dalam prototipe **belum cukup untuk produksi**.
6. Uji Cloud Functions + Rules di emulator dan uji peran, pergantian password, pencabutan akun serta akses lintas tim.
7. Baru setelah validasi, deploy ke lingkungan DEV `mkp-bps-blora`, bukan ke produksi.
8. Proyek PROD terpisah perlu pemilihan region Jakarta dan izin penggunaan data kedinasan.

## Catatan untuk pengelola
- Jangan pernah memberikan password Gmail kantor kepada pegawai untuk masuk website.
- **Tidak ada password pegawai yang dibuat atau diunggah pada commit ini.**
- Jangan berikan izin Firestore hanya berdasarkan `request.auth != null`; cek status, peran, kepemilikan dan tim dengan Rules yang telah diuji.
- Ketika akun dinonaktifkan, revokasi sesi lama perlu dijalankan dan akses segera dicabut berdasarkan data aktif.
- Penyimpanan token sesi dan masa sesi juga perlu ditinjau untuk komputer yang dipakai bersama.
- Untuk penggunaan produksi, pertimbangkan MFA bagi Kepala dan Admin.

## Referensi resmi
- https://firebase.google.com/docs/auth/admin/create-custom-tokens
- https://firebase.google.com/docs/auth/web/custom-auth
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://firebase.google.com/docs/rules/rules-and-auth
