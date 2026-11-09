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
assert(!events.some(e=>(e.scope==="kantor"||e.scope==="tim")&&(e.level==="over"||e.level==="near")),"Tim/kantor tidak boleh memakai peringatan batas kapasitas pegawai");
assert(!events.some(e=>e.scope==="alokasi"),"Katalog tanpa alokasi tidak boleh ditandai belum lengkap");

// Each actionable warning title states a concrete name and amount, not just
// a generic capacity status. The subtitle retains the ratio and context.
assert(events.some(e=>e.scope==="pegawai"&&e.level==="over"&&e.title==="Pegawai A — Melebihi Kapasitas Total Efektif 1 Jam"),"Judul pegawai harus menyebut Kapasitas Total Efektif dan kelebihan Jam");
const originalAggregate=context.periodAgg;
const originalTeams=context.BASE.teams;
context.periodAgg=(period,team)=>({totals:team==="T1"
 ?new Map([["E1",250],["E2",0]]):team==="T2"
 ?new Map([["E1",40],["E2",0]]):team==="T3"
 ?new Map([["E1",20],["E2",0]]):team==="T4"
 ?new Map([["E1",10],["E2",0]]):new Map([["E1",180],["E2",140]])});
context.BASE.teams=[{id:"T1",name:"Tim A"},{id:"T2",name:"Tim B"},{id:"T3",name:"Tim C"},{id:"T4",name:"Tim D"}];
events=vm.runInNewContext(warningCode+";capacityWarningEvents('1')",context).events;
assert(events.some(e=>e.scope==="tim"&&e.anomaly==="high"&&e.title.includes("Jam di Atas Rata-rata Tim")),"Beban tim bulanan yang jauh di atas rata-rata harus diperingatkan");
assert(events.some(e=>e.scope==="tim"&&e.anomaly==="low"&&e.title.includes("Jam di Bawah Rata-rata Tim")),"Beban tim bulanan yang jauh di bawah rata-rata harus diperingatkan");
assert(!events.some(e=>e.scope==="tim"&&e.level==="over"),"Ketimpangan tim bukan kelebihan kapasitas tim");
assert(!vm.runInNewContext(warningCode+";capacityWarningEvents('monthly')",context).events.some(e=>e.scope==="tim"&&e.anomaly),"Ketimpangan tim hanya dinilai untuk tiap bulan");
context.BASE.teams=originalTeams;
context.periodAgg=(period,team)=>({totals:team==="T1"
 ?new Map([["E1",11],["E2",0]]):team==="T2"
 ?new Map([["E1",0],["E2",2]]):new Map([["E1",11],["E2",2]])});
events=evaluate().events;
assert(events.some(e=>e.scope==="pegawai"&&e.level==="under"&&e.title.includes("2 Jam Alokasi")),"Pegawai dengan 20% beban tercatat harus diperingatkan");
context.periodAgg=(period,team)=>({totals:team==="T1"
 ?new Map([["E1",11],["E2",0]]):team==="T2"
 ?new Map([["E1",0],["E2",0]]):new Map([["E1",11],["E2",0]])});
events=evaluate().events;
assert(!events.some(e=>e.scope==="pegawai"&&e.level==="under"&&e.employeeId==="E2"),"Nol Jam berarti belum tercatat, bukan bukti pegawai sangat under");
assert(events.some(e=>e.title.includes("Pegawai Belum Memiliki Alokasi Tercatat")),"Pegawai nol Jam harus masuk pemeriksaan kelengkapan");
context.periodAgg=originalAggregate;
events=evaluate().events;

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

// Outside-team assignments are legitimate. The dashboard may still request a
// date, but must not reject an assignee merely for lacking team membership.
context.assignedStaffIds=()=>new Set(["E2"]);
context.state.allocEdits={"A1|E1|1":4};
events=evaluate().events;
assert(!events.some(e=>e.title.includes("Penugasan di Luar Tim")),"Penugasan lintas tim bukan masalah validasi");
context.state.allocEdits={};
assert(!warningCode.includes("members.length*perPerson"),"Kapasitas tim tidak boleh dijumlah dari anggota tetap");
assert(!warningCode.includes("officeCap"),"Kantor tidak memiliki ambang maksimum volume beban kerja");
assert(warningCode.includes("pct<=.25"),"Pegawai dengan alokasi tercatat di bawah 25% belum dipantau");
assert(warningCode.includes("working.length>=3"),"Pembandingan tim harus menggunakan sampel bulan yang memadai");

assert(html.includes("Tanggal Mulai dan Selesai wajib diisi"),"Tahun baru harus mewajibkan tanggal pelaksanaan");
assert(html.includes("moveAnnualAuditToRecon()"),"Pemeriksaan tahun 2026 harus tersedia di Rekonsiliasi");
assert(html.includes('id="capacityWarningBoard"'),"Pusat peringatan Dashboard tidak ditemukan");


const warnSummaryStart=inline.indexOf("function renderCapacityWarnings(){");
const warnSummaryEnd=inline.indexOf("function renderCombinedDashboard(){",warnSummaryStart);
const warnSummary=inline.slice(warnSummaryStart,warnSummaryEnd);
assert(warnSummaryStart>=0&&warnSummaryEnd>warnSummaryStart,"Ringkasan peringatan Dashboard tidak ditemukan");
for(const level of ["over","near","under","pending"]){
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
      {level:"under",title:"Beban Sangat Rendah",loadRatio:.15,period:"monthly",description:""},
      {level:"over",title:"Berlebih Tinggi",loadRatio:1.55,period:"monthly",description:""}
    ]:[],hasData:true
  })
};
const sorted=vm.runInNewContext(inline.slice(collStart,collEnd)+";warningCollection().all.map(x=>x.title).slice(0,5).join('|')",priorityFixture);
assert.equal(sorted,"Berlebih Tinggi|Berlebih Ringan|Data Perlu Diperiksa|Cukup Dipantau|Beban Sangat Rendah","Prioritas pop-up tidak sesuai tingkat urgensi");


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



// The top filter selects the ACTIVITY OWNER and the activity, not the
// employee's organizational team. Checkboxes follow the resulting workload.
assert(html.includes('id="trendOwnerTeam"'),"Filter Tim Pemilik Kegiatan tidak ditemukan");
assert(html.includes('id="trendActivityFilter"'),"Filter Kegiatan tidak ditemukan");
assert(!html.includes('id="trendTeamOptions"'),"Dropdown checkbox tim keanggotaan lama masih tampil");
const trendStart=inline.indexOf("function trendWorkloadMonth(");
const trendEnd=inline.indexOf("function renderTrendActivityFilters(",trendStart);
assert(trendStart>=0&&trendEnd>trendStart,"Agregasi kegiatan berdasarkan tim pemilik belum tersedia");
const trendData=vm.runInNewContext(inline.slice(trendStart,trendEnd)+";trendWorkloadMonth(1,'T1','SHKK')",{
 periodAgg:()=>({details:new Map([
  ["A1|E1",8],["A1|E2",12],["A2|E2",7],["A3|E1",6]
 ])}),
 byId:new Map([
  ["A1",{team_id:"T1",group:"SHKK"}],
  ["A2",{team_id:"T2",group:"SHKK"}],
  ["A3",{team_id:"T1",group:"SHP"}]
 ]),
 baseActivity:new Map(),groupName:a=>a.group
});
assert.equal(trendData.totals.get("E1"),8,"Beban pegawai pemilik kegiatan salah");
assert.equal(trendData.totals.get("E2"),12,"Pegawai luar tim yang mengerjakan kegiatan harus ikut dihitung");
assert.equal(trendData.teamTotals.get("T1"),20,"Beban tim harus memasukkan seluruh pelaksana kegiatan");
assert.equal(trendData.teamTotals.has("T2"),false,"Beban kegiatan tim lain harus dikecualikan");
assert(inline.includes("renderTrendActivityFilters(scope)"),"Filter berjenjang belum terhubung pada grafik");
assert(inline.includes("all.filter(e=>e.total>0).slice(0,6)"),"Pilihan seri awal tidak otomatis mengikuti beban terbesar");
assert(inline.includes("function applyTrendFilterChange(kind){"),"Perubahan checkbox Tim/Kegiatan belum mengubah grafik");
assert(inline.includes("trendSeriesSelection.allTeams=null;trendSeriesSelection.allEmployees=null;"),"Perubahan filter tidak mengurutkan ulang seri");
assert(inline.includes("initTrendPickers();"),"Pop-up checkbox belum aktif pada inisialisasi");
assert(inline.includes("trendSeriesSelection.allTeams=null;trendSeriesSelection.allEmployees=null"),"Perubahan filter tidak memicu urutan tim dan pegawai");
assert(!inline.includes("trendSelectedTeams"),"Logika daftar keanggotaan tim lama harus dilepas");
assert(cssPolish.includes("#pageDashboard .tl-trend-filters #trendActivityFilterWrap"),"Tata letak Kegiatan belum disesuaikan");

assert(html.includes('id="trendTeamPopover"'),"Pop-up checkbox Tim Pemilik belum dibuat");
assert(html.includes('id="trendActivityPopover"'),"Pop-up checkbox Kegiatan belum dibuat");
assert(html.includes('id="trendTeamChoices"'),"Checkbox multi-Tim belum tersedia");
assert(html.includes('id="trendActivityChoices"'),"Checkbox multi-Kegiatan belum tersedia");
assert(!html.includes('<select id="trendOwnerTeam"'),"Filter Tim masih dropdown tunggal");
assert(!html.includes('<select id="trendActivityFilter"'),"Filter Kegiatan masih dropdown tunggal");
assert(inline.includes("trendOwnerTeams=next;"),"Pilihan beberapa Tim belum tersimpan");
assert(inline.includes("trendActivityKeys=next;"),"Pilihan beberapa Kegiatan belum tersimpan");
assert(inline.includes("trendActivityKeys=null; // options must always reflect the selected owner teams"),"Perubahan Tim harus mereset Kegiatan untuk menjaga filter berjenjang");
assert(inline.includes("openTrendPicker('activity');"),"Pemilihan Tim belum bisa dilanjutkan ke pop-up Kegiatan");
assert(inline.includes("trendAvailableActivities().filter("),"Pilihan Kegiatan belum mengikuti Tim yang dicentang");
assert(cssPolish.includes(".trend-picker-popover{"),"Pop-up checkbox belum didesain");
assert(cssPolish.includes(".trend-picker-list{"),"Daftar checkbox yang panjang belum dapat digulir");

// Verify multi-team aggregation and activity identity with identical names
// in two teams. Include employees who belong to a different owner team.
const fullTrendStart=inline.indexOf("const trendActivityId=");
const fullTrendEnd=inline.indexOf("function renderTrendActivityFilters(",fullTrendStart);
assert(fullTrendStart>=0&&fullTrendEnd>fullTrendStart,"Model multi-team/activity tidak ditemukan");
const multiFixture={
  periodAgg:()=>({details:new Map([
    ["A1|E1",8],["A1|E2",12],["A2|E2",7],["A3|E1",6]
  ])}),
  byId:new Map([
    ["A1",{team_id:"T1",group:"SHKK"}],
    ["A2",{team_id:"T2",group:"SHKK"}],
    ["A3",{team_id:"T1",group:"SHP"}]
  ]),
  baseActivity:new Map(),groupName:a=>a.group
};
const trendFunctions=inline.slice(fullTrendStart,fullTrendEnd);
const multiTeam=vm.runInNewContext(trendFunctions+";trendWorkloadMonth(1,new Set(['T1','T2']),new Set([JSON.stringify(['T1','SHKK']),JSON.stringify(['T2','SHKK'])]))",{...multiFixture});
assert.equal(multiTeam.totals.get("E1"),8,"Multi-Tim gagal membaca pegawai pertama");
assert.equal(multiTeam.totals.get("E2"),19,"Pegawai lintas tim atau kelompok senama tidak terhitung");
assert.equal(multiTeam.teamTotals.get("T1"),20,"Beban Tim pemilik pertama tidak sesuai");
assert.equal(multiTeam.teamTotals.get("T2"),7,"Beban Tim pemilik kedua tidak sesuai");
const onlySecond=vm.runInNewContext(trendFunctions+";trendWorkloadMonth(1,new Set(['T1','T2']),new Set([JSON.stringify(['T2','SHKK'])]))",{...multiFixture});
assert.equal(onlySecond.totals.get("E1")||0,0,"Kegiatan senama dari Tim lain tidak boleh terikut");
assert.equal(onlySecond.totals.get("E2"),7,"Kegiatan pada Tim kedua harus tetap ada");
const noTeams=vm.runInNewContext(trendFunctions+";trendWorkloadMonth(1,new Set(),null)",{...multiFixture});
assert.equal(noTeams.totals.size,0,"Kosongkan Tim harus menghasilkan grafik tanpa data");


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


// A work detail should group by team AND activity and sum hours exactly.
const workStart=inline.indexOf("function groupPersonWorkload(rows){");
const workEnd=inline.indexOf("let personWorkModalReturn=",workStart);
assert(workStart>=0&&workEnd>workStart,"Pengelompokan Tim–Kegiatan belum tersedia");
const workFixture=[
 {ac:{id:"A1",team_id:"T1",team:"Tim Harga",group:"SHKK",description:"Rekrutmen"},h:12},
 {ac:{id:"A2",team_id:"T1",team:"Tim Harga",group:"SHKK",description:"Pemeriksaan"},h:24},
 {ac:{id:"A3",team_id:"T2",team:"Tim Lain",group:"SHKK",description:"Pendataan"},h:16},
 {ac:{id:"A4",team_id:"T1",team:"Tim Harga",group:"SHP",description:"Rekrutmen"},h:42}
];
const groups=vm.runInNewContext(inline.slice(workStart,workEnd)+";groupPersonWorkload(rows)",{
 rows:workFixture,teamMap:new Map(),groupName:a=>a.group
});
assert.equal(groups.length,3,"Kegiatan sama pada tim berbeda tidak boleh digabung");
assert.equal(groups[0].activity,"SHP","Urutan kartu harus dari total Jam terbesar");
assert.equal(groups[0].hours,42,"Total Jam kelompok harus dihitung tepat");
assert.equal(groups[1].hours,36,"Jam dalam satu Tim–Kegiatan harus dijumlahkan");
assert.equal(groups[1].items[0].title,"Pemeriksaan","Uraian per kartu harus diurutkan dari Jam terbesar");
assert.equal(groups.reduce((n,g)=>n+g.hours,0),94,"Total seluruh kartu harus cocok dengan total alokasi");
const modalCode=inline.slice(workEnd,inline.indexOf("function renderPerson(data,period",workEnd));
assert(modalCode.includes("Daftar Beban Pekerjaan Pegawai"),"Judul pop-up pekerjaan belum tersedia");
assert(modalCode.includes("dialog.showModal()"),"Daftar pekerjaan belum menjadi pop-up");
assert(modalCode.includes("person-work-dialog-scroll"),"Pop-up pekerjaan belum memiliki area gulir");
assert(modalCode.includes("colors[i%colors.length]"),"Kartu Tim–Kegiatan belum dibedakan warna");
assert(modalCode.includes("group.items.map(item=>"),"Uraian pekerjaan belum ada di setiap kartu");
assert(inline.includes("groupPersonWorkload(rows)"),"Detail Pegawai belum memakai data kelompok");
assert(inline.includes("id=\"openPersonWorkDialog\""),"Tombol pembuka pop-up belum tersedia");
assert(!inline.includes("rows.slice(0,90)"),"Pembatasan 90 pekerjaan lama belum dihapus");
for(const selector of [
 ".person-work-dialog-scroll{",
 ".person-work-group.person-work-green{",
 ".person-work-group.person-work-amber{",
 ".person-work-group.person-work-purple{",
 ".person-work-group.person-work-rose{",
 ".person-work-group.person-work-teal{"
]) assert(cssPolish.includes(selector),"Desain kartu berwarna atau gulir belum lengkap: "+selector);


// Employee detail card now contains only the direct modal button; only the
// modal itself scrolls. Its summary metrics remain above the button.
const renderPersonStart=inline.indexOf("function renderPerson(data,period,team,annual,monthly){");
const renderPersonEnd=inline.indexOf("function renderHistory(){",renderPersonStart);
const employeeRenderer=inline.slice(renderPersonStart,renderPersonEnd);
assert(renderPersonStart>=0&&renderPersonEnd>renderPersonStart,"Detail Pegawai tidak ditemukan");
assert(employeeRenderer.includes('id="openPersonWorkDialog"'),"Tombol detail pegawai harus langsung tersedia");
assert(!employeeRenderer.includes('person-work-compact-highlights'),"Ringkasan tiga pekerjaan seharusnya tidak tampil lagi");
assert(!employeeRenderer.includes('person-work-mini'),"Daftar pekerjaan kecil seharusnya dihapus dari panel");
assert(cssPolish.includes('overflow:visible!important;'),"Panel tombol detail harus tanpa gulir internal");
const detailCss=cssPolish.slice(cssPolish.lastIndexOf("#pageDashboard .person-panel #personDetails{"));
assert(detailCss.includes("flex:0 0 auto!important;"),"Tombol detail tidak boleh mengisi area gulir");
assert(detailCss.includes("overflow:visible!important;"),"Tombol detail tidak boleh memiliki scrollbar");
assert(modalCode.includes('person-work-dialog-scroll'),"Daftar panjang tetap digulir di pop-up");


// Activity growth and cross-team validation regression.
assert(html.includes('id="staffOnlyTeam"')&&!html.includes('id="staffOnlyTeam" checked hidden'),"Filter keanggotaan tim masih mengunci pegawai");
assert(html.includes('Anggota Tim Saja'),"Filter opsional anggota tim belum tersedia");
const eligibleStart=inline.indexOf("function allocationEligibleEmployees(){");
const eligibleEnd=inline.indexOf("let editingEmployeeId=null;",eligibleStart);
assert(eligibleStart>=0&&eligibleEnd>eligibleStart,"Pemilihan pegawai aktif lintas tim belum tersedia");
const activeEmployees=vm.runInNewContext(inline.slice(eligibleStart,eligibleEnd)+";allocationEligibleEmployees().map(e=>e.id).join(',')",{
 BASE:{employees:[
  {id:"E1",type:"pegawai",active:true},
  {id:"E2",type:"pegawai",active:true},
  {id:"E3",type:"pegawai",active:false},
  {id:"E4",type:"mitra",active:true}
 ]},isBaseYear:true,yearSetup:{staff:{ids:[]}}
});
assert.equal(activeEmployees,"E1,E2","Keanggotaan tim tidak boleh menjadi syarat pemilihan pegawai aktif");
const inputStart=inline.indexOf("function allocationStatus(){");
const inputEnd=inline.indexOf("function updateCalculations(){",inputStart);
const validationCode=inline.slice(inputStart,inputEnd);
assert(!validationCode.includes('assignedStaffIds('),"Validasi masih melarang penugasan lintas tim");
assert(validationCode.includes('allocationEligibleIds()'),"Validasi harus mengacu pada seluruh pegawai aktif");
assert(validationCode.includes("!Number.isFinite(personH)"),"Beban numerik tidak valid perlu ditolak");
assert(inline.includes("if(partial===baseline)delete state.allocEdits[allocKey]"),"Override sparse harus mempertahankan volume yang sangat kecil");
assert(inline.includes("if(allocatedMonths.length){"),"Satuan kegiatan beralokasi belum dikunci");
assert(inline.includes("Satuan uraian yang sudah dialokasikan dikunci"),"Peringatan perubahan makna satuan belum tersedia");
assert(inline.includes("state.monthlyStdEdits[k]=getStandard(previous,m)"),"Standar historis belum dibekukan sebelum edit master");
assert(inline.includes("Uraian identik dengan satuan yang sama sudah terdaftar"),"Duplikasi uraian identik perlu ditolak");
assert(inline.includes("Kegiatan dengan nama tersebut sudah ada"),"Ubah nama kegiatan tidak boleh menggabungkan kelompok tanpa sengaja");
assert(inline.includes("Nama Kegiatan sudah terdaftar pada tim ini"),"Tambah kegiatan tidak boleh diam-diam menggabungkan kelompok lama");
assert(inline.includes("let taskVisibleLimit=100"),"Daftar uraian belum dirender bertahap");
assert(inline.includes("visible.slice(0,taskVisibleLimit)"),"Uraian besar masih seluruhnya dirender sekaligus");
assert(inline.includes("let reconVisibleLimit=200"),"Rekonsiliasi belum ditampilkan bertahap");
assert(inline.includes("rows.slice(0,reconVisibleLimit)"),"Rekonsiliasi masih memotong daftar secara permanen");
assert(inline.includes("entry.qty=a.calculation_mode==='bersama'?Math.max(entry.qty,Number(q))"),"Volume kegiatan bersama terhitung berulang per peserta");
assert(inline.includes("const nfPrecise=v=>"),"Standar waktu yang sangat kecil masih ditampilkan nol");

// Unit suggestions normalize common case variants without preventing custom units.
const unitStart=inline.indexOf("const ACTIVITY_UNIT_HINTS=");
const unitEnd=inline.indexOf("// Hari libur nasional",unitStart);
assert(unitStart>=0&&unitEnd>unitStart,"Katalog saran satuan belum ada");
const known=vm.runInNewContext(inline.slice(unitStart,unitEnd)+";canonicalActivityUnit('dOkUmEn')");
const custom=vm.runInNewContext(inline.slice(unitStart,unitEnd)+";canonicalActivityUnit('  Berkas Khusus  ')");
assert.equal(known,"Dokumen","Nama satuan umum harus dibakukan kapitalisasinya");
assert.equal(custom,"Berkas Khusus","Satuan khusus tidak boleh dibatasi secara kaku");
assert(inline.includes("inp.setAttribute('list','activityUnitHints')"),"Input satuan belum memiliki pilihan saran");



// Yearly KRO mapping must be explicit and independent of a permanent code.
const kroResolveStart=inline.indexOf("function groupKroKey(team,group){");
const kroResolveEnd=inline.indexOf("function renderKroOptions(prefer){",kroResolveStart);
assert(kroResolveStart>=0&&kroResolveEnd>kroResolveStart,"Pemetaan kegiatan ke KRO tidak ditemukan");
const kroResolveCode=inline.slice(kroResolveStart,kroResolveEnd);
const kroContext={
 demoTeams:[{id:"T1",kroCodes:["9999.ABC.001"]}],
 POK_KROS:[{code:"9999.ABC.001",name:"Contoh KRO"}],
 NO_KRO:"__UNMAPPED__",
 state:{groupKroOverrides:{}},
 activeYear:2027,isBaseYear:false,
 GROUP_KRO_HINTS:{},
};
const evaluateKro=()=>vm.runInNewContext(kroResolveCode+";resolveGroupKro('T1','Kegiatan A')",kroContext);
assert.equal(evaluateKro(),"__UNMAPPED__","Tahun baru tidak boleh mengikat kegiatan otomatis ke satu KRO");
kroContext.state.groupKroOverrides={'["T1","Kegiatan A"]':"9999.ABC.001"};
assert.equal(evaluateKro(),"9999.ABC.001","Pemetaan KRO eksplisit tahun berjalan tidak terbaca");
kroContext.state.groupKroOverrides={};
kroContext.activeYear=2028;
assert.equal(evaluateKro(),"__UNMAPPED__","Pemetaan KRO tahun lama tidak boleh terbawa otomatis");
kroContext.isBaseYear=true;
assert.equal(evaluateKro(),"9999.ABC.001","Perilaku referensi 2026 harus dipertahankan");
kroContext.isBaseYear=false;
kroContext.state.groupKroOverrides={'["T1","Kegiatan A"]':"9999.XYZ.009"};
assert.equal(evaluateKro(),"__UNMAPPED__","Kode yang tidak berlaku untuk tim harus ditandai belum dipetakan");

const recommendStart=inline.indexOf("const KRO_SIMILAR_STOP=");
const recommendEnd=inline.indexOf("function suggestedKroForTeam(k,tid){",recommendStart);
assert(recommendStart>=0&&recommendEnd>recommendStart,"Rekomendasi KRO berdasar nama tidak ditemukan");
const recCtx={
 activeYear:2027,
 groupList:()=>[["Perencanaan Konsumsi Pangan",[]]],
 KRO_2026_REFERENCE:[],
 REKOMENDASI_KRO_LINTAS_TIM:{},
};
const rec=vm.runInNewContext(inline.slice(recommendStart,recommendEnd)+";kroRecommendation({code:'2027.AAA.001',name:'Perencanaan Konsumsi Pangan'},'T1')",recCtx);
assert.equal(rec.label,"Nama Kegiatan Sesuai","Saran KRO perlu mengikuti kesamaan Nama Kegiatan");
assert(rec.reason.includes("POK 2027"),"Rekomendasi harus menegaskan penetapan berdasarkan POK tahun berjalan");

const mapStart=inline.indexOf("function ensureKroActivityMapDialog(){");
const mapEnd=inline.indexOf("function renderKroBoard(){",mapStart);
const mapCode=inline.slice(mapStart,mapEnd);
assert(mapStart>=0&&mapEnd>mapStart,"Pop-up Pemetaan KRO dan Kegiatan belum ada");
assert(inline.includes('id="kroHubActivity"'),"Kartu Pemetaan KRO–Kegiatan belum ada");
assert(inline.includes("$('kroHubActivity').onclick=()=>showKroActivityMap()"),"Pembuka popup belum aktif");
assert(mapCode.includes('data-kro-activity-index'),"Pemilihan KRO per kegiatan belum tersedia");
assert(mapCode.includes("state.groupKroOverrides[x.key]=x.code"),"Pemetaan tahunan belum tersimpan");
assert(mapCode.includes("groupKroKey(tid,row[0])"),"Pemetaan KRO belum memakai pasangan Tim dan Kegiatan");
assert(mapCode.includes("if(!dialog.open)dialog.showModal()"),"Pemetaan harus tampil di pop-up");
assert(cssPolish.includes(".kro-activity-map-scroll{"),"Kegiatan panjang harus bergulir di pop-up");
assert(cssPolish.includes("#pageKRO .kro-hub-grid{display:grid;grid-template-columns:repeat(3"),"Tiga menu KRO harus berjajar rapi");

const aggStart=inline.indexOf("function periodAgg(period,teamFilter){");
const aggEnd=inline.indexOf("function workDays(period){",aggStart);
assert(aggStart>=0&&aggEnd>aggStart,"Fungsi beban tim tidak ditemukan");
const aggCtx={
 BASE:{employees:[{id:"E1"},{id:"E2"}],annual_allocations_source:[]},
 byId:new Map([["A1",{id:"A1",team_id:"T1"}]]),
 baseActivity:new Map(),
 baseMonthly:new Map([["A1|E1|1",3],["A1|E2|1",5]]),
 state:{allocEdits:{}},
 getStandard:()=>1,
};
const teamLoad=vm.runInNewContext(inline.slice(aggStart,aggEnd)+";periodAgg('1','T1')",aggCtx);
assert.equal(teamLoad.totals.get("E1"),3,"Alokasi anggota tim harus dihitung");
assert.equal(teamLoad.totals.get("E2"),5,"Pelaksana di luar keanggotaan tim tetap dihitung");
assert.equal([...teamLoad.totals.values()].reduce((sum,v)=>sum+v,0),8,"Beban Tim harus total Jam-Orang semua pelaksana kegiatan milik tim");


// Visual card-density regression suite: prevent broad, empty KPI cards.
const visualStart=cssPolish.indexOf("/* Audit visual menyeluruh November 2026: metric density and readable hierarchy.");
assert(visualStart>=0,"Audit visual Dashboard dan submenu belum diterapkan");
const visualRules=cssPolish.slice(visualStart);
const dashboardCardRules=[
 "#pageDashboard>.combined-metrics{",
 "grid-template-columns:repeat(4,minmax(0,1fr))!important;",
 "#pageDashboard>.combined-metrics>article{",
 "grid-template-columns:minmax(0,1fr) auto!important;",
 "min-height:76px!important;",
 "#pageDashboard>.combined-metrics>article>small{",
 "#pageDashboard>.combined-metrics>article>strong{",
 "justify-self:end!important;",
 "background:linear-gradient(125deg,#d6eaff,#e9f5ff)!important;",
 "#pageDashboard>.combined-metrics>article:nth-child(4)>strong{"
];
for(const rule of dashboardCardRules)assert(visualRules.includes(rule),"KPI Dashboard masih berpotensi kosong atau angkanya kurang tegas: "+rule);
for(const rule of [
 "#pageTeams .team-admin-kpis>.quickbox:not(.hidden){",
 "#pageRecon .mini-kpi{",
 "#pageFinal .combined-final-grid>div{",
 "#pageInput .input-quick-grid .quickbox{",
 "#pageKRO .kro-hub-grid>.kro-hub-card{",
 ".page :is(.mon-kpi,.tl-kpi,.recon-card,.kro-audit-kpi,.stat){",
 "@media(max-width:1410px){",
 "@media(max-width:600px){",
 "@media(prefers-reduced-motion:reduce){"
]) assert(visualRules.includes(rule),"Audit kartu lintas submenu belum lengkap: "+rule);
const dashboardRenderStart=inline.indexOf("function renderCombinedDashboard(){");
const dashboardRenderEnd=inline.indexOf("let kroBoardDraft=",dashboardRenderStart);
assert(dashboardRenderStart>=0&&dashboardRenderEnd>dashboardRenderStart,"Kartu ringkasan Dashboard tidak dapat diperiksa");
const dashboardRender=inline.slice(dashboardRenderStart,dashboardRenderEnd);
for(const label of ["Tim","Pegawai Aktif","Uraian Aktif","Total Jam Alokasi"]){
 assert(dashboardRender.includes("<small>"+label+"</small>"),"Label ringkasan Dashboard terhapus: "+label);
}
assert(dashboardRender.split("<article><small>").length===5,"Dashboard harus tetap memiliki empat KPI, bukan duplikasi atau kartu kosong");


// Audit lanjutan 9 November: kartu monitoring tidak boleh menyisakan
// tinggi paksa, laporan cetak harus menggunakan tahun dan periode aktual.
// Companion cards must use grid stretch, not independently sized content
// and not a fixed height that creates a giant blank detail panel.
const pairStart=cssPolish.indexOf("/* Desktop: two companion cards share the SAME grid-row height.");
const pairEnd=cssPolish.indexOf("#pageDashboard .person-panel .person-metrics{",pairStart);
assert(pairStart>=0&&pairEnd>pairStart,"Aturan tinggi seimbang kartu tidak ditemukan");
const pairCss=cssPolish.slice(pairStart,pairEnd);
for(const rule of [
  "align-items:stretch!important;",
  "align-self:stretch!important;",
  "height:auto!important;",
  "grid-auto-rows:auto!important;",
  "max-height:none!important;",
  "max-height:min(54dvh,440px)!important;",
  "margin-top:auto!important;",
  "overflow-y:auto!important;"
]) assert(pairCss.includes(rule),"Dua kartu monitoring belum setara: "+rule);
assert(!pairCss.includes("height:clamp("),"Tinggi tetap kartu dapat menghasilkan ruang kosong berlebihan");
assert(!pairCss.includes("align-items:start!important"),"Kartu berdampingan masih disejajarkan ke atas saja");
assert(!cssPolish.includes("height:clamp(470px,54dvh,560px)"),
  "Aturan tinggi 560px lama masih bertentangan");
assert(cssPolish.includes("#pageDashboard .person-panel .person-work-trigger"),
  "Tombol rincian pegawai harus tetap tersedia");

assert(html.includes('id="barMetricTitle">Jam Kerja</span>'),
  "Label indikator grafik belum konsisten Kapital Awal Kata");
const personStart=inline.indexOf("function renderPerson(");
const personEnd=inline.indexOf("function renderHistory(",personStart);
assert(personStart>=0&&personEnd>personStart,"Rincian pegawai tidak ditemukan");
const personCode=inline.slice(personStart,personEnd);
assert(personCode.includes("const auditMarkup=isBaseYear?"),
  "Audit acuan 2026 tidak boleh ditampilkan sebagai perbandingan pada tahun berikutnya");
assert(personCode.includes("${auditMarkup}</div>"),
  "Ringkasan pegawai belum memakai audit sesuai tahun aktif");

/* The dashboard employee detail must not repeat the full activities view.
   One enlarged button summarizes workload across Tim, Kegiatan and Uraian.
   Full group names and descriptions are always available in the modal. */
for(const token of [
 "const teamCount=new Set(groups.map(g=>g.team)).size;",
 "person-work-trigger-large",
 "person-work-trigger-metrics",
 "${nf(teamCount)}",
 "${nf(groups.length)}",
 "${nf(rows.length)}",
 "Klik untuk melihat nama kegiatan, uraian tugas, dan alokasi Jam tiap pekerjaan.",
 "openPersonWorkDialog({"
]){
 assert(personCode.includes(token),"Ringkasan beban kerja pegawai tidak lengkap: "+token);
}
assert(!personCode.includes("const featuredGroups=groups.slice(0,5);"),
 "Kartu pegawai masih menduplikasi daftar pekerjaan sebelum tombol pop-up");
const modalStart=inline.indexOf("function openPersonWorkDialog(");
const modalEnd=inline.indexOf("function renderPerson(",modalStart);
assert(modalStart>=0&&modalEnd>modalStart,"Fungsi rincian pekerjaan tidak ditemukan");
const workDialogCode=inline.slice(modalStart,modalEnd);
for(const token of [
 "group.items.map(item=>",
 "${esc(group.activity)}",
 "${esc(item.title)}",
 "${nf(item.hours)} Jam",
 "Tim Terlibat",
 "Kegiatan Tim",
 "Uraian Pekerjaan"
 ]) assert(workDialogCode.includes(token),"Pop-up kehilangan rincian kegiatan/uraian: "+token);
for(const token of [
 "#pageDashboard .person-panel .person-work-trigger-large{",
 "min-height:156px!important;",
 ".person-work-trigger-metrics{",
 ".person-work-dialog-scroll{",
 "display:block!important;",
 ".person-work-dialog-scroll>.person-work-group{",
 "height:auto!important;",
 ".person-work-dialog-scroll .person-work-items{",
 "overflow-y:auto!important;",
 "grid-template-columns:repeat(4,minmax(0,1fr))!important;"
]) assert(cssPolish.includes(token),"Desain modal / kartu rincian belum tepat: "+token);
assert(!cssPolish.includes("person-work-preview-list"),
 "CSS ringkasan pekerjaan ganda belum dibersihkan");
const printStart=inline.indexOf("function printMonitoringPDF(){");
const printEnd=inline.indexOf("function exportCSV(){",printStart);
assert(printStart>=0&&printEnd>printStart,"Cetak laporan monitoring tidak ditemukan");
const printCode=inline.slice(printStart,printEnd);
assert(printCode.includes("p==='annual'?'Referensi Tahunan '"),
  "Periode cetak annual harus ditulis sebagai referensi tahunan, bukan undefined");
assert(printCode.includes("Dicetak pada ${new Date().toLocaleString('id-ID')}"),
  "Tanggal cetak belum diisi dinamis");
assert(!printCode.includes("prototipe '+activeYear+'"),
  "Laporan cetak masih menampilkan teks tahun yang tidak dievaluasi");


/* Checklist dropdown audit: rows must not inherit the normal field input's
   43–44px minimum height. Selection should not jump back to the list top. */
for(const rule of [
 "grid-template-columns:18px minmax(0,1fr)!important;",
 "min-height:16px!important;",
 "padding:0!important;",
 "align-items:center!important;",
 "min-height:37px!important;",
 "scrollbar-gutter:stable;",
 ".trend-picker-list > label.trend-picker-choice > span",
 ".trend-picker-list > label.trend-picker-choice.trend-picker-all"
]){
 assert(cssPolish.includes(rule),"Daftar checkbox Tim/Kegiatan belum rapi: "+rule);
}
const popupFnStart=inline.indexOf("function renderTrendPickerOptions(kind){");
const popupFnEnd=inline.indexOf("function openTrendPicker(kind){",popupFnStart);
assert(popupFnStart>=0&&popupFnEnd>popupFnStart,"Renderer checkbox Tim/Kegiatan tidak ditemukan");
const popupRenderCode=inline.slice(popupFnStart,popupFnEnd);
assert(popupRenderCode.includes("const scrollTop=list.scrollTop;")&&popupRenderCode.includes("list.scrollTop=scrollTop;"),
 "Daftar checkbox meloncat ke awal setelah mengubah pilihan");


// Kelola Tim: list is searchable and rows allow select / edit / guarded delete.
// Legacy hidden select is retained only as internal state for dependent views.
for(const token of [
 'id="teamAdminSearch"',
 'id="teamAdminStatus"',
 'id="teamAdminDirectory"',
 'id="teamAdminDirectoryCount"',
 'id="teamAdminSelect" class="hidden" hidden',
 'id="teamAdminNew"',
 'data-team-dir-delete'
]) {
 if(token==='data-team-dir-delete')continue;
 assert(html.includes(token),"Daftar Tim belum tersedia: "+token);
}
// Add Team should appear under search and directly above the status filter,
 // not beside the Daftar Tim heading.
const teamDirStart=html.indexOf('<h3>01 · Pilih Tim</h3>');
const teamDirEnd=html.indexOf('id="teamAdminDirectoryCount"',teamDirStart);
assert(teamDirStart>=0&&teamDirEnd>teamDirStart,"Daftar Tim heading/filter markup tidak ditemukan");
const teamHeaderBlock=html.slice(teamDirStart,teamDirEnd);
const searchPos=teamHeaderBlock.indexOf('id="teamAdminSearch"');
const addPos=teamHeaderBlock.indexOf('id="teamAdminNew"');
const statusPos=teamHeaderBlock.indexOf('id="teamAdminStatus"');
assert(searchPos>=0&&searchPos<addPos&&addPos<statusPos,
 "Tombol Tambah Tim wajib tepat di antara Cari Tim Kerja dan Status Tim");
assert((html.match(/id="teamAdminNew"/g)||[]).length===1,
 "Tombol Tambah Tim tidak boleh muncul ganda");
assert(cssPolish.includes("#pageTeams .team-admin-list .team-directory-add{"),
 "Tombol Tambah Tim belum tampil penuh dan rapi di atas filter status");
assert(!html.includes('<label>Tim kerja</label><select id="teamAdminSelect"'),
 "Daftar Tim masih memakai dropdown tunggal yang tidak dapat dikelola.");
for(const token of [
 "function renderTeamDirectory(){",
 "function selectTeamFromDirectory(",
 "function renameTeamFromDirectory(",
 "function commitTeamDirectoryRename(",
 "function activeTeamList(){",
 "host.querySelectorAll('[data-team-rename-save]')",
 "host.querySelectorAll('[data-team-rename-cancel]')",
 "const actionLabel=inactive?'Aktifkan'",
 "$('teamAdminStatus').onchange=renderTeamDirectory;",
 "team.active=false;",
 "team.active=true;",
 "renderTeamAdminPage();renderYearUI();",
 "function renameTeamFromDirectory(",
 "async function createTeamAdmin(){",
 "async function deleteTeamAdmin(requestedId=null){",
 "function teamDeletionReason(tid){",
 "host.querySelectorAll('[data-team-dir-delete]')",
 "$('teamAdminSearch').oninput=renderTeamDirectory;",
 "renderEstablishedTeams();renderTeamDirectory();",
 "saveTeamStore();",
 "yearInfo().status==='closed'",
 "logChange('Hapus tim kerja'"
])assert(inline.includes(token),"Daftar Tim belum terintegrasi dengan sistem: "+token);
for(const token of [
 "#pageTeams .team-directory-list{",
 "#pageTeams .team-directory-inline-edit{",
 "#pageTeams .team-directory-status{",
 "#pageTeams .team-directory-action.archive{",
 "#pageTeams .team-directory-action.restore{",
 "#pageTeams .team-directory-row{",
 "#pageTeams .team-directory-action.delete:disabled{",
 "#pageTeams .team-directory-row.is-selected{",
 "#pageTeams .team-directory-toolbar>input{"
])assert(cssPolish.includes(token),"Tampilan Daftar Tim belum rapi: "+token);
const guardStart=inline.indexOf("function activeTeamList(){");
const guardEnd=inline.indexOf("let editingTeamNameId=null;",guardStart);
assert(guardStart>=0&&guardEnd>guardStart,"Validasi penghapusan tim tidak ditemukan");
const guardCode=inline.slice(guardStart,guardEnd);
const sampleTeams=[{id:'T1',name:'Satu'},{id:'T2',name:'Dua'}];
// Make the guard tests independent of the browser and verify year-specific
// history, including when an old activity has disappeared from the new year.
const guardCase=(opts={})=>{
 const teams=opts.teams||sampleTeams,year=opts.year||2026,seed=opts.seed||{activities:[],monthly_allocations_source:[]};
 const live=opts.live||{added:[],allocEdits:{},workflowPlans:{}};
 const saved=opts.saved||{};
 const context={
  demoTeams:teams,activities:opts.activities||[],state:live,
  yearSetup:opts.setup||{teams:{},kros:{}},
  demoRoster:opts.roster||{},baseMonthly:opts.monthly||new Map(),
  activeYear:year,
  yearInfo:()=>({status:opts.status||'draft'}),
  document:{getElementById:()=>({textContent:JSON.stringify(seed)})},
  localStorage:{getItem:key=>JSON.stringify(saved[key]||null)}
 };
 return vm.runInNewContext(guardCode+";teamDeletionReason('T1')",context);
};
assert.equal(guardCase(),'', "Tim tanpa hubungan boleh dihapus");
assert.equal(guardCase({roster:{T1:{members:['E01'],leaderId:''}}}),'Masih memiliki ketua atau anggota',
 "Tim dengan anggota tidak boleh dihapus sebelum keanggotaan dibersihkan");
assert.equal(guardCase({roster:{T1:{members:[],leaderId:'E01'}}}),'Masih memiliki ketua atau anggota',
 "Tim yang masih memiliki ketua tidak boleh dihapus");
assert.equal(guardCase({activities:[{id:'A01',team_id:'T1'}]}),'Masih memiliki kegiatan',
 "Tim dengan kegiatan belum dialokasikan tidak boleh dihapus");
assert.equal(guardCase({setup:{teams:{T1:{leaderId:'E01'}},kros:{}}}),
 'Susunan Tim atau KRO sudah ditetapkan',"Penetapan tim tidak boleh hilang");
assert.equal(guardCase({teams:[{id:'T1',name:'Satu',kroCodes:['K01']},sampleTeams[1]]}),
 'Masih memiliki KRO',"Tim masih terikat KRO tidak boleh dihapus");
assert.equal(guardCase({seed:{activities:[{id:'A01',team_id:'T1'}],monthly_allocations_source:[['A01','E01',1,8]]}}),
 'Pernah memiliki alokasi pekerjaan',"Acuan alokasi tahun 2026 tidak boleh hilang");
assert.equal(guardCase({activities:[{id:'A01',team_id:'T1'}],live:{added:[],allocEdits:{'A01|E01|2':0},workflowPlans:{}}}),
 'Pernah memiliki alokasi pekerjaan',"Jejak revisi nol tetap riwayat alokasi");
assert.equal(guardCase({year:2027,live:{added:[],allocEdits:{},workflowPlans:{}},saved:{
 'bps-blora-matriks-pegawai-2026-prototype-v13':{added:[{id:'AOLD',team_id:'T1'}],allocEdits:{'AOLD|E01|1':6}}
 }}),'Pernah memiliki alokasi pekerjaan',
 "Riwayat tahun sebelumnya wajib menghalangi penghapusan permanen");
assert.equal(guardCase({status:'closed'}),'Tahun telah ditutup',
 "Tim pada tahun tutup tidak boleh dihapus");
assert.equal(guardCase({teams:[sampleTeams[0]]}),'Minimal satu tim aktif harus tetap tersedia',
 "Tim aktif terakhir tidak boleh dihapus");
assert.equal(guardCase({teams:[{id:'T1',name:'Satu',active:false},sampleTeams[1]]}),'',
 "Tim nonaktif tanpa ketergantungan dapat diperiksa kembali");
assert(inline.includes("const actionLabel=inactive?'Aktifkan':reason?'Nonaktifkan':'Hapus'"),
 "Tim yang memiliki ketergantungan wajib hanya bisa dinonaktifkan");
assert(inline.includes("if(teamDeletionReason(id))return toast("),
 "Wajib memeriksa ulang seluruh syarat sebelum penghapusan permanen");
assert(inline.includes("Keanggotaan, kegiatan, KRO, dan alokasi historis tidak akan dihapus."),
 "Konfirmasi nonaktifkan harus menjelaskan riwayat yang tetap tersimpan");
assert(inline.includes("const historicalTeamOpts=BASE.teams.map("),
 "Tim nonaktif harus tetap dapat ditemukan pada monitoring historis");
assert(inline.includes("const teamOpts=BASE.teams.filter(t=>t.active!==false)"),
 "Tim nonaktif tidak boleh tersedia pada penugasan baru");
assert(inline.includes("data-team-rename-value="),
 "Edit nama tim harus menampilkan input dan tombol simpan langsung pada baris");
assert(!inline.includes("async function renameTeamFromDirectory("),
 "Edit nama tim tidak boleh bergantung pada prompt yang tidak terlihat");
assert(inline.includes("const name=input.value.trim();"),
 "Simpan ubah nama tim harus memakai nilai input dari baris");


// Guided team setup: selecting a team and establishing its roster must
// precede annual KRO assignment and activity allocation.
const teamChoose=html.indexOf('<h3>01 · Pilih Tim</h3>');
const teamRoster=html.indexOf('<h3>02 · Ketua dan Anggota Tim</h3>');
const teamKro=html.indexOf('id="teamKroStep"');
const teamActivity=html.indexOf('id="teamOverviewHeading"');
const teamActivityAction=html.indexOf('id="teamAdminGoInput"');
assert(teamChoose>=0&&teamChoose<teamRoster&&teamRoster<teamKro&&teamKro<teamActivity&&teamActivity<teamActivityAction,
 "Kelola Tim belum berurutan: Pilih Tim → Ketua/Anggota → KRO → Kegiatan");
for(const token of [
 'id="teamRosterActionSlot"',
 'id="teamRosterGuide"',
 'id="teamAdminSelectedName"',
 'id="teamOverviewList"',
 'id="teamAdminGoKro"',
 'id="teamNextHint"',
 'id="teamAdminName" type="hidden"'
])assert(html.includes(token),"Elemen alur Kelola Tim hilang: "+token);
assert((html.match(/id="teamAdminGoInput"/g)||[]).length===1,
 "Tombol kelola kegiatan tidak boleh muncul ganda atau mendahului penetapan tim");
for(const token of [
 "function renderTeamWorkflow(){",
 "renderEstablishedTeams();renderTeamDirectory();renderTeamWorkflow();",
 "const actions=page.querySelector('#annualTeamStage > .annual-team-actions');",
 "$('teamRosterActionSlot').appendChild(actions);",
 "$('teamAdminLeader').onchange=onTeamLeaderChanged;", 
 "drawWorkingMembers();renderYearSetup();renderTeamWorkflow()", 
 "$('teamAdminGoKro').onclick=()=>",
 "$('teamAdminGoInput').onclick=()=>",
 "if(!yearSetup.teams?.[tid]||!staffReady())",
 "if(!isBaseYear&&!allowYearTask(tid))return;"
])assert(inline.includes(token),"Alur penetapan tidak tersambung: "+token);
for(const token of [
 "#pageTeams #annualTeamStage .annual-stage-select{display:none!important}",
 "#pageTeams .team-roster-action-slot{",
 "#pageTeams .team-activity-overview{",
 "#pageTeams .team-overview-chip{",
 "#pageTeams .team-activity-open:disabled,",
 "#pageTeams #annualTeamGridSlot .team-admin-grid{"
])assert(cssPolish.includes(token),"Desain tahapan Kelola Tim belum selesai: "+token);
const workflowStart=inline.indexOf("function renderTeamWorkflow(){");
const workflowEnd=inline.indexOf("function renderTeamAdminPage(){",workflowStart);
assert(workflowStart>=0&&workflowEnd>workflowStart,"Renderer alur Kelola Tim tidak ditemukan");
const workflowCode=inline.slice(workflowStart,workflowEnd);
assert(workflowCode.includes("goInput.disabled=!active||!ready||!kroReady||!canWrite;"),
 "Input Alokasi harus menunggu susunan tim dan KRO yang berlaku");
assert(workflowCode.includes("const activeTasks=activities.filter(")&&workflowCode.includes("groupName(a)"),
 "Ringkasan Kegiatan harus berasal dari kepemilikan kegiatan, bukan keanggotaan");


// Unified staff/team cards and safe amendment rules, November 2026.
const staffCardStart=html.indexOf('<details id="annualStaffChooser"');
const staffCompleteStart=html.indexOf('id="annualStaffComplete"');
const teamStageStart=html.indexOf('id="annualTeamStage"');
const teamStageEnd=html.indexOf('id="annualKroStage"',teamStageStart);
assert(staffCardStart>=0&&staffCompleteStart>staffCardStart&&teamStageStart>staffCompleteStart,
 "Kartu Daftar Pegawai dan Susunan Tim hilang");
const staffCardMarkup=html.slice(staffCardStart,staffCompleteStart);
assert(staffCardMarkup.includes('annual-staff-unified')&&staffCardMarkup.includes('id="annualStaffActionLabel"'),
 "Status dan tombol Daftar Pegawai wajib berada di satu kartu yang bisa dibuka");
assert(html.includes('id="annualStaffComplete" class="annual-step-complete hidden" hidden aria-hidden="true"'),
 "Ringkasan hijau Daftar Pegawai lama tidak boleh tampil kedua kalinya");
assert(!html.includes('class="panel employee-master-panel"'),
 "Panel Daftar Pegawai duplikat harus dihapus sepenuhnya, bukan sekadar disembunyikan");
assert(!html.includes('id="employeeMasterList"')&&!html.includes('id="empSearch"')&&!html.includes('id="empStatus"')&&!html.includes('id="empType"')&&!html.includes('id="empAdd"'),
 "Kontrol Daftar Pegawai lama masih tertinggal dan menimbulkan duplikasi");
assert(!inline.includes('function renderEmployeeMaster()')&&!inline.includes("renderEmployeeMaster();"),
 "Renderer Daftar Pegawai duplikat masih dipanggil di JavaScript");
assert(!inline.includes("$('empSearch')")&&!inline.includes("$('empAdd')"),
 "Handler Daftar Pegawai lama masih mengakses elemen yang telah dihapus");
assert(inline.includes("$('annualAddStaff').addEventListener('click'")&&
 inline.includes("host.querySelectorAll('[data-annual-edit]')")&&
 inline.includes("openEmployeeEditor(el.dataset.annualEdit)"),
 "Tambah dan Edit Pegawai di pop-up Daftar Pegawai tahunan harus tetap berfungsi");
assert(html.includes('id="employeeScreen"')&&html.includes('id="annualStaffList"'),
 "Editor dan pemilihan pegawai tahunan tetap harus tersedia");
const teamStageMarkup=html.slice(teamStageStart,teamStageEnd);
assert(teamStageMarkup.includes('id="annualTeamSummary" class="annual-team-state hidden"')&&
 teamStageMarkup.includes('id="annualTeamHeadAction"'),
 "Status Tim dan aksi Ubah Anggota harus menyatu dengan kepala kartu Tim");
assert(teamStageMarkup.includes('id="annualCancelTeam"'),
 "Mode Ubah Tim memerlukan Batal untuk membuang draf");
const stageRenderStart=inline.indexOf("function renderYearSetup(){");
const stageRenderEnd=inline.indexOf("function confirmStaffYear(){",stageRenderStart);
const renderYearCode=inline.slice(stageRenderStart,stageRenderEnd);
assert(renderYearCode.includes("chooser.classList.toggle('is-confirmed'"),
 "Daftar Pegawai harus berubah menjadi satu kartu hijau ketika sudah ditetapkan");
assert(renderYearCode.includes("teamStage.classList.toggle('is-confirmed'"),
 "Susunan Tim juga harus memiliki status hijau dalam kartu yang sama");
assert(renderYearCode.includes("const rosterLocked=teamComplete||!writable||!allReady||!canTeam;")&&
 renderYearCode.includes("$('annualCancelTeam').classList.toggle('hidden'"),
 "Susunan Tim yang sudah ditetapkan tidak boleh tersunting diam-diam sebelum mode Ubah");
assert(inline.includes("$('annualStaffChooser').addEventListener('toggle'"),
 "Klik kartu Daftar Pegawai harus membuka daftar yang dapat diperiksa/diubah");
assert(inline.includes("$('annualCancelTeam').addEventListener('click'"),
 "Batalkan edit tim harus mengembalikan keadaan tersimpan");
assert(inline.includes("if(String(previous)!==String(tid)&&annualEditingTeamId===previous)"),
 "Perubahan anggota yang belum disimpan harus dibatalkan jelas ketika berganti tim");
const confirmTeamStart=inline.indexOf("function confirmTeamYear(){");
const confirmTeamEnd=inline.indexOf("function confirmKroYear(){",confirmTeamStart);
const confirmTeamCode=inline.slice(confirmTeamStart,confirmTeamEnd);
assert(!confirmTeamCode.includes("delete yearSetup.kros[tid]"),
 "Mengubah anggota tidak boleh menghapus penetapan KRO tim");
const confirmStaffStart=inline.indexOf("function confirmStaffYear(){");
const confirmStaffEnd=inline.indexOf("function copyPreviousRoster(){",confirmStaffStart);
const confirmStaffCode=inline.slice(confirmStaffStart,confirmStaffEnd);
assert(!confirmStaffCode.includes("delete yearSetup.kros[tid]"),
 "Mengubah daftar pegawai tidak boleh menghapus KRO tanpa perubahan kepemilikan KRO");
const saveTeamStart=inline.indexOf("function saveTeamAdmin(){");
const saveTeamEnd=inline.indexOf("function renameTeamFromDirectory(",saveTeamStart);
const saveTeamCode=inline.slice(saveTeamStart,saveTeamEnd);
assert(saveTeamCode.includes("if(rosterChanged){delete yearSetup.teams[tid];")&&
 saveTeamCode.includes("if(!equalIds(oldKro,team.kroCodes)){delete yearSetup.kros[tid];"),
 "Perubahan susunan menuntut penetapan ulang, tetapi perubahan KRO saja yang membatalkan penetapan KRO");
const teamWorkflowStart=inline.indexOf("function renderTeamWorkflow(){");
const teamWorkflowEnd=inline.indexOf("function renderTeamAdminPage(){",teamWorkflowStart);
const teamWorkflowCode=inline.slice(teamWorkflowStart,teamWorkflowEnd);
assert(teamWorkflowCode.includes("const ready=confirmed&&staffReady()&&!editing&&!draftChanged;"),
 "Tombol lanjutan KRO/Alokasi wajib terkunci saat revisi anggota belum ditetapkan");
for(const token of [
 "#pageTeams #annualSetupPanel .annual-staff-unified.is-confirmed{",
 "#pageTeams .annual-staff-action{",
 "#pageTeams #annualTeamStage.is-confirmed>.annual-stage-head{",
 "#pageTeams .annual-team-head-right{",
 "#pageTeams .employee-master-panel[hidden],",
 "#pageTeams #annualTeamStage .team-admin-grid.is-complete{display:grid}"
])assert(cssPolish.includes(token),"Tampilan kartu gabungan Daftar Pegawai/Tim belum lengkap: "+token);


// Per-team establishment, bidirectional leader/member validation, and
// all-active-team approval; test the status model with two disjoint teams.
const leaderHelperStart=inline.indexOf("function eligibleAnnualTeamEmployees(){");
const leaderHelperEnd=inline.indexOf("function renderTeamAdminPage(){",leaderHelperStart);
assert(leaderHelperStart>=0&&leaderHelperEnd>leaderHelperStart,
 "Sinkronisasi Ketua dan Anggota Tim tidak ditemukan");
const leaderHelper=inline.slice(leaderHelperStart,leaderHelperEnd);
for(const token of [
 "memberIds.size?eligible.filter(e=>memberIds.has(e.id)):eligible",
 "if(chosen&&chosen!=='external'&&!adminMemberWorking.has(chosen))adminMemberWorking.add(chosen);",
 "syncLeaderWithMembers();",
 "drawWorkingMembers();"
])assert(leaderHelper.includes(token),"Pilihan Ketua dan Anggota belum saling terhubung: "+token);
assert(inline.includes("if(!adminMemberWorking.has(leaderId))return toast("),
 "Ketua wajib tercentang ketika melakukan penetapan susunan");
assert(inline.includes("if(currentRole==='ketua'&&id===demoRoster[tid]?.leaderId)"),
 "Ketua tidak boleh mengeluarkan dirinya dari keanggotaan tim yang ditetapkan");
const leaderSelect={value:'',options:[],disabled:false};
const leaderControls={
 teamAdminLeader:leaderSelect,
 teamAdminSelect:{value:'T1'},
 teamAdminLeaderHint:{textContent:''},
 teamAdminMemberCount:{textContent:''}
};
const leadCtx={
 $:id=>leaderControls[id],
 currentRole:'admin',roleTeamId:'T1',
 demoRoster:{T1:{leaderId:'',members:[]}},
 yearSetup:{staff:{confirmed:true,ids:['E1','E2','E3']}},
 BASE:{employees:[{id:'E1',type:'pegawai',active:true,full_name:'A'},{id:'E2',type:'pegawai',active:true,full_name:'B'},{id:'E3',type:'pegawai',active:true,full_name:'C'}]},
 adminMemberWorking:new Set(),
 fillSelect:(node,options,value)=>{node.options=options;node.value=value},
 drawWorkingMembers:()=>{},
 nf:n=>String(n),renderYearSetup:()=>{},renderTeamWorkflow:()=>{}
};
vm.runInNewContext(leaderHelper+";syncLeaderWithMembers()",leadCtx);
assert.deepEqual(Array.from(leaderSelect.options,o=>o.value),['','E1','E2','E3'],
 "Sebelum ada centang, pilihan Ketua harus menampilkan seluruh Pegawai Tahunan");
leaderSelect.value='E2';
vm.runInNewContext(leaderHelper+";onTeamLeaderChanged()",leadCtx);
assert(leadCtx.adminMemberWorking.has('E2'),
 "Memilih Ketua lebih dahulu harus otomatis mencentang dirinya pada Anggota");
leadCtx.adminMemberWorking.add('E3');
vm.runInNewContext(leaderHelper+";syncLeaderWithMembers()",leadCtx);
assert.deepEqual(Array.from(leaderSelect.options,o=>o.value),['','E2','E3'],
 "Sesudah mencentang anggota, pilihan Ketua hanya boleh dari anggota tercentang");
const teamValidationStart=inline.indexOf("function teamEstablishmentIssue(tid){");
const teamValidationEnd=inline.indexOf("function yearKroReady(tid){",teamValidationStart);
assert(teamValidationStart>=0&&teamValidationEnd>teamValidationStart,
 "Pemeriksaan lengkap seluruh Tim Aktif tidak ditemukan");
const teamValidationCode=inline.slice(teamValidationStart,teamValidationEnd);
const establishCase=(opts={})=>{
 const setup={staff:{confirmed:true,ids:['E1','E2','E3']},teams:{T1:{leaderId:'E1',members:['E1','E2']}}};
 const roster={T1:{leaderId:'E1',members:['E1','E2']},T2:{leaderId:'E3',members:['E3']}};
 const ctx={
  demoTeams:opts.teams||[{id:'T1',name:'Satu',active:true},{id:'T2',name:'Dua',active:true}],
  yearSetup:opts.setup||setup,
  yearRosterRecord:id=>(opts.roster||roster)[id]||{members:[],leaderId:''},
  equalIds:(a,b)=>[...new Set(a||[])].sort().join('|')===[...new Set(b||[])].sort().join('|')
 };
 return vm.runInNewContext(teamValidationCode+";annualTeamCompletion()",ctx);
};
const incomplete=establishCase();
assert.equal(incomplete.total,2,"Persetujuan harus memeriksa SEMUA Tim Aktif");
assert.equal(incomplete.ready,1,"Penetapan satu tim saja tidak cukup untuk persetujuan");
assert.equal(incomplete.pending[0].name,'Dua',"Nama Tim yang belum menetapkan wajib muncul");
const readyCase=establishCase({setup:{staff:{confirmed:true,ids:['E1','E2','E3']},teams:{
 T1:{leaderId:'E1',members:['E1','E2']},T2:{leaderId:'E3',members:['E3']}}}});
assert.equal(readyCase.ready,2,"Seluruh Tim lengkap harus lolos pemeriksaan");
assert.equal(readyCase.pending.length,0,"Tidak boleh ada Tim menghambat persetujuan bila semua lengkap");
const mismatch=establishCase({roster:{T1:{leaderId:'E1',members:['E2']},T2:{leaderId:'E3',members:['E3']}}});
assert.equal(mismatch.ready,0,"Ketua yang tidak dicentang sebagai Anggota tidak boleh dianggap ditetapkan");
const inactiveCase=establishCase({teams:[{id:'T1',name:'Satu',active:true},{id:'T2',name:'Dua',active:false}]});
assert.equal(inactiveCase.total,1,"Tim Nonaktif tidak menghambat persetujuan tahunan");
const approveAt=inline.indexOf("async function approveAnnual(){");
const approveBody=inline.slice(approveAt,inline.indexOf("function refreshYearLabels()",approveAt));
assert(approveBody.includes("const teams=annualTeamCompletion();")&&approveBody.includes("if(teams.pending.length)"),
 "Admin/Kepala tidak boleh menyetujui sebelum semua Tim Aktif selesai");
assert(approveBody.includes("if(annualTeamCompletion().pending.length)"),
 "Penetapan Tim harus dicek ulang pada saat persetujuan akhir");
assert(inline.includes("const teamProgress=annualTeamCompletion();")&&
 inline.includes("teamProgress.pending.length===0"),
 "Tombol persetujuan di dashboard harus terkunci bila ada tim belum ditetapkan");
assert(inline.includes("const pendingTeamLabels=teamProgress.pending.map("),
 "Finalisasi harus menunjukkan daftar tim penghambat persetujuan");
assert(inline.includes("teamProgress.pending.length||!publishedAllocationCount()?"),
 "Tombol Finalisasi harus memvalidasi semua Tim Aktif serta alokasi");


// Team status summary is a compact card; full lists open in a native modal.
const teamSummaryStart=inline.indexOf("let establishedTeamFilter='ready';");
const teamSummaryEnd=inline.indexOf("/* Daftar Tim tahunan:",teamSummaryStart);
assert(teamSummaryStart>=0&&teamSummaryEnd>teamSummaryStart,
 "Ringkasan Penetapan Tim dan filter status tidak ditemukan");
const teamSummaryCode=inline.slice(teamSummaryStart,teamSummaryEnd);
for(const token of [
 "function establishedTeamSnapshot(){",
 "function ensureEstablishedTeamDialog(){",
 "function renderEstablishedTeamDialog(){",
 "function openEstablishedTeamDialog(filter='ready',trigger=null){",
 "function renderEstablishedTeams(){",
 "dialog=document.createElement('dialog');",
 "dialog.id='establishedTeamDialog';",
 "dialog.setAttribute('aria-labelledby','establishedTeamDialogTitle');",
 "dialog.showModal();",
 "dialog.addEventListener('close'",
 "if(back?.isConnected)back.focus({preventScroll:true});",
 "data-team-summary-filter=",
 "data-team-summary-dialog-filter=",
 "aria-haspopup=\"dialog\"",
 "id=\"teamSummaryDialogList\"",
 "el.onclick=event=>",
 "el.onkeydown=event=>",
 "openEstablishedTeamDialog(btn.dataset.teamSummaryFilter,btn);",
 "establishedTeamFilter=btn.dataset.teamSummaryDialogFilter;",
 "if(!roleCanManageTeam(tid))",
 "teamEstablishmentIssue(t.id)",
 "data-team-summary-edit="
])assert(teamSummaryCode.includes(token),"Pop-up status Penetapan Tim belum benar: "+token);
// The full-width detached summary is gone; the existing green Susunan Tim
// header owns the status controls, but the detail modal is unchanged.
const teamHostStart=inline.indexOf("const rosterHost=$('establishedTeamSummary')||document.createElement('div');");
const teamHostEnd=inline.indexOf("const legacy=document.createElement('div');",teamHostStart);
assert(teamHostStart>=0&&teamHostEnd>teamHostStart,
 "Ringkasan Penetapan Tim harus dipindah ke kepala kartu Susunan Tim");
const teamHostCode=inline.slice(teamHostStart,teamHostEnd);
assert(teamHostCode.includes("rosterHost.className='team-summary-inline';")&&
 teamHostCode.includes("teamHead.appendChild(rosterHost)"),
 "Status penetapan wajib berada di dalam header hijau Susunan Tim");
assert(!teamHostCode.includes("grid.after(rosterHost)")&&
 !teamHostCode.includes("panel.after(rosterHost)"),
 "Kartu Ringkasan Penetapan Tim terpisah harus dihilangkan");
assert(teamSummaryCode.includes("<strong>Ringkasan Seluruh Tim</strong>")&&
 teamSummaryCode.includes("data-team-summary-open")&&
 teamSummaryCode.includes("openEstablishedTeamDialog('ready',event.currentTarget);"),
 "Ringkasan dalam kartu Susunan Tim harus menyediakan tombol lihat rincian");
assert(teamSummaryCode.includes("const reason=teamEstablishmentIssue(t.id);")&&
 teamSummaryCode.includes("const complete=reason==='';"),
 "Jumlah tim ditetapkan harus memakai validasi yang SAMA dengan status tahunan");
assert(!teamSummaryCode.includes("yearSetup.teams[t.id].leaderId===ro.leaderId"),
 "Hitungan legacy 2026 tidak boleh bertentangan dengan validasi Finalisasi");
for(const rule of [
 "#pageTeams #annualTeamStage>.annual-stage-head{",
 "#pageTeams #annualTeamStage .annual-stage-head>#establishedTeamSummary.team-summary-inline{",
 "border-top:1px solid #cce6d8!important;",
 "#pageTeams #annualTeamStage .team-summary-inline .team-status-count{",
 "#pageTeams #annualTeamStage .team-summary-inline .team-summary-open-hint{"
])assert(cssPolish.includes(rule),"Kartu hijau Susunan Tim belum mengintegrasikan ringkasan: "+rule);
const snapshotStart=teamSummaryCode.indexOf("function establishedTeamSnapshot(){");
const snapshotEnd=teamSummaryCode.indexOf("function ensureEstablishedTeamDialog()",snapshotStart);
const snapshotFn=teamSummaryCode.slice(snapshotStart,snapshotEnd);
const sampleSummary=vm.runInNewContext(snapshotFn+";establishedTeamSnapshot()",{
 demoTeams:[{id:"A",active:true},{id:"B",active:true},{id:"C",active:false}],
 demoRoster:{A:{leaderId:"E1",members:["E1"]},B:{leaderId:"E2",members:["E2"]}},
 BASE:{employees:[{id:"E1",full_name:"Pegawai 1"},{id:"E2",full_name:"Pegawai 2"}]},
 teamEstablishmentIssue:tid=>tid==="A"?"":"Belum ditetapkan"
});
assert.equal(sampleSummary.list.length,2,"Tim nonaktif tidak termasuk ringkasan aktif");
assert.equal(sampleSummary.ready.length,1,"Ringkasan harus tunduk pada validasi penetapan");
assert.equal(sampleSummary.missing.length,1,"Tim yang belum ditetapkan muncul di filter belum lengkap");

const compactBody=teamSummaryCode.slice(teamSummaryCode.indexOf("function renderEstablishedTeams(){"));
assert(!compactBody.includes("team-summary-ready")&&!compactBody.includes("team-summary-pending-list"),
 "Daftar detail tidak boleh tetap tampil di bawah kartu ringkasan");
const popupBody=teamSummaryCode.slice(teamSummaryCode.indexOf("function renderEstablishedTeamDialog(){"),
 teamSummaryCode.indexOf("function openEstablishedTeamDialog("));
assert(popupBody.includes("team-summary-ready")&&popupBody.includes("team-summary-pending-list"),
 "Pop-up wajib memuat daftar Tim Ditetapkan dan Tim Belum Lengkap");
assert(popupBody.includes("Seluruh tim aktif sudah ditetapkan"),
 "Status kosong tetap harus bisa dibuka dan menunjukkan keterangan");
for(const rule of [
 "#pageTeams #annualTeamStage .annual-stage-head>#establishedTeamSummary.team-summary-inline{",
 ".team-establishment-dialog{",
 ".team-establishment-dialog::backdrop{",
 ".team-establishment-dialog .team-establishment-scroll{",
 ".team-establishment-dialog .team-summary-ready{",
 ".team-establishment-dialog .team-summary-pending-list{",
 ".team-establishment-dialog .team-establishment-close:focus-visible"
])assert(cssPolish.includes(rule),"Desain pop-up Ringkasan Penetapan Tim tidak lengkap: "+rule);

console.log("Prototipe V25 v2.6 lengkap, referensi anonim, tidak ada password demo.");
