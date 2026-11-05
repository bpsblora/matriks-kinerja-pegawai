# Langkah berikutnya setelah registrasi Firebase Web App

Proyek Firebase DEV sudah dibuat dan konfigurasi SDK Web dicatat di `.env.example`:
- Project ID: `mkp-bps-blora`
- Web app: `1:154312194111:web:e5c5512c09e0436601608a`
- Google Authentication: provider Google **Enabled** (terverifikasi dari tangkapan layar pengguna).
- Database `(default)`: **tersedia, Firestore Native Standard di lokasi `nam5` (Amerika Serikat)** berdasarkan daftar database Google Cloud tanggal 6 November 2026.

**Status:** proyek ini hanya untuk DEV dengan **data simulasi anonim**. Backend login/whitelist, role-based rules, database operasional dan deployment masih belum selesai.

## Keputusan lokasi database untuk DEV dan PROD

- JANGAN membuat database `(default)` kedua. Error `Database already exists` menandakan database ini sudah ada.
- Lokasi database `nam5` **tidak bisa diubah langsung**. Jangan mencoba menghapus atau membuat ulang database tanpa rencana dan persetujuan TI.
- Karena paket Spark hanya menyediakan **satu database gratis per proyek**, gunakan `mkp-bps-blora` di `nam5` **khusus untuk pengembangan dengan data fiktif**.
- Setelah disetujui pengelola TI, untuk penggunaan data pegawai nyata buat **proyek Firebase PROD terpisah** dan tentukan lokasi Jakarta (`asia-southeast2`) sejak awal. Aturan lokasi/penempatan data kedinasan wajib diverifikasi oleh kantor.
- Jangan menambahkan database berbayar ke proyek ini atau mengubah paket Spark tanpa persetujuan.
- Rujukan: https://firebase.google.com/docs/firestore/pricing dan https://firebase.google.com/docs/firestore/locations

## 1. Verifikasi Firestore yang sudah ada
1. Buka Google Cloud Console > Firestore > All databases; pastikan `(default)` muncul dengan status aktif.
2. Di Firebase Console, reload halaman Cloud Firestore; buka database `(default)`. Periksa tab Rules.
3. Pastikan aturan klien masih tertutup (seperti `firestore.rules` di repo: `allow read, write: if false`). Bila Rules berbeda, jangan masukkan data, dan gunakan Firebase Console untuk menetapkan aturan tertutup.
4. Jangan buat koleksi data pegawai asli, karena izin pengguna dan keamanan belum dikonfigurasi.

## 2. Pengaturan identitas
Login Google sudah Enabled. Tahap berikutnya adalah menyiapkan pemeriksaan whitelist UID Firebase Authentication, status pengguna dan peran (Kepala, Admin, Ketua Tim, Pegawai). **Login Google saja tidak cukup** untuk mengizinkan akses Firestore. Uji aturan Firestore sebelum memublikasikan antarmuka.

## 3. Pastikan keamanan API key
Firebase Web API key adalah penanda proyek, bukan rahasia admin. Di Google Cloud Console > APIs & Services > Credentials, verifikasi API key dibatasi untuk API Firebase yang dibutuhkan; jangan tambahkan Gemini/Generative Language API pada kunci web ini.
Jangan memasukkan service account private key ataupun OAuth client secret ke GitHub.

## 4. Tahap pengembangan setelah konfigurasi console
- Siapkan frontend dengan bundler (Vite), pasang `firebase` sebagai dependensi.
- Copy `.env.example` menjadi `.env.local` pada komputer pengembang.
- Import `auth` dan `db` dari `src/firebase/client.js`.
- Buat halaman login Google serta pemeriksaan whitelist UID dan status aktif.
- Susun hak akses per peran (Kepala, Admin, Ketua Tim, Pegawai) dan uji Security Rules dengan Emulator.
- Migrasikan modul v2.6 dari `localStorage` ke Firestore bertahap memakai data uji anonim.
- Setelah pengujian dan persetujuan TI, aktifkan Hosting serta GitHub Actions deployment.

**Belum siap untuk dipakai secara operasional.**
