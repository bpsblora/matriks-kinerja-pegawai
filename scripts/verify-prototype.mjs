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

// Reconciliation labels must identify the annual baseline and monthly coverage.
for (const text of [
  "Kelengkapan Alokasi Tahunan 2026",
  "Alokasi Tahunan Awal",
  "Alokasi yang Sudah Dirinci per Bulan",
  "Jam Belum Terurai ke Bulan",
  "Rincian Bulanan Belum Lengkap",
  "selisih tidak boleh dibagikan otomatis"
]) {
  assert(html.includes(text), "Rekonsiliasi 2026 kehilangan penjelasan: "+text);
}
assert(!html.includes("Referensi Tahunan Lama"), "Nama acuan tahunan lama belum diperjelas");
assert(!html.includes("Selisih terhadap Referensi"), "Nama selisih bulanan lama belum diperjelas");


// Dashboard warning behavior test: duplicate team membership must not double
// the office denominator, and only planned/recorded work triggers date warnings.
const beginAlert=inline.indexOf("function capacityWarningEvents(period){");
const endAlert=inline.indexOf("function renderCapacityWarnings(){",beginAlert);
assert(beginAlert>=0&&endAlert>beginAlert,"Fungsi peringatan bulanan/tahunan tidak ditemukan");
const warningCode=inline.slice(beginAlert,endAlert);
const e1={id:"E1",full_name:"Pegawai A",type:"pegawai",active:true};
const e2={id:"E2",full_name:"Pegawai B",type:"pegawai",active:true};
const a1={id:"A1",team_id:"T1",status:"aktif",description:"Uraian uji"};
const context={
 activeYear:2027,isBaseYear:false,
 months:["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"],
 BASE:{employees:[e1,e2],teams:[{id:"T1",name:"Tim A"},{id:"T2",name:"Tim B"}]},
 yearSetup:{staff:{ids:["E1","E2"]}},
 capacity:()=>10,nf:n=>String(n),
 periodAgg:(period,team)=>({totals:team==="T1"
  ?new Map([["E1",11],["E2",0]]):team==="T2"
  ?new Map([["E1",0],["E2",7]]):new Map([["E1",11],["E2",7]])}),
 assignedStaff:()=>[e1,e2],
 assignedStaffIds:()=>new Set(["E1","E2"]),
 byId:new Map([["A1",a1]]),baseMonthly:new Map(),amKey:(id,m)=>id+"|"+m,
 state:{allocEdits:{},targets:{},workflowPlans:{},scheduleEdits:{}}
};
const evaluate=()=>vm.runInNewContext(warningCode+";capacityWarningEvents('monthly')",context);
let events=evaluate().events;
assert(events.some(e=>e.scope==="pegawai"&&e.level==="over"),"Pegawai di atas kapasitas harus terdeteksi");
assert(!events.some(e=>e.scope==="kantor"&&e.level==="over"),"Kapasitas kantor menghitung pegawai ganda");
assert(!events.some(e=>e.scope==="alokasi"),"Katalog tanpa alokasi tidak boleh ditandai belum lengkap");

// Each actionable warning title states a concrete name and amount, not just
// a generic capacity status. The subtitle retains the ratio and context.
assert(events.some(e=>e.scope==="pegawai"&&e.level==="over"&&e.title==="Pegawai A — Kelebihan 1 Jam"),"Judul pegawai harus menunjukkan nama dan Jam kelebihan");
context.assignedStaff=teamId=>teamId==="T1"?[e1]:[e2];
events=evaluate().events;
assert(events.some(e=>e.scope==="tim"&&e.level==="over"&&e.title==="Tim A — Kelebihan 1 Jam"),"Judul tim harus menunjukkan nama tim dan Jam kelebihan");

context.state.allocEdits={"A1|E1|1":4};
events=evaluate().events;
assert(events.some(e=>e.title.includes("Uraian Belum Memiliki Tanggal Pelaksanaan")),"Tanggal kegiatan kosong harus diperingatkan");
context.state.scheduleEdits={"A1|1":{start:"2027-01-04",end:"2027-01-06"}};
events=evaluate().events;
assert(!events.some(e=>e.title.includes("Uraian Belum Memiliki Tanggal Pelaksanaan")),"Tanggal valid tidak boleh diperingatkan");
context.state.allocEdits={};
context.state.targets={"A1|1":2};
events=evaluate().events;
assert(events.some(e=>e.title.includes("Uraian Belum Dialokasikan ke Pegawai")),"Target tanpa penugasan harus diperingatkan");
assert(html.includes("Tanggal Mulai dan Selesai wajib diisi"),"Tahun baru harus mewajibkan tanggal pelaksanaan");
assert(html.includes("moveAnnualAuditToRecon()"),"Pemeriksaan tahun 2026 harus tersedia di Rekonsiliasi");
assert(html.includes('id="capacityWarningBoard"'),"Pusat peringatan Dashboard tidak ditemukan");


const warnSummaryStart=inline.indexOf("function renderCapacityWarnings(){");
const warnSummaryEnd=inline.indexOf("function renderCombinedDashboard(){",warnSummaryStart);
const warnSummary=inline.slice(warnSummaryStart,warnSummaryEnd);
assert(warnSummaryStart>=0&&warnSummaryEnd>warnSummaryStart,"Ringkasan peringatan Dashboard tidak ditemukan");
for(const level of ["over","near","pending"]){
  assert(warnSummary.includes("data-warning-category"),"Kartu "+level+" belum dapat membuka pop-up");
}
assert(warnSummary.includes('id="openAllWarnings"'),"Tombol Seluruh Peringatan tidak ditemukan");
assert(!warnSummary.includes('class="mkp-warning-item"'),"Daftar panjang masih dirender di Dashboard");
assert(inline.includes("dialog.showModal()"),"Pop-up peringatan belum dapat dibuka");
assert(inline.includes('id="warningDialogResults"'),"Daftar peringatan dalam pop-up belum tersedia");
assert(inline.includes('id="warningDialogPeriod"'),"Filter periode pop-up belum tersedia");
assert(inline.includes("dialog.addEventListener('close'"),"Pemulihan fokus saat pop-up ditutup belum ada");
const cssPolish=fs.readFileSync("src/sitePolish.css","utf8");
assert(cssPolish.includes(".mkp-warning-dialog-scroll{overflow-y:auto"),"Daftar pop-up tidak dapat digulir");
const collStart=inline.indexOf("function warningCollection(){");
const collEnd=inline.indexOf("function ensureWarningDialog(){",collStart);
assert(collStart>=0&&collEnd>collStart,"Pengurutan prioritas peringatan tidak ditemukan");
const priorityFixture={
  months:["Januari"],
  capacityWarningEvents:period=>({
    events:period==="monthly"?[
      {level:"near",title:"Cukup Dipantau",loadRatio:.91,period:"monthly",description:""},
      {level:"over",title:"Berlebih Ringan",loadRatio:1.03,period:"monthly",description:""},
      {level:"pending",title:"Data Perlu Diperiksa",period:"monthly",description:""},
      {level:"over",title:"Berlebih Tinggi",loadRatio:1.55,period:"monthly",description:""}
    ]:[],hasData:true
  })
};
const sorted=vm.runInNewContext(inline.slice(collStart,collEnd)+";warningCollection().all.map(x=>x.title).slice(0,4).join('|')",priorityFixture);
assert.equal(sorted,"Berlebih Tinggi|Berlebih Ringan|Data Perlu Diperiksa|Cukup Dipantau","Prioritas pop-up tidak sesuai tingkat urgensi");


// Monthly trend follows active year; office/team/employee comparison is a
// horizontal selection control, not a redundant year dropdown.
assert(html.includes('id="trendTitle">Tren Beban Kerja Antarbulan 2026'),"Judul tren tahunan tidak tersedia");
assert(html.includes('id="trendYear" hidden'),"Dropdown tahun tren belum disembunyikan");
assert(html.includes('id="trendScope" hidden'),"Dropdown perbandingan lama belum diganti tombol");
for(const scope of ["office","allTeams","allEmployees"]){
 assert(html.includes('data-trend-scope="'+scope+'"'),"Tombol grafik "+scope+" belum tersedia");
}
assert(inline.includes("button.dataset.trendScope===scope"),"Status aktif tombol filter belum sinkron dengan grafik");
assert(inline.includes("button.onclick=()=>{\n  $('trendScope').value=button.dataset.trendScope;"),"Tombol filter belum terhubung ke grafik");
assert(inline.includes("const scope=$('trendScope').value,year=activeYear;"),"Tren belum mengikuti tahun aktif");
assert(cssPolish.includes(".trend-scope-buttons"),"Tombol pilihan grafik belum mendapat desain horizontal");


// Historical 2026 must expose the same staff -> team establishment workflow
// as subsequent years without overwriting its source allocations.
const setupStart=inline.indexOf("function renderYearSetup(){");
const setupEnd=inline.indexOf("function confirmStaffYear(){",setupStart);
const yearSetupCode=inline.slice(setupStart,setupEnd);
assert(setupStart>=0&&setupEnd>setupStart,"Panel penetapan pegawai dan tim tidak tersedia");
assert(yearSetupCode.includes("panel.classList.remove('hidden')"),"Tahapan tahun 2026 masih disembunyikan");
assert(yearSetupCode.includes("isBaseYear?!!(yearSetup.staff?.confirmed"),"Tahun 2026 harus memerlukan penetapan daftar pegawai");
assert(yearSetupCode.includes("teamStage.classList.toggle('hidden',isBaseYear&&!allReady)"),"Tahap tim tidak menunggu penetapan pegawai");
const stageStart=inline.indexOf("function setupYearStages(){");
const stageEnd=inline.indexOf("function refreshTeamStore(){",stageStart);
const stageCode=inline.slice(stageStart,stageEnd);
assert(stageStart>=0&&stageEnd>stageStart,"Pengaitan tahap penetapan tidak tersedia");
assert(stageCode.includes("if(grid)$('annualTeamGridSlot').appendChild(grid)"),"Rincian tim belum berada di bawah tahapan penetapan");
assert(stageCode.includes("addEventListener('click',confirmStaffYear)"),"Tombol penetapan pegawai belum aktif di 2026");
assert(stageCode.includes("addEventListener('click',confirmTeamYear)"),"Tombol penetapan tim belum aktif di 2026");
assert(!stageCode.includes("if(!isBaseYear){\n  if(hero&&panel)"),"Tahapan 2026 tidak boleh dikecualikan");
assert(inline.includes("if(membershipChanged&&(!isBaseYear||yearSetup.staff?.confirmed))"),"Perubahan pegawai perlu meninjau ulang penetapan");
assert(inline.includes("el.classList.toggle('hidden',isBaseYear&&!yearSetup.staff?.confirmed)"),"Ringkasan tim 2026 harus menunggu tahap pegawai");


// Paired cards must have identical outside height and independently scroll
// their lengthy employee/activity lists. Do not hide full forms by overflow.
for (const rule of [
  "#pageDashboard .monitor-main-grid{",
  "#pageDashboard .monitor-main-grid > :is(.chart-panel,.person-panel){",
  "#pageDashboard .monitor-main-grid #barRows,",
  "#pageDashboard .monitor-main-grid #personDetails{",
  "#pageTeams .team-admin-grid{align-items:stretch!important}",
  "#pageTeams .team-admin-grid > .team-admin-card{",
  "@media(max-width:1240px){",
  "@media(max-width:980px){"
]) assert(cssPolish.includes(rule),"Aturan penyamaan kartu/area gulir belum tersedia: "+rule);
assert(cssPolish.includes("overflow-y:auto;"),"Daftar panjang perlu gulir vertikal");
assert(cssPolish.includes("max-height:none!important;"),"Batas lama tinggi daftar di desktop perlu ditimpa");
assert(cssPolish.includes("overflow:visible;"),"Formulir kartu bertumpuk tidak boleh terpotong");

console.log("Prototipe V25 v2.6 lengkap, referensi anonim, tidak ada password demo.");
