# Uji login Google tahap awal — Matriks Pegawai DEV

## Kondisi yang sudah dipastikan
- Firebase Project: `mkp-bps-blora` (khusus pengembangan / DEV).
- Firebase Authentication provider Google: **Enabled**.
- Firestore `(default)` sudah dibuat pada region `nam5` dan masih kosong.
- Firestore Rules yang aktif (menurut pengguna) adalah **deny all**:
  `allow read, write: if false`.
- Prototipe Matriks Pegawai v2.6 asli **belum** dipindah ke frontend ini.

## A. Uji login di komputer Windows (belum mengunggah website)
1. Siapkan Node.js LTS dari sumber resmi dan Git, lalu jalankan `node --version` dan `npm --version`.
2. Clone repository privat dari akun kolaborator:
   `git clone https://github.com/bpsblora/matriks-kinerja-pegawai.git`
3. Masuk folder dan checkout cabang kerja:
   `cd matriks-kinerja-pegawai`
   `git fetch origin`
   `git switch setup/firebase-foundation`
4. `copy .env.example .env.local` dari Command Prompt, atau `Copy-Item .env.example .env.local` dari PowerShell.
5. `npm install` lalu `npm run dev`. Terminal menunjukkan alamat lokal, biasanya `http://127.0.0.1:5173`.
6. Jika Firebase menolak domain dengan `auth/unauthorized-domain`, buka Firebase Console > Authentication > Settings > Authorized domains dan tambahkan domain lokal yang benar (`127.0.0.1` atau `localhost`) **khusus DEV** sesuai alamat yang dipakai untuk menguji; jangan izinkan domain yang tidak dikenal. Karena proyek dibuat setelah 28 April 2025, localhost mungkin tidak ada secara default.
7. Klik tombol **Masuk dengan Google** menggunakan akun uji individual. Di layar akan tampil email dan UID Firebase Authentication dari akun itu.

### Hasil yang benar untuk percobaan awal
- Login Google berhasil dan UID terlihat.
- Pemeriksaan ke `users/{uid}` menghasilkan pesan **Akses Firestore masih ditutup**.
- Tidak ada dokumen baru, data pegawai, ataupun izin role yang dibuat sendiri oleh pengguna.
- Gunakan tombol **Keluar** untuk mengakhiri sesi.

## B. Langkah berikutnya setelah uji login

**Jangan langsung menerbitkan `firestore.auth-phase.rules` sebagai aturan produksi.** File ini adalah kandidat aturan tahap uji baca profil sendiri, bukan aturan semua data Matriks.

Setelah ditinjau TI dan diuji dengan Firebase Emulator, pengelola data dapat:
1. Membuat satu profil uji `users/{uid}` lewat Firebase Console/administrator tepercaya (bukan ditulis dari browser).
2. Isi data fiktif saja, misalnya `active: true`, `role: "admin"` untuk akun uji yang telah diverifikasi. Jangan membagikan UID, email, atau data pribadi di commit GitHub.
3. Tinjau dan uji aturan kandidat `firestore.auth-phase.rules` dengan Emulator: baca profil sendiri berhasil, baca profil orang lain ditolak, daftar users ditolak, seluruh penulisan ditolak, kegiatan/KRO/alokasi masih ditolak.
4. Jika semua lolos, barulah admin menyebarkan aturan terbatas itu di Firebase DEV dan menguji status akses.

**CATATAN:** tampilan role pada frontend semata informasi; izin sebenarnya harus dipaksakan oleh Rules/server. Dalam kandidat Rules, role tidak membuka hak baca/tulis data matriks.

## C. Yang belum dilakukan
- Belum ada deploy Firebase Hosting atau GitHub Actions deploy.
- Belum ada login bersama untuk operasional atau migrasi `localStorage`.
- Belum ada pengaturan Hak Akses Kepala, Admin, Ketua Tim dan Pegawai yang lengkap.
- Belum ada data kantor nyata di Firestore.
- Jangan merge PR draft ke `main` sampai hasil pemeriksaan dan persetujuan tersedia.

Dokumentasi Firebase: https://firebase.google.com/docs/auth/web/google-signin dan https://firebase.google.com/docs/firestore/security/test-rules-emulator
