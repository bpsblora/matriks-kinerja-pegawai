# Menu Admin — Kelola Akun Akses

**Status:** tampilan dan endpoint server sudah dibuat, tetapi belum aktif pada Firebase DEV/PROD.

## Alur di aplikasi
1. Pegawai membuka situs dan login dengan Gmail BPS Blora yang disetujui sebagai gerbang Mode Lihat.
2. Untuk pengelolaan, pilih **Masuk dengan Peran**, isikan username/password akun Admin.
3. Backend memverifikasi kredensial dan menerbitkan Firebase UID khusus akun peran.
4. `getAccessContext` memastikan UID aktif dengan peran `admin` sebelum menu ditampilkan.
5. Pada menu **Kelola Akun Akses**, Admin dapat:
   - **Tambah Akun**: username, peran, tim (ketua tim), password awal.
   - **Edit Akun**: ganti username, peran, cakupan tim.
   - **Reset Password**: tetapkan password baru; password sebelumnya tidak bisa ditampilkan.
   - **Aktifkan/Nonaktifkan**: hentikan atau pulihkan izin login.
   - **Muat Ulang**: lihat daftar akun dan status terbaru.
6. Setiap perubahan dicatat pada `auditLogs` oleh backend, bukan dari browser.

## Keamanan
- Form memakai DOM terproteksi; kredensial tidak disimpan di kode, browser storage, atau GitHub.
- Semua endpoint memverifikasi ulang akun Admin dari Firebase Authentication dan profil di Firestore.
- Admin tidak boleh mengedit/menonaktifkan akunnya sendiri melalui menu biasa.
- Akun Kepala dan Admin termasuk **peran sensitif**. Perubahan/kunci ulang peran sensitif diblokir kecuali pengelola mengaktifkan izin tambahan secara eksplisit setelah persetujuan TI.
- Ketua Tim wajib memiliki minimal satu ID tim. Cakupan tim dicatat dan wajib ditegakkan pada seluruh API penulisan.
- Password minimal 12 karakter (bcrypt maksimal 72 byte). Utamakan password panjang dan unik.
- Login, pembuatan akun, dan semua penulisan ke Firestore masih **nonaktif secara default**.
- Pemilik Firebase yang menggunakan Gmail bersama tidak otomatis mendapat peran Admin Matriks karena itu adalah otorisasi terpisah.

## Yang belum selesai sebelum operasional
- Metode *bootstrap* akun Admin pertama secara aman.
- Pengujian Emulator, penanganan revoke token aktif, pembatasan percobaan tingkat IP, App Check, pengaturan durasi sesi, audit lengkap dan backup.
- Aktifkan Cloud Functions dalam paket Blaze setelah mendapat persetujuan biaya.
- Jalankan pengujian pengubahan/penonaktifan pengguna dari dua browser dan akses lintas tim.

Kode:
- `src/adminAccess.js`: tampilan khusus Admin.
- `functions/accessAdmin.js`: API pengelolaan akun berizin.
- `functions/index.js`: pendaftaran API.
