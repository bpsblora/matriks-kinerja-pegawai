import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const paths=Array.from({length:17},(_,i)=>"assets/v26/part-"+String(i+1).padStart(3,"0")+".txt");
for(const path of paths)assert(fs.existsSync(path),"File V25 belum lengkap: "+path);
const html=paths.map(path=>fs.readFileSync(path,"utf8")).join("");
assert(html.includes("Prototipe V25 v2.6"),"Versi bukan v2.6");
assert(html.includes("function enterPrototypeEdit()"),"Gerbang Gmail belum menggantikan login demo");
const scriptStart=html.lastIndexOf("<script>");
const scriptEnd=html.indexOf("</script>",scriptStart);
assert(scriptStart>=0 && scriptEnd>scriptStart,"Script fungsional V25 tidak tersedia");
const inline=html.slice(scriptStart+"<script>".length,scriptEnd);
new vm.Script(inline,{filename:"prototipe-v26-inline.js"});

assert(!html.includes("demo2026"),"Password demo lama tidak boleh ikut");
const extract=id=>{
  const needle='<script id="'+id+'" type="application/json">';
  const from=html.indexOf(needle);
  assert(from>=0,"Seed "+id+" hilang");
  const end=html.indexOf("</script>",from+needle.length);
  assert(end>from,"Seed "+id+" terpotong");
  return JSON.parse(html.slice(from+needle.length,end));
};
const seed=extract("seed"),kro=extract("kroSeed"),kro2027=extract("kro2027Seed");
assert.equal(seed.meta.year,2026);
assert.equal(seed.teams.length,25);
assert.equal(seed.employees.length,40);
assert.equal(seed.activities.length,1412);
assert.equal(seed.annual_allocations_source.length,3224);
assert.equal(seed.monthly_allocations_source.length,2779);
assert.equal(kro.kros.length,33);
assert.equal(kro2027.kros.length,32);
assert(seed.employees.every(e=>/^Pegawai \d+$/.test(e.full_name)),"Nama asli pegawai tidak boleh di preview statis");
assert(Object.values(kro.official_roster).every(x=>!x.leaderName||x.leaderName.startsWith("Pegawai ")),"Nama ketua tim masih asli");
// Prevent regressions in displayed unit captions and numeric summaries.
// Prose descriptions intentionally retain ordinary Indonesian sentence case.
const unitCaptions = [
  "<div class=\"pm-sub\">Jam-Orang</div>",
  "<div class=\"pm-sub\">Jam/Hari Kerja Efektif</div>",
  "<div class=\"pm-sub\">Jam per Bulan dalam Periode</div>",
  "Hari Ekuivalen (Total Jam ÷ Jam Efektif/Hari)",
  "Rata-rata Jam/Hari",
  "0 Pegawai Dipilih",
  "Uraian Ditampilkan",
  "Jam/Satuan",
  "Jam Kerja Efektif / Hari (Acuan)",
  "Hari Kerja Efektif",
  "Kegiatan pada KRO ini",
  "Jumlah Tim"
];
for (const label of unitCaptions) {
  assert(html.includes(label), "Label satuan belum konsisten: "+label);
}
const rejectedCaptions = [
  "<div class=\"pm-sub\">jam-orang</div>",
  "<div class=\"pm-sub\">jam/hari kerja efektif</div>",
  "<div class=\"pm-sub\">jam per bulan dalam periode</div>",
  "<span>Jam/hari</span>",
  "0 pegawai dipilih",
  "hari kerja efektif · ${months[m-1]}",
  "metric==='daily'?'Jam/hari'",
  "rows.length+' uraian dengan alokasi pada periode terpilih'"
];
for (const label of rejectedCaptions) {
  assert(!html.includes(label), "Label satuan lama masih ditemukan: "+label);
}

console.log("Prototipe V25 v2.6 lengkap, referensi anonim, tidak ada password demo.");
