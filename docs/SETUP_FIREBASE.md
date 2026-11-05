# Panduan penyiapan Firebase (lingkungan DEV)

Status: rancangan awal, **belum terhubung ke proyek Firebase** dan **belum siap operasional**.

## A. Akun dan kepemilikan
1. Gunakan akun Google resmi BPS Blora untuk membuat proyek Firebase DEV setelah disetujui TI.
2. Gunakan GitHub `bpsblora/matriks-kinerja-pegawai` (private) untuk kode; `muhalfarisxi` adalah kolaborator.
3. Setiap pegawai kelak masuk dengan akun Google **masing-masing**, bukan berbagi Gmail kantor.
4. Jadikan pengelola TI yang ditunjuk sebagai administrator cadangan. Aktifkan MFA.

## B. Firebase Console
1. Buka https://console.firebase.google.com/ lalu buat proyek pengembangan bernama `Matriks Kinerja Pegawai BPS Blora DEV` (project ID yang tersedia bebas dipilih).
2. Authentication > Sign-in method > aktifkan Google dan tetapkan support email resmi.
3. Firestore Database > Create database > Production mode (akses terkunci); pilih region Jakarta (`asia-southeast2`) hanya setelah menyetujui kebijakan penempatan data.
4. Project settings > Your apps > Add app > Web. Simpan konfigurasi SDK Web; **jangan** menyimpan service account private key di repository.
5. Hosting belum perlu diaktifkan sampai antarmuka v2.6 selesai dimigrasikan dan diuji.

## C. Aturan keamanan awal
`firestore.rules` disiapkan dengan deny-all untuk seluruh dokumen. Tidak ada pengguna yang dapat membaca/menulis lewat SDK klien sampai aturan role-based access disusun dan dites.
Jangan menggantinya dengan `allow read, write: if request.auth != null` karena itu membuka data ke semua akun yang login.

## D. Setelah aplikasi siap
1. Migrasikan login simulasi dan `localStorage` dari v2.6 ke Firebase SDK + Firestore.
2. Daftarkan akun melalui UID Google dan whitelist (status aktif, peran, tim), bukan sekadar domain email.
3. Operasi finalisasi, perubahan peran, penetapan administratif, dan audit perubahan divalidasi di Cloud Functions/backend dengan otorisasi server.
4. Uji Firestore Rules dengan Emulator: pengguna nonaktif, pegawai biasa, ketua tim, admin, kepala, akses lintas tim, dan penulisan ilegal.
5. Lakukan uji kode serta peninjauan PR sebelum deployment; gunakan proyek DEV dan PROD yang berbeda.

## E. Deployment GitHub Actions (nanti)
Belum ada workflow deployment dan belum ada GitHub secret/kredensial pada repository ini.
Untuk menyiapkan integrasi, diperlukan admin repository `bpsblora` dan pengelola proyek Google Cloud/Firebase.
Prioritaskan Workload Identity Federation dengan izin sesempit mungkin, bukan service account key jangka panjang.
Workflow preview PR dapat diaktifkan setelah aplikasi frontend dapat dibangun dan autentikasi di DEV lolos uji.
Jangan aktifkan deployment otomatis ke PROD sebelum tersedia persetujuan perubahan, backup, dan prosedur rollback.

Rujukan: https://firebase.google.com/docs/hosting/github-integration dan https://firebase.google.com/docs/rules/basics
