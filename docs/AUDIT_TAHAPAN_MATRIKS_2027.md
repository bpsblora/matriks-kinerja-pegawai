# Audit alur dan perhitungan Matriks Kinerja Pegawai 2026–2031

## Keputusan konsep (23 November 2026)

1. Inventarisasi beban kegiatan dilakukan sebelum menentukan jumlah dan nama tim.
2. Total tanggung jawab tim/kantor adalah **beban Organik + beban Mitra**. Pegawai Organik berarti pegawai kantor BPS Kabupaten Blora.
3. Pemetaan kapasitas dan FTE untuk pegawai kantor **hanya memakai Jam Organik**. Jam Mitra tetap dihitung dalam total tanggung jawab kantor, tetapi tidak dialokasikan sebagai beban individu pegawai Organik.
4. Semua pekerjaan termasuk rapat memakai satuan **orang-jam**. Satu rapat 5 jam dengan 8 peserta berarti 40 orang-jam, misalnya 25 Organik dan 15 Mitra jika komposisi pesertanya 5:3.
5. Beban kelompok fungsi adalah inventarisasi awal, **bukan penetapan tim final**. Usulan tim dapat berupa gabungan beberapa fungsi dan ditinjau Kepala BPS.
6. Kebutuhan SDM sementara adalah Jam Organik dibagi kapasitas efektif tahunan. Pembulatan FTE bukan keputusan jumlah anggota karena pekerjaan lintas tim, keahlian, dan bulan puncak perlu diperiksa.

## Alur website

1. Buka tahun kerja, lalu klik **Pemetaan Beban Kerja** pada bagian atas.
2. Data 2026 menggunakan referensi Excel asli yang sudah terpasang, dengan perhitungan person-hour dari rincian alokasi tahunan bila tersedia.
3. Untuk 2027, impor sheet **2027** dari berkas `Matriks Kegiatan Pegawai 2027.xlsx`. Impor menerima XLSX atau CSV. Untuk 2028 dst., pilih tahun atau gunakan rekomendasi inventarisasi tahun sebelumnya; pembagian Organik/Mitra tahun berikutnya harus ditinjau ulang.
4. Di rekap kelompok fungsi, isi nama **Usulan Tim** yang sama untuk menggabungkan fungsi; edit baris uraian, volume, jam/satuan, dan pembagian Organik/Mitra.
5. Lihat perbandingan total kantor, Jam Organik, Jam Mitra, FTE, dan indikasi anggota. Unduh skenario dalam CSV untuk pembahasan.
6. Sesudah struktur tim disepakati, gunakan **Kelola Tim**, **Pembagian KRO**, **Input Alokasi**, kemudian **Monitoring** dan penetapan.

## Audit input kegiatan dan rincian (berlaku untuk semua tahun)

- Tambah Kegiatan membuat kelompok kegiatan beserta uraian pertama; Tambah Uraian mengisi detail pada kelompok tersebut.
- Nama kegiatan, uraian, dan satuan wajib terisi. Standar waktu yang sudah diisi harus **lebih besar dari nol**; boleh dibiarkan kosong pada tahap rancangan dan dilengkapi sebelum pengalokasian.
- Duplikasi uraian dengan nama dan satuan sama ditolak termasuk apabila uraian lama berstatus nonaktif.
- Uraian yang sudah memiliki alokasi tidak boleh dipindah sembarangan ke kelompok kegiatan/tim atau diganti satuannya. Ini menjaga riwayat beban dan hubungan KRO.
- Perubahan standar waktu suatu uraian tidak boleh mengubah standar bulanan yang sudah dipakai pada alokasi lama.
- Rekap bulanan pegawai Organik berasal dari penjumlahan alokasi individu. Keanggotaan tim tidak membatasi penugasan lintas tim.
- Untuk rapat pada Input Alokasi, target bulanan adalah **frekuensi pertemuan** dan orang-jam dihitung untuk setiap peserta terpilih. Pada inventarisasi tahunan, volume kerja adalah volume pekerjaan total (misalnya orang-kegiatan), bukan durasi rapat saja.
- Tahun 2026 tetap menyimpan baseline Excel asli; 2027 dan seterusnya memakai ruang kerja tahunan terpisah. Penggunaan anggota, kegiatan, dan uraian dari tahun sebelumnya adalah **rekomendasi yang dapat diedit**, bukan pengesahan otomatis.
- Kepala BPS dapat meninjau dan menyetujui susunan/rencana. Form edit uraian dan alokasi dibatasi untuk Admin dan Ketua Tim yang berwenang.

## Temuan numerik pada workbook 2027 yang disampaikan pengguna

Pemeriksaan sel A–J pada sheet `2027` menemukan **1.536 rincian dengan kelompok dan uraian terisi** dalam **24 kelompok fungsi**.

| Indikator pada file sumber | Jam |
|---|---:|
| Total Jam (kolom H) | 89.449,945 |
| Jam Organik (kolom I) | 58.730,045 |
| Jam Mitra (kolom J) | 31.697,550 |
| Organik + Mitra | 90.427,595 |
| Selisih Organik + Mitra terhadap Total Jam | +977,650 |

- **10 baris** memiliki perbedaan antara H dan I+J, termasuk baris 896 dan 897 yang kontribusi selisihnya besar.
- **15 baris** memiliki perbedaan antara E×G dan H (ambang toleransi 0,02 jam).
- Baris bermasalah ditandai dalam pemetaan. Nilai kolom H sumber dan hasil hitung ulang ditampilkan **terpisah**; data tidak dikoreksi diam-diam.
- Tahun atau kode kegiatan lama pada uraian perlu diperiksa sebelum digunakan sebagai target 2027.

## Batasan yang masih berlaku

- Pemetaan baru tersimpan **lokal di browser**. Belum menjadi data bersama Firestore, dan belum otomatis menetapkan tim ataupun mengisi alokasi individu.
- File Excel 2027 belum dibundel langsung ke situs. Pengguna mengimpornya melalui menu Pemetaan pada browser yang digunakan.
- Pengujian otomatis mencakup pemeriksaan source, build, rumus orang-jam, dan pembacaan workbook contoh. Belum menggantikan **uji penerimaan multiuser** dengan Admin, Ketua Tim, serta Kepala BPS.
- Daftar tim tahun sebelumnya yang muncul pada workspace tahun baru tetap diperlakukan sebagai **referensi sementara**, bukan keputusan jumlah/struktur tim 2027.
