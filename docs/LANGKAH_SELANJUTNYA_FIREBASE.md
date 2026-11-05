# Langkah berikutnya setelah registrasi Firebase Web App

Proyek Firebase DEV sudah dibuat dan konfigurasi SDK Web dicatat di `.env.example`:
- Project ID: `mkp-bps-blora`
- Web app: `1:154312194111:web:e5c5512c09e0436601608a`

**Status:** hanya konfigurasi dan modul inisialisasi SDK; belum aktif login, belum ada data bersama, dan belum ada deployment.

## 1. Aktifkan Google Authentication
Firebase Console > Build > Authentication > Get started > Sign-in method > Google > Enable > pilih email dukungan proyek > Save.

Di tab Settings > Authorized domains, periksa domain Firebase Hosting yang akan dipakai. Untuk pengujian localhost, tambahkan `localhost` secara eksplisit apabila diperlukan; proyek baru tidak selalu menyertakannya.

Tidak perlu membuat akun untuk semua pegawai sekarang. Setelah login Google tersedia, setiap pengguna perlu diizinkan melalui daftar UID dan peran yang diperiksa pada Security Rules dan tindakan server, bukan hanya di antarmuka.

## 2. Siapkan Firestore DEV
Firebase Console > Build > Firestore Database > Create database > **Production mode**.
Region `asia-southeast2` (Jakarta) boleh dipilih hanya setelah dipastikan sesuai kebijakan data kantor.
Jangan masukkan data pegawai asli.
Aturan `firestore.rules` di repository masih `allow read, write: if false` sebagai default tertutup.

## 3. Pastikan keamanan API key
Firebase Web API key adalah penanda proyek, bukan rahasia admin. Di Google Cloud Console > APIs & Services > Credentials, verifikasi API key dibatasi untuk API Firebase yang dibutuhkan; jangan tambahkan Gemini/Generative Language API pada kunci web ini.
Jangan memasukkan service account private key ataupun OAuth client secret ke GitHub.

## 4. Tahap pengembangan setelah konfigurasi console
- Siapkan frontend dengan bundler (Vite), pasang `firebase` sebagai dependensi.
- Copy `.env.example` menjadi `.env.local` pada komputer pengembang.
- Import `auth` dan `db` dari `src/firebase/client.js`.
- Buat halaman login Google serta pemeriksaan whitelist UID dan status aktif.
- Susun hak akses per peran (Kepala, Admin, Ketua Tim, Pegawai) dan uji Security Rules dengan Emulator.
- Migrasikan modul v2.6 dari `localStorage` ke Firestore bertahap.
- Baru setelah pengujian dan persetujuan TI, aktifkan Hosting serta GitHub Actions deployment.

**Belum siap untuk dipakai secara operasional.**
