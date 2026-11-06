import "./design-v25.css";
import "./design-v25-extra.css";
import data from "./data/reference2026.json";

// Exact design foundation: original V25 Terpadu v2.6 styles, not a replacement UI.
// READ-ONLY: all identities are anonymous; no live data or Firestore writes.
const root = document.getElementById("app");
const state = {page:"dashboard",team:"",kro:"",query:"",activity:"",employee:""};
const labels = [
 ["dashboard","Dashboard"],["teams","Kelola Tim"],["kro","Pembagian KRO"],
 ["input","Input Alokasi"],["timeline","Timeline Kerja"],["monitor","Monitoring Pegawai"],
 ["recon","Rekonsiliasi"],["standards","Standar Waktu"],["history","Riwayat"],
 ["final","Finalisasi Matriks"],["admin","Kelola Akun Akses"]
];
const names = Object.fromEntries(data.teams.map(t=>[t.id,t.name]));
const kroNames = Object.fromEntries(data.kros.map(k=>[k.code,k.name]));
const f=n=>new Intl.NumberFormat("id-ID").format(n);
const elt=(tag,cls,content)=>{
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(content!==undefined)e.textContent=String(content);
 return e;
};
const opt=(value,label)=>{const x=elt("option","",label);x.value=value;return x;};
const small=(label,val)=>{const e=elt("div","stat");e.append(elt("small","",label),elt("b","",val));return e;};
function panel(title,sub){
 const box=elt("section","panel");
 const h=elt("div","section-top");
 const hgroup=elt("div");hgroup.append(elt("h3","",title));
 if(sub)hgroup.append(elt("p","",sub));
 h.append(hgroup);box.append(h);return box;
}
const rootHTML = `
<header><div class="shell topbar">
 <div class="brand"><div class="mark">MP</div><div><h1>Matriks Pegawai</h1><div class="sub">BPS KABUPATEN BLORA · REFERENSI 2026</div></div></div>
 <div class="rightbar"><span class="role-pill read">Mode Lihat</span><span class="user-summary">Demo Anonim</span><a class="btn tiny blue-soft" href="./">Masuk Aplikasi</a></div>
</div></header>
<main class="shell page">
 <div class="heading"><div><h2>Matriks Alokasi Kerja</h2><p id="workspaceSubtitle">Dashboard dan referensi kinerja pegawai tahun 2026.</p></div>
 <nav class="nav" id="demoNav"></nav></div>
 <section class="access-banner" id="accessBanner"><div class="ab-symbol">◈</div><div><strong>Mode Lihat — Referensi Tahun 2026</strong><p>Desain V25 Terpadu v2.6 · Pegawai anonim · Tidak ada perubahan pada database Firebase.</p></div><span class="access-mini">DEMO 2026</span></section>
 <div class="data-line" aria-label="Ringkasan referensi">
  <label class="year-switch"><span>TAHUN MATRIKS</span><select disabled aria-label="Tahun matriks"><option>2026</option></select></label>
  <span class="data-year">DATA 2026</span><span><b>1.412</b> uraian sumber</span><span><b>25</b> tim</span><span><b>40</b> pegawai anonim</span><span><b>33</b> KRO</span>
 </div>
 <section class="year-state-strip"><div class="year-state-left"><span class="year-led"></span><div><strong>Tahun 2026 — Referensi</strong><p>Mode demonstrasi, belum ada penetapan operasional.</p></div></div><div class="year-state-actions"><span class="badge orange">HANYA LIHAT</span></div></section>
 <section class="v25-workarea" id="v25Workarea"></section>
 <footer class="v25-footer">Matriks Kinerja Pegawai · BPS Kabupaten Blora · Preview aman tanpa data pegawai sebenarnya</footer>
</main>`;
root.innerHTML=rootHTML;
const nav=root.querySelector("#demoNav"),out=root.querySelector("#v25Workarea");
labels.forEach(([page,label])=>{
 const button=elt("button","navbutton",label);button.type="button";button.dataset.page=page;
 button.addEventListener("click",()=>{state.page=page;state.team="";state.kro="";state.query="";state.activity="";render();});
 nav.append(button);
});
function textMatches(...bits){return !state.query || bits.join(" ").toLocaleLowerCase("id-ID").includes(state.query);}
function headerFilters({team=true,search=true,placeholder="Cari tim, KRO, atau kegiatan"}) {
 const toolbar=elt("div","v25-filterbar");
 if(team){
  const group=elt("label","field");
  group.append(elt("span","v25-filter-label","Tim Kerja"));
  const select=elt("select");
  select.append(opt("","Semua Tim Kerja"));
  data.teams.forEach(t=>select.append(opt(t.id,t.name)));
  select.value=state.team;
  select.addEventListener("change",()=>{state.team=select.value;state.kro="";render();});
  group.append(select);toolbar.append(group);
 }
 if(search) {
  const box=elt("label","field");
  box.append(elt("span","v25-filter-label","Pencarian"));
  const input=elt("input");input.type="search";input.placeholder=placeholder;input.value=state.query;
  input.addEventListener("input",()=>{state.query=input.value.trim().toLocaleLowerCase("id-ID");renderContent();});
  box.append(input);toolbar.append(box);
 }
 return toolbar;
}
function table(columns,rows){
 const wrap=elt("div","v25-table-wrap");
 const tableEl=elt("table","v25-table");
 const thead=elt("thead"),tr=elt("tr");
 columns.forEach(x=>tr.append(elt("th","",x)));thead.append(tr);tableEl.append(thead);
 const tbody=elt("tbody");
 rows.forEach(cells=>{const r=elt("tr");cells.forEach(x=>r.append(elt("td","",x)));tbody.append(r);});
 if(!rows.length){const r=elt("tr"),cell=elt("td","v25-empty-row","Tidak ada data sesuai filter.");cell.colSpan=columns.length;r.append(cell);tbody.append(r);}
 tableEl.append(tbody);wrap.append(tableEl);return wrap;
}
function listTeams(teams,limit){
 const list=elt("div","v25-team-list");
 const items=limit?teams.slice(0,limit):teams;
 items.forEach(t=>{
  const row=elt("button","v25-team-row");
  row.type="button";
  row.append(elt("span","v25-team-monogram",t.id.slice(-2)));
  const n=elt("span","v25-team-name");
  n.append(elt("strong","",t.name),elt("small","",t.id+" · "+t.memberIds.length+" anggota · "+(t.summary?.activities||0)+" kegiatan sumber"));
  row.append(n,elt("span","v25-team-chevron","›"));
  row.addEventListener("click",()=>{state.page="teams";state.team=t.id;render();});
  list.append(row);
 });
 return list;
}
function filteredTeams(){
 return data.teams.filter(t=>(!state.team||state.team===t.id)&&textMatches(t.id,t.name));
}
function filteredKro(){
 return data.kros.filter(k=>(!state.team||k.teamIds.includes(state.team))&&textMatches(k.code,k.name,k.teamIds.map(id=>names[id]).join(" ")));
}
function filteredActivities(){
 return data.sampleActivities.filter(a=>(!state.team||a.teamId===state.team)&&(!state.kro||a.kroCode===state.kro)&&textMatches(a.title,a.id,kroNames[a.kroCode],names[a.teamId]));
}
function renderDashboard(){
 const stats=elt("div","stats");
 stats.append(small("Uraian Kegiatan (Sumber)",f(data.meta.originalActivityCount)),small("Tim Kerja",f(data.teams.length)),
 small("Pegawai (Anonim)",f(data.employees.length)),small("KRO Teridentifikasi",f(data.kros.length)));
 out.append(stats);
 const grid=elt("div","v25-two-col");
 const team=panel("Tim Kerja 2026","Klik tim untuk melihat anggota dan KRO terkait.");
 team.append(listTeams(data.teams,7));
 const kro=panel("KRO dan Kegiatan","Ketersediaan referensi yang dapat ditelusuri pada preview.");
 const summary=elt("div","v25-progress-items");
 [["KRO teridentifikasi",data.kros.length,33],["Contoh uraian dimuat",data.sampleActivities.length,data.meta.originalActivityCount]].forEach(([label,num,total])=>{
  const wrap=elt("div","v25-progress-row");const meta=elt("div","v25-progress-meta");
  meta.append(elt("span","",label),elt("strong","",f(num)+" / "+f(total)));
  const track=elt("div","v25-progress-track"),bar=elt("div","v25-progress-fill");
  bar.style.width=Math.min(100,(num/total)*100)+"%";track.append(bar);wrap.append(meta,track);summary.append(wrap);
 });
 kro.append(summary);
 const warn=elt("div","mode-info alert");
 warn.textContent="Referensi 2026 berasal dari prototipe sebelumnya. Baru 22 contoh kegiatan dimuat pada demo ini; alokasi dan finalisasi belum operasional.";
 kro.append(warn);
 grid.append(team,kro);out.append(grid);
 const samples=panel("Contoh Uraian Kegiatan 2026","Menampilkan sebagian data untuk pengujian tampilan.");
 samples.append(table(["Kegiatan","Tim","KRO","Volume"],data.sampleActivities.slice(0,7).map(a=>[a.title,names[a.teamId],a.kroCode,a.volume+" "+a.unit])));
 out.append(samples);
}
function renderTeams(){
 out.append(headerFilters({search:true,placeholder:"Cari nama atau kode tim"}));
 const teams=filteredTeams();
 if(state.team){
  const t=data.teams.find(x=>x.id===state.team);
  if(t) {
   const card=panel(t.name,"Rincian referensi susunan tim 2026");
   const columns=elt("div","v25-team-detail");
   const left=elt("div","detail-block");left.append(elt("span","inline-label","KETUA TIM"),elt("div","detail-title",t.leadId||"—"),elt("p","muted","Kode anonim pegawai"));
   const right=elt("div","detail-block");right.append(elt("span","inline-label","ANGGOTA TIM"),elt("div","detail-title",t.memberIds.length),elt("p","muted",t.memberIds.join(" · ")));
   columns.append(left,right);card.append(columns);
   const kros=data.kros.filter(k=>k.teamIds.includes(t.id));
   card.append(elt("h3","v25-section-label","KRO yang terkait"));
   card.append(table(["Kode KRO","Nama KRO"],kros.map(k=>[k.code,k.name])));
   out.append(card);
  }
 }
 const listPanel=panel("Daftar Tim Kerja",teams.length+" tim sesuai filter");
 listPanel.append(listTeams(teams));out.append(listPanel);
}
function renderKro(){
 out.append(headerFilters({team:true,search:true,placeholder:"Cari kode atau nama KRO"}));
 const kros=filteredKro();
 const stats=elt("div","stats");stats.append(small("Total KRO","33"),small("Sesuai Filter",kros.length),small("Tim Kerja",data.teams.length),small("Acuan Tahun","2026"));out.append(stats);
 const box=panel("Daftar dan Pembagian KRO", "Peta KRO dan tim pengampu berdasarkan prototipe tahun 2026");
 box.append(table(["Kode KRO","Nama KRO","Tim Pengampu"],kros.map(k=>[k.code,k.name,k.teamIds.map(id=>names[id]||id).join(", ")])));
 out.append(box);
}
function renderInput(){
 const grid=elt("div","workspace v25-input");
 const left=panel("Struktur Kegiatan","Pilih berjenjang sesuai rancangan Input Alokasi V25.");
 const fields=elt("div","v25-fields");
 const teamField=elt("label","field");teamField.append(elt("span","","1. Tim Kerja"));
 const team=elt("select");team.append(opt("","Pilih Tim Kerja"));
 data.teams.forEach(t=>team.append(opt(t.id,t.name)));team.value=state.team;
 team.addEventListener("change",()=>{state.team=team.value;state.kro="";state.activity="";render();});
 teamField.append(team);fields.append(teamField);
 const kroField=elt("label","field");kroField.append(elt("span","","2. KRO — Kode dan Nama POK"));
 const kro=elt("select");kro.append(opt("","Pilih KRO"));
 data.kros.filter(k=>!state.team||k.teamIds.includes(state.team)).forEach(k=>kro.append(opt(k.code,k.code+" · "+k.name)));
 kro.value=state.kro;
 kro.addEventListener("change",()=>{state.kro=kro.value;state.activity="";render();});
 kroField.append(kro);fields.append(kroField);
 const actField=elt("label","field");actField.append(elt("span","","3. Uraian Kegiatan (Contoh)"));
 const activity=elt("select");activity.append(opt("","Pilih Uraian"));
 filteredActivities().forEach(a=>activity.append(opt(a.id,a.title)));activity.value=state.activity;
 activity.addEventListener("change",()=>{state.activity=activity.value;render();});
 actField.append(activity);fields.append(actField);left.append(fields);
 left.append(elt("div","mode-info","Tampilan ini hanya mengikuti alur Input Alokasi sebelumnya. Perubahan alokasi belum diaktifkan."));
 const right=panel("Rincian Uraian","Tim → KRO → Kegiatan → Uraian");
 const a=data.sampleActivities.find(x=>x.id===state.activity);
 if(a) {
  const head=elt("div","detail-block");head.append(elt("div","detail-title",a.title),elt("p","muted",(names[a.teamId]||a.teamId)+" · "+a.kroCode));
  right.append(head);
  const values=elt("div","mini-grid v25-four");
  [["Volume",a.volume+" "+a.unit],["Standar",a.standardMinutes+" menit"],["Kode",a.id],["Mode","Lihat"]].forEach(([l,v])=>{const col=elt("div","item");col.append(elt("span","inline-label",l),elt("div","v",v));values.append(col);});
  right.append(values);
 } else right.append(elt("div","empty","Pilih Tim Kerja, KRO, dan uraian untuk menampilkan rincian."));
 grid.append(left,right);out.append(grid);
}
function renderMonitor(){
 const s=elt("div","stats");s.append(small("Pegawai Anonim",40),small("Tim Kerja",25),small("Alokasi Individual","Belum dimigrasikan"),small("Status","Referensi"));out.append(s);
 const box=panel("Daftar Pegawai (Anonim)","Untuk menjaga kerahasiaan, nama pegawai diganti dengan kode.");
 const rows=data.employees.filter(e=>textMatches(e.id,e.label)&&(!state.team||data.teams.find(t=>t.id===state.team)?.memberIds.includes(e.id))).map(e=>{
  const assigned=data.teams.filter(t=>t.memberIds.includes(e.id)||t.leadId===e.id);
  return [e.label,e.id,assigned.length,assigned.map(t=>t.name).join(", ")||"—"];
 });
 out.prepend(headerFilters({team:true,search:true,placeholder:"Cari kode pegawai"}));
 box.append(table(["Pegawai","Kode","Jumlah Tim","Keanggotaan"],rows));out.append(box);
}
function renderStandards(){
 out.append(headerFilters({team:true,search:true}));
 const box=panel("Standar Waktu Kegiatan","Durasi standar berasal dari contoh uraian 2026 dan belum diverifikasi untuk penetapan.");
 box.append(table(["Uraian","Tim","Volume","Durasi Standar"],filteredActivities().map(a=>[a.title,names[a.teamId],a.volume+" "+a.unit,a.standardMinutes+" menit"])));
 out.append(box);
}
function renderRecon(){
 const box=panel("Rekonsiliasi Referensi 2026","Perbandingan kelengkapan sumber prototipe dan data demo");
 const missing=data.meta.originalActivityCount-data.sampleActivities.length;
 box.append(table(["Komponen","Sumber 2026","Tersedia di Preview","Keterangan"],
 [["Tim Kerja",25,25,"Referensi struktur"],["Pegawai",40,40,"Nama disamarkan"],["KRO",33,33,"Referensi kode"],["Uraian Kegiatan",data.meta.originalActivityCount,data.sampleActivities.length,missing+" rincian belum dimigrasikan"]]));
 out.append(box);
}
function renderLocked(title,body){
 const box=panel(title,"Bagian dari rancangan Matriks V25 Terpadu");
 const note=elt("div","v25-locked");
 note.append(elt("div","v25-locked-icon","🔒"),elt("h3","",title),elt("p","",body),elt("span","badge orange","BELUM AKTIF"));
 box.append(note);out.append(box);
}
function renderContent(){
 out.replaceChildren();
 if(state.page==="dashboard")renderDashboard();
 else if(state.page==="teams")renderTeams();
 else if(state.page==="kro")renderKro();
 else if(state.page==="input")renderInput();
 else if(state.page==="monitor")renderMonitor();
 else if(state.page==="standards")renderStandards();
 else if(state.page==="recon")renderRecon();
 else {
  const locks={
   timeline:["Timeline Kerja","Kalender dan penjadwalan kerja mengikuti desain sebelumnya. Data tanggal individual belum dimasukkan ke preview anonim."],
   history:["Riwayat Perubahan","Pencatatan perubahan baru akan muncul setelah backend dan database bersama aktif."],
   final:["Finalisasi Matriks","Penetapan hanya dapat dilakukan Kepala BPS melalui autentikasi peran yang telah diverifikasi."],
   admin:["Kelola Akun Akses","Menu username, password, peran, dan tim dikelola Admin setelah Cloud Functions dan kontrol keamanan aktif."]
  };
  renderLocked(...(locks[state.page]||locks.history));
 }
}
function render(){
 labels.forEach(([p])=>{const el=nav.querySelector('[data-page="'+p+'"]');el?.classList.toggle("active",p===state.page);});
 const title=labels.find(([p])=>p===state.page)?.[1]||"Dashboard";
 root.querySelector("#workspaceSubtitle").textContent=title+" · Referensi Matriks Pegawai Tahun 2026";
 renderContent();
}
render();
