# Audit Logika Kegiatan dan Kesiapan Skala Data — Matriks Pegawai

**Tanggal audit:** 9 November 2026  
**Repositori:** `bpsblora/matriks-kinerja-pegawai`, cabang `setup/firebase-foundation`  
**Status:** audit kode prototipe; belum merupakan uji beban produksi atau validasi seluruh baris sumber 2026.

## 1. Konsep data baku

| Entitas | Definisi | Boleh dijumlahkan? |
|---|---|---|
| Tim pemilik | Penanggung jawab kegiatan/KRO; tidak membatasi pelaksana | Jam-Orang dari semua penugasannya dapat dijumlahkan |
| Keanggotaan tim | Struktur pengelolaan pegawai, bukan pembatas alokasi | Tidak digunakan sebagai kapasitas tim yang kaku |
| Kegiatan | Kelompok kerja di bawah tim dan KRO | Jangan jumlahkan volume dari satuan berbeda |
| Uraian | Pekerjaan terukur yang memiliki satuan dan standar waktunya sendiri | Volume hanya dijumlah bila satuan serta definisi output sama |
| Volume kegiatan | Jumlah output/frekuensi, misalnya Dokumen, Responden, Rapat, Kunjungan | Ikuti satuan kegiatan |
| Standar waktu | Jam **per satuan output** | Jam/Satuan; dapat sangat kecil untuk kegiatan bervolume besar |
| Beban kerja pegawai | Volume yang ditugaskan kepada pegawai × standar waktu | Jam-Orang |
| Kapasitas efektif | Batas pembanding bagi pegawai, bukan batas otomatis bagi tim/kantor | Hanya untuk pegawai; butuh kalender efektif tervalidasi |

**Dua jenis pembebanan:** (a) *Terbagi*: 12 Dokumen yang dibagi 4+4+4 ke tiga pegawai → volume kegiatan 12 Dokumen, jam tiap pegawai dari volume masing-masing; (b) *Bersama*: 1 Rapat × 4 Jam dihadiri tiga pegawai → durasi 4 Jam, beban 12 Jam-Orang; volume rapat bukan 3 Rapat.

**Prinsip lintas tim:** pegawai dari Tim B yang melaksanakan kegiatan milik Tim A tetap menambah beban kegiatan Tim A, sekaligus menambah beban total Pegawai yang bersangkutan. Penugasannya tidak harus menambah keanggotaan tetap pada Tim A.

## 2. Hasil audit lintas submenu

| Fitur | Temuan dan tindakan langsung | Risiko residual / keputusan berikutnya |
|---|---|---|
| Kelola Tim dan Pegawai | Keanggotaan dipisah dari hak menerima alokasi; penetapan tahunan tetap dikelola secara bertahap | Validasi hak edit mengikuti tim pemilik kegiatan, bukan tim asal pegawai |
| Pembagian KRO | KRO tetap melekat ke Tim + Kegiatan; kegiatan bisa memiliki banyak uraian berbeda satuan | Identitas Kegiatan saat ini menggunakan teks nama kelompok, bukan ID stabil; rename dan duplikasi nama harus dimigrasi dengan mapping ID |
| Input Alokasi | Pegawai aktif boleh dipilih lintas tim; filter Anggota Tim Saja hanya menyaring tampilan. Validasi Jam = volume × standar, termasuk cek angka tidak finite | Katalog satuan terstandar dan review perubahan satuan diperlukan untuk operasional |
| Edit Uraian | Satuan dan tim pemilik terkunci jika telah terdapat alokasi; standar yang sudah terpakai dibekukan per bulan sebelum standar induk diedit | Perubahan satuan perlu fitur buat-versi/konversi tersendiri, bukan mengedit angka historis |
| Daftar Uraian | Daftar awal 100 baris, ditambah 100 secara bertahap; pencarian tetap tersedia | Untuk puluhan ribu uraian, lakukan pencarian server-side, pagination berbasis kursor |
| Timeline | Alokasi lintas bulan didistribusikan ke bulan terkait tanpa menggandakan Jam-Orang | Kalender libur hanya termuat untuk 2026–2027. Tahun setelahnya harus menunggu kalender resmi agar alarm kapasitas dapat dipercaya; parameter hari kerja manual juga perlu dikonsolidasikan |
| Dashboard Tren | Filter Tim Pemilik Kegiatan → Kegiatan; daftar centang otomatis menurut Jam alokasi dan dapat mencakup pegawai di luar tim | Perlu hasil agregasi tersimpan saat data sangat banyak, bukan memindai seluruh alokasi pada tiap interaksi |
| Dashboard Peringatan | Kelebihan dan kekurangan kapasitas hanya bagi pegawai; ketimpangan tim dibanding rata-rata tim yang punya alokasi pada bulan itu | Nol Jam = perlu cek kelengkapan, tidak otomatis idle; kapasitas ditangguhkan ketika kalender tahun belum lengkap |
| Rekonsiliasi | Volume bersama dihitung sekali, Jam-Orang setiap peserta tetap dihitung; daftar ditampilkan 200 baris lalu bertahap | Perlu audit kualitas data per satuan, anomali besar, dan deteksi kegiatan berulang |
| Standar Waktu | Angka standar per satuan sangat kecil ditampilkan presisi agar tidak terlihat 0 | Standar harus punya identitas satuan versi dan periode berlaku; UI sekarang masih mencampur master standar dengan standar uraian |
| Riwayat | Perubahan tercatat, tetapi log lokal saat ini dipotong ke 500 entri | Butuh log append-only di basis data bersama serta audit aktor dan versi |
| Finalisasi | Pemeriksaan pegawai, tim, KRO, uraian dan alokasi sudah ada | Finalisasi tahun 2026 masih diperlakukan khusus sebagai referensi; kesiapan operasional tahunan perlu alur dan status yang konsisten |
| Penyimpanan | Penyimpanan override alokasi dibuat jarang (sparse): nol yang sama dengan data dasar tidak lagi disimpan | Prototipe masih menggunakan penyimpanan lokal per browser; **bukan** sistem multi-pengguna dengan sinkronisasi daring |

## 3. Risiko ketika volume data meningkat tajam

1. **Ledakan kombinasi data**: 10.000 Uraian × 100 Pegawai × 12 Bulan = 12.000.000 kombinasi potensial. Jangan menyimpan setiap kombinasi bernilai nol; simpan hanya penugasan yang benar-benar ada dan override yang perlu.
2. **Kegiatan dengan satuan bervariasi**: Responden, Dokumen, OK, OB, Rapat, Kunjungan, Paket, Publikasi, Jam. Masing-masing uraian harus memakai satu unit baku. Jangan menggabungkan volume beda satuan atau mengubah makna satuan pada ID yang sudah dialokasikan.
3. **Volume sangat besar, standar sangat kecil**: misalnya 100.000 Responden × 0,0005 Jam/Responden = 50 Jam; standar tidak boleh dibulatkan menjadi 0 pada tampilan.
4. **Jumlah uraian banyak**: batasi jumlah elemen DOM yang dibuat serentak (tahap awal 100 untuk Input dan 200 untuk Rekonsiliasi); pencarian serta filter tetap harus dapat menemukan seluruh data.
5. **Rekalkulasi grafik berulang**: grafik sekarang masih mengakumulasi data di browser. Untuk >50.000 penugasan aktif, kaji agregasi berdasarkan (tahun, bulan, tim pemilik, kegiatan, pegawai) agar grafik tidak menghitung ulang semua alokasi setiap klik.
6. **Audit dan perubahan kolaboratif**: localStorage tidak mendukung sinkronisasi antarpetugas, konflik edit, maupun riwayat tanpa batas. Migrasi ke database bersama harus melalui skema/versioning dan validasi peran.

## 4. Model produksi yang disarankan

- `teams(teamId, year, name, leaderId)` dan `memberships(teamId, employeeId, year)`.
- `kros(kroId, year, code)` serta `activityGroups(groupId, year, ownerTeamId, kroId, name)`: **ID stabil**, label nama boleh berubah.
- `workItems(itemId, groupId, description, unitCode, calculationMode, status, version)`: setiap uraian memiliki satu satuan baku.
- `timeStandards(itemId, unitCode, effectiveFrom, effectiveTo, hoursPerUnit, revision)`: standar historis tidak tertimpa revisi baru.
- `assignments(year, month, workItemId, employeeId, volume, hours, scheduleId, version)`: hanya baris yang memiliki penugasan; UNIQUE untuk kombinasi item + pegawai + bulan + versi aktif.
- `schedules(scheduleId, startDate, endDate, distributionRule)` dan `workflowVersions(workItemId, revision, status, actor, timestamp)`.
- `monthlySummaries(year, month, ownerTeamId, groupId, employeeId, hours)`: tabel agregat/incremental untuk Dashboard, bukan sumber otoritatif.
- `changeLog(actor, entityId, before, after, timestamp)`: append-only; dukung rollback/versi dan hak akses.

**Aturan penting:** untuk mode `bersama`, simpan volume kegiatan sebagai atribut pelaksanaan/agenda dan Jam-Orang per peserta sebagai assignment. Untuk mode `terbagi`, volume agregat kegiatan harus sama dengan jumlah volume yang ditugaskan. Jangan menggandakan volume ketika ada beberapa pelaksana.

## 5. Penerapan bertahap tanpa mengubah angka 2026

**Tahap A — sudah dilakukan pada prototipe:** pilih pegawai lintas tim, perbaiki volume kegiatan bersama, cegah perubahan satuan historis, pertahankan presisi waktu kecil, tulis alokasi sparse, dan batasi elemen daftar yang ditampilkan sekaligus.

**Tahap B — sebelum operasional data besar:** tetapkan katalog Satuan dan konversi yang benar-benar valid; beri ID permanen pada Kegiatan/Uraian; bedakan volume rencana tahunan, volume realisasi bulanan, durasi kegiatan, dan Jam-Orang; audit hari kerja efektif. Sediakan impor banyak uraian dari POK/Excel dengan pratinjau kesalahan dan deteksi duplikasi.

**Tahap C — database bersama:** susun migrasi source 2026 → skema baru dengan referensi baris lama, simpan semua ID asal, lakukan agregasi per bulan dan per pegawai, serta aktifkan indeks komposit dan pagination server. Data percobaan anonim tidak boleh ditulis sebagai data operasional.

**Tahap D — uji skala:** gunakan skenario 1.000, 10.000, dan 50.000 penugasan, lalu 100.000+ pada backend; uji kecepatan buka grafik, cari uraian, simpan, ekspor dan audit. Ambang performa ditentukan setelah pengukuran, bukan dianggap sudah lulus.

## 6. Kasus uji yang wajib lulus

- Pegawai A anggota Tim 2 tetapi mengerjakan 6 Jam kegiatan Tim 1 → Jam Tim 1 +6, Jam Pegawai A +6, keanggotaan tetap Tim 2.
- 1 Rapat × 4 Jam, 3 Pegawai → 1 Rapat, 4 Jam durasi, 12 Jam-Orang.
- 12 Dokumen terbagi menjadi 4+4+4 → total volume 12 Dokumen; total Jam-Orang sesuai standar masing-masing.
- Volume 100.000 × standar 0,0005 Jam → 50 Jam, bukan 0 Jam.
- Uraian dengan alokasi tidak bisa langsung berubah dari Responden menjadi Dokumen, atau dipindah tim tanpa migrasi.
- Perubahan standar bulan berikutnya tidak mengubah Jam yang sudah ditetapkan di bulan sebelumnya.
- Filter Kegiatan mengurutkan pegawai berdasarkan alokasi, termasuk pegawai di luar tim pemilik.
- Daftar 1.000+ uraian dan 1.000+ rekonsiliasi tetap bisa diakses bertahap dan tidak hilang setelah baris ke-100/200.
- Tahun 2028 dengan kalender libur belum tersedia tidak mengeluarkan kepastian melebihi/kurang kapasitas efektif yang keliru.

**Batas audit:** Analisis berasal dari kode dan pengujian otomatis prototipe. Ini bukan pembuktian kemampuan 50.000+ data atau validasi operasional seluruh arsip 2026.
