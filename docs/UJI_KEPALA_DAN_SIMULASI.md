# Uji akun Kepala BPS dan data simulasi Matriks Pegawai

## Implementasi

Cabang sumber aplikasi: `setup/firebase-foundation`. Admin bisa membuat akun
`ketua_tim` maupun `kepala` di menu **Kelola Akun Akses**. Kata sandi tetap
ditangani oleh Firebase Authentication; profil dan username oleh Firestore.

Peran `kepala` tidak dipasangkan ke satu tim dan tidak bisa diubah menjadi
Admin melalui menu akun. Fitur finalisasi di prototipe tetap sesuai hak akses
Kepala BPS. Akun Kepala **belum otomatis dibuat**: Admin perlu login dan
mengisi username serta password awal pribadi.

## Aktivasi perubahan Rules

Kode `firestore.spark.rules` mendukung pembuatan/perubahan akun Kepala BPS
hanya oleh Admin terautentikasi. Perubahan file GitHub **tidak** sama dengan
menerapkan Rules ke Firebase produksi.

1. Pastikan hasil pengujian emulator Firestore Spark di GitHub Actions sukses.
2. Pengelola resmi membuka Firebase Console proyek `mkp-bps-blora`,
   kemudian Firestore Database → Rules.
3. Publikasikan isi `firestore.spark.rules` terkini setelah meninjau diff.
   Aturan bawaan untuk koleksi matriks tetap **deny-all**.
4. Masuk ke website dengan Google BPS Blora dan akun peran Admin.
5. Buka **Kelola Akun Akses → Tambah Akun → Kepala BPS**.
   Gunakan username unik (misalnya `kepala_uji`), password pribadi yang
   memenuhi syarat huruf + angka minimal 6 karakter. Tidak perlu memilih tim.
6. Logout Admin, lalu login peran `kepala_uji` untuk menguji menu.

Jangan memasukkan kata sandi dalam GitHub, screenshot, atau chat.

## Mode simulasi

Hanya Admin yang dapat membuka tombol **Muat Data Simulasi**. Pengguna
harus mencentang konfirmasi sebelum data disiapkan.

Fixture: 3 tim, 10 pegawai fiktif, 6 KRO fiktif, 8 kegiatan, Februari 2026,
kapasitas uji 8 jam/hari. Kode pegawai `E901`–`E910`, tim
`T901`–`T903`, KRO `SIM.001`–`SIM.006`.

Mode ini mengganti seed **hanya di iframe saat ditampilkan** dan memisahkan
seluruh kunci localStorage simulasi dengan awalan `mkp-simulasi-v1:`.
Penetapan, perubahan alokasi, dan audit yang dilakukan dalam mode ini adalah
**simulasi lokal pada browser**, bukan transaksi bersama Firestore. Database
produksi tidak ditulisi.

### Skenario hasil yang perlu dicek

| Periksa | Ekspektasi |
| --- | --- |
| Susunan 3 tim | Ketua dan anggota tampil sesuai data fiktif |
| Pegawai tanpa tim | E910 aktif meski tanpa keanggotaan tim |
| Pegawai lintas tim | E901 milik T901 ikut K06 T903 |
| Monitoring beban tim | Empat jam E901 pada K06 masuk T903 |
| Beban berlebih 4 Februari | E904 = 10 jam (K02 6 + K07 4) |
| Beban berlebih 4 Februari | E903 = 10 jam (K05 6 + K06 4) |
| Beban berlebih 4 Februari | E909 = 10 jam (K05 6 + K07 4) |
| Beban berlebih 3 Februari | E905 = 10 jam (K02 6 + K04 4) |
| Rapat bersama | K06 durasi 4 jam, masing-masing 3 peserta mendapat 4 jam |
| Hak akses Kepala BPS | Dapat meninjau/finalisasi; tidak menjadi Admin |
| Hapus Data Simulasi | Hanya membersihkan kunci `mkp-simulasi-v1:` |

Perubahan simulasi dapat diulang dengan **Muat Data Simulasi**, dan dihapus
dengan **Hapus Data Simulasi**. Pengguna dikembalikan ke data referensi normal.

Untuk menguji sinkronisasi multiakun/multiperangkat dan transaksi approval
yang benar-benar disimpan bersama, dibutuhkan tahap integrasi matriks ke
Firestore tersendiri dengan Rules keamanan. Fitur tersebut **belum** diaktifkan
hanya dengan fixture lokal ini.

## Validasi otomatis

- `scripts/verify-prototype.mjs` memeriksa fixtures, HTML bootstrap,
  sintaks JavaScript simulasi, dan penghapusan terbatas pada prefiks lokal.
- `scripts/spark-rules.test.mjs` memakai Firebase Emulator untuk menguji
  penciptaan akun, pencabutan hak, rotasi password, serta penolakan akses matriks.
- Build GitHub Pages memakai kode yang sama; tidak men-deploy Firestore Rules.
