# Kebijakan Identitas dan Akses — Matriks Kinerja Pegawai BPS Blora

## Keputusan
- Hanya **akun email resmi BPS Blora** yang telah disetujui administrator yang boleh menggunakan aplikasi.
- Akun Google/Gmail kantor yang mengelola proyek Firebase **bukan akun login bersama seluruh pegawai**.
- Setiap pegawai harus memiliki identitas akun sendiri. Aplikasi akan memetakan pengguna ke **Firebase UID**, alamat email resmi terverifikasi, status aktif, serta peran dan tim.
- Peran: `kepala`, `admin`, `ketua_tim`, `pegawai`. Perubahan peran hanya dilakukan melalui proses admin tepercaya dan tercatat di audit log.
- Tidak ada hak akses yang diberikan semata karena pengguna berhasil menekan tombol **Masuk dengan Google**.
- Belum ditentukan alamat/domain email resmi yang diizinkan. Jangan menganggap semua akun `@gmail.com` atau seluruh akun dalam satu domain otomatis berhak akses.

## Usulan skema profil untuk fase berikutnya

`users/{firebaseUid}` (dibuat/diedit admin, **bukan klien**) dengan field:
- `email`: email resmi yang telah diverifikasi
- `active`: boolean, disetujui/ditolak admin
- `role`: salah satu peran yang diizinkan
- `employeeId`: ID internal sesuai daftar pegawai
- `teamIds`: daftar tim yang boleh diakses sesuai role
- `createdAt`, `updatedAt`, `approvedBy`: audit metadata

**Prinsip minimum:** untuk setiap pembacaan atau perubahan data operasional, Firestore Security Rules / Cloud Functions harus memeriksa identitas terautentikasi, email terverifikasi, UID yang tercatat aktif, dan izin peran terhadap objek yang diminta.

## Jika pegawai hanya memiliki satu Gmail kantor bersama
Satu identitas Google yang digunakan banyak orang **tidak bisa dijadikan dasar pembagian hak akses per pegawai** dan tidak memberikan audit siapa yang mengubah data. Jangan berbagi sandi atau menganggap pilihan peran di UI sebagai pengganti identitas.

Alternatif yang perlu dipilih dengan persetujuan kantor:
1. Sediakan satu identitas Google organisasi untuk tiap pegawai (disarankan); atau
2. Gunakan penyedia identitas kantor lainnya yang dapat diintegrasikan dengan Firebase melalui mekanisme tepercaya.

## Kondisi keamanan saat ini
- Proyek `mkp-bps-blora` hanya untuk pengujian dengan data anonim.
- Firestore aktif tetap `allow read, write: if false` (deny all).
- Halaman uji login Google baru menampilkan UID dan mencoba membaca profil; tidak membuat peran atau membuka data.
- File kandidat aturan `firestore.auth-phase.rules` **belum diterapkan**. Jangan mengubah Rules tanpa pengujian Emulator dan tinjauan TI.
- Antarmuka Matriks v2.6 belum diintegrasikan.

## Konfirmasi yang masih diperlukan sebelum implementasi izin resmi
- Apakah setiap pegawai mempunyai email kantor **masing-masing**?
- Apakah alamatnya menggunakan domain resmi yang sama atau beberapa domain?
- Apakah alamat tersebut dapat digunakan pada Google Sign-In, atau perlu penyedia SSO lain?
- Siapa administrator yang menetapkan dan menonaktifkan akun/peran?

Jangan mengunggah daftar email pegawai, hasil ekspor data, atau password ke GitHub.
