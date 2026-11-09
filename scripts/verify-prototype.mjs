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
assert(inline.includes("trendSeriesSelection.allEmployees=null;renderTrend()"),"Perubahan filter tidak memicu urutan pegawai baru");
assert(inline.includes("trendSeriesSelection.allTeams=null;trendSeriesSelection.allEmployees=null"),"Perubahan filter tidak memicu urutan tim dan pegawai");
assert(!inline.includes("trendSelectedTeams"),"Logika daftar keanggotaan tim lama harus dilepas");
assert(cssPolish.includes("#pageDashboard .tl-trend-filters #trendActivityFilterWrap"),"Tata letak Kegiatan belum disesuaikan");

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
const eligibleEnd=inline.indexOf("function renderEmployeeMaster(){",eligibleStart);
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
assert(cssPolish.includes("height:auto!important; /* natural panel height */"),
  "Kartu grafik dan detail masih dibatasi tinggi tetap");
assert(cssPolish.includes("max-height:min(54dvh,440px)!important"),
  "Daftar perbandingan pegawai harus bergulir dengan tinggi terbatas");
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

console.log("Prototipe V25 v2.6 lengkap, referensi anonim, tidak ada password demo.");
