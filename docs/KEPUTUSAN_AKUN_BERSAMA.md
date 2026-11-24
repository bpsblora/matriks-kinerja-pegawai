# Keputusan Desain: Satu Gmail Kantor dan Akun Pegawai

Tanggal: 6 November 2026. Status: **butuh keputusan implementasi / persetujuan TI**.

## Kondisi yang dikonfirmasi
- BPS Blora memiliki **satu Gmail bersama** yang dipakai untuk mengelola Firebase.
- Rencana awal pengguna: semua pegawai masuk ke Google menggunakan Gmail kantor yang sama, lalu memilih/login akun dan peran di aplikasi.

## Risiko dan batasan wajib
- Google Sign-In menggunakan satu Gmail bersama menghasilkan **identitas Firebase Auth (UID) yang sama** bagi semua pegawai. Security Rules tidak dapat membedakan siapa orang yang memakai akun bersama.
- Pemilihan nama, jabatan, atau role dalam UI tidak menghasilkan autentikasi yang dapat dipercaya. Jangan mengotorisasi operasi Kepala/Admin berdasarkan pilihan UI atau `localStorage`.
- Berbagi password Gmail pengelola infrastruktur tidak dianjurkan karena memberi akses luas ke layanan Google yang terhubung dan meniadakan jejak identitas personal.

## Arsitektur yang disarankan
1. Gmail BPS Blora: **hanya pemilik/pengelola proyek Firebase**, tidak digunakan bersama untuk login aplikasi pegawai.
2. Satu Firebase Hosting dan database Firestore (DEV/PROD dipisah secara proyek).
3. Setiap pegawai memiliki **identitas aplikasi tersendiri** dengan UID Firebase berbeda.
4. Pendaftaran akun dan perubahan peran dilakukan admin terotorisasi; jangan mengizinkan klien menciptakan hak Admin.
5. Audit log setiap perubahan mencatat UID, waktu, aksi, tahun, tim dan objek terkait.
6. Gunakan Security Rules dan operasi server untuk hak Kepala/Admin/Ketua/Pegawai.

## Opsi identitas per pegawai
A. **Google Sign-In individual + allowlist**: pegawai memakai akun Google sendiri, tidak harus pemilik cloud; paling sederhana dan tidak perlu password aplikasi.
B. **Akun aplikasi username/password individual**: membutuhkan implementasi backend/verifier yang aman dan penerbitan Firebase custom token atau solusi autentikasi yang setara. Jangan menaruh password/hash verifier di browser atau Firestore yang bisa dibaca klien. Alternatif ini bisa memerlukan layanan server/billing/persetujuan TI.

Jangan menggunakan satu akun Gmail bersama ditambah pemilih role frontend sebagai sistem produksi. Jika shared Google digunakan sebagai gerbang tambahan, autentikasi aplikasi individual yang ditegakkan di backend **tetap diperlukan** dan risikonya tidak berkurang secara berarti.

## Tindakan dalam tahap ini
- Jangan ubah `firestore.rules` dari deny-all.
- Jangan deploy `firestore.auth-phase.rules` sebelum identitas unik dan tes keamanan siap.
- Jangan masukkan data pegawai asli ke DEV `mkp-bps-blora` yang berada di `nam5`.
- Menunggu pilihan cara login individual dan persetujuan TI sebelum mengembangkan autentikasi produksi.

Rujukan:
- https://firebase.google.com/docs/rules/rules-and-auth
- https://firebase.google.com/docs/auth/admin/create-custom-tokens
