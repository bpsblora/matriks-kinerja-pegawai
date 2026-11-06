# Matriks Pegawai: arsitektur dan migrasi v2.6

## Peran sistem
- **ChatGPT / GitHub**: pengembangan, review, audit kode, dan riwayat versi. Tidak menerima database produksi.
- **Firebase Hosting**: penyajian frontend (halaman login tidak berarti data terbuka).
- **Firebase Authentication**: UID individual yang diterbitkan melalui custom token setelah verifikasi username/password pada backend.
- **Cloud Firestore**: penyimpanan data bersama dan realtime.
- **Cloud Functions / backend**: tindakan istimewa dengan verifikasi identitas/otorisasi server.

## Struktur data yang direncanakan (belum final)
- `users/{uid}`: username, role, active, employeeId dan teamIds; dibuat/diedit oleh Admin melalui backend tepercaya.
- `authCredentials/{hash(username)}`: hash password bcrypt dan referensi UID, hanya boleh diakses backend, bukan browser.
- `years/{year}`: status penyusunan, metadata, penetapan dan finalisasi.
- `employees/{employeeId}`: identitas pegawai minimal yang disetujui.
- `teams/{year_teamId}`: nama, ketua dan anggota.
- `kros/{year_code}`: kode, nama, tahun, status aktif.
- `teamKros/{year_team_code}`: penanggung jawab KRO dan referensi kegiatan.
- `activities/{activityId}`: kegiatan/uraian yang terkait tim dan KRO.
- `allocations/{allocationId}`: volume, satuan, beban, periode, pegawai dan revision.
- `standards/{standardId}`: standar menit/satuan beserta versi.
- `auditLogs/{id}`: catatan perubahan dibuat oleh backend; tidak boleh ditulis langsung oleh klien.

## Perlu migrasi dari prototipe v2.6
1. Audit dan hilangkan password simulasi yang tersimpan di HTML/JavaScript.
2. Ubah autentikasi lokal menjadi username/password individual terverifikasi backend dan UID Firebase unik; jangan pernah gunakan Gmail bersama sebagai akun login pegawai.
3. Ubah seluruh `localStorage` data operasional menjadi pembacaan/penulisan Firestore berbasis role.
4. Pertahankan seluruh tampilan utama, termasuk pop-up Pembagian KRO serta monitoring tiga kelompok.
5. Migrasikan hanya data referensi yang sudah disetujui, melalui proses admin yang diaudit; pisahkan 2026 (acuan) dan 2027 (penetapan baru).
6. Pertahankan aturan beban kerja bersama: 3 pegawai rapat 4 jam = 4 jam per pegawai; tugas terbagi membagi volume sesuai kontribusi.
7. Implementasikan transaksi, versioning, validasi server dan audit atas perubahan yang sensitif.
8. Uji dua pengguna bersamaan, status aktif, edit KRO, penetapan, pembukaan penetapan, dan finalisasi Kepala.

## Larangan sebelum izin TI
- Jangan unggah data pegawai asli, akun simulasi, database backup, atau hasil ekspor aplikasi ke repository.
- Jangan gunakan Firestore Test Mode untuk proyek yang terekspos internet.
- Jangan menggunakan satu akun Google bersama untuk mengakses aplikasi.
- Jangan menganggap repository private berarti Firebase Hosting private. Website dapat tetap diakses publik; hanya data dilindungi aturan backend dan Firestore.

## Siklus rilis
`perubahan fitur -> branch -> PR -> cek keamanan -> preview DEV -> persetujuan -> merge -> deploy DEV -> validasi -> rilis PROD terkontrol`.
