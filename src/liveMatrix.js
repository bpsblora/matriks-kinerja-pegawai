import {httpsCallable} from "firebase/functions";
import {functions} from "./firebase/client.js";
import {createAccessAdminView} from "./adminAccess.js";

/* Authenticated Matriks data workspace.
 * Server validates role/team on every write; browser holds no admin secrets.
 * No direct Firestore writes are possible (deployed rules remain deny-all).
 */
const MONTHS=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const CATEGORIES=["teams","employees","kros","groups","activities","allocations","annualAllocations","standards","schedules","targets","workflow"];
const NAV=[
 ["dashboard","Dashboard"],["teams","Kelola Tim"],["kros","Pembagian KRO"],
 ["activities","Input Alokasi"],["schedules","Timeline Kerja"],
 ["monitor","Monitoring Pegawai"],["recon","Rekonsiliasi"],
 ["standards","Standar Waktu"],["history","Riwayat"],["final","Finalisasi Matriks"]
];
const ADMIN_NAV=["accounts","Kelola Akun Akses"];
const FIELDS={
 teams:[["name","Nama Tim","text"],["leaderId","Ketua Tim (ID Pegawai)","text"],["memberIds","Anggota (ID dipisahkan koma)","array"],["active","Status Aktif","checkbox"]],
 employees:[["name","Nama Pegawai","text"],["type","Jenis Pegawai","text"],["position","Jabatan","text"],["active","Status Aktif","checkbox"]],
 kros:[["code","Kode KRO","text"],["name","Nama KRO","text"],["teamIds","Tim Pengampu (ID dipisahkan koma)","array"],["active","Status Aktif","checkbox"]],
 groups:[["name","Nama Kegiatan","text"],["teamId","Tim Kerja","team"],["kroCode","Kode KRO","kro"],["active","Status Aktif","checkbox"]],
 activities:[["description","Uraian Kegiatan","text"],["teamId","Tim Kerja","team"],["kroCode","KRO","kro"],["group","Kelompok Kegiatan","text"],["unit","Satuan","text"],["annualVolume","Volume Tahunan","number"],["standardHours","Jam Standar per Satuan","number"],["calculationMode","Metode Perhitungan","text"],["active","Status Aktif","checkbox"]],
 standards:[["name","Nama Standar","text"],["group","Kelompok","text"],["unit","Satuan","text"],["hours","Jam Standar","number"],["active","Status Aktif","checkbox"]],
 schedules:[["teamId","Tim Kerja","team"],["activityId","ID Uraian","activity"],["startDate","Tanggal Mulai","date"],["endDate","Tanggal Selesai","date"],["notes","Catatan","text"],["active","Status Aktif","checkbox"]],
 targets:[["teamId","Tim Kerja","team"],["activityId","Uraian","activity"],["month","Bulan (1-12)","number"],["volume","Target Volume","number"]],
 workflow:[["teamId","Tim Kerja","team"],["stage","Tahapan","text"],["status","Status","text"],["notes","Catatan","text"]]
};
const req=(name)=>httpsCallable(functions,name,{timeout:60000});
const api={
 list:req("listMatrixRecords"),year:req("getMatrixYearState"),mutate:req("mutateMatrixRecord"),
 batch:req("saveActivityAllocations"),approve:req("changeMatrixYearStatus"),
 init:req("initMatrixYear"),audit:req("listMatrixAudit")
};
const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;};
const button=(label,fn,cls="")=>{const b=node("button",cls,label);b.type="button";b.addEventListener("click",fn);return b;};
const option=(value,text)=>{const el=node("option","",text);el.value=value;return el;};
const cell=(row,value)=>{const td=node("td","",value);row.append(td);return td;};
const fmt=n=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:2}).format(Number(n)||0);
const labelText=(value)=>value===null||value===undefined||value===""?"—":String(value);
function table(headers,rows){
 const wrapper=node("div","mx-table-wrap");
 const t=node("table","mx-table");
 const h=node("thead"),tr=node("tr");
 headers.forEach(x=>tr.append(node("th","",x)));h.append(tr);t.append(h);
 const body=node("tbody");
 rows.forEach(values=>{const line=node("tr");values.forEach(v=>cell(line,labelText(v)));body.append(line);});
 if(!rows.length){const row=node("tr"),td=cell(row,"Data belum tersedia.");td.colSpan=headers.length;body.append(row);}
 t.append(body);wrapper.append(t);return wrapper;
}

export function createLiveMatrixWorkspace(context) {
 const root=node("div","live-matrix");
 const state={year:2026,page:"dashboard",selectedTeam:"",selectedKro:"",selectedGroup:"",activityId:"",
  filter:"",loading:false,yearInfo:null,cache:Object.fromEntries(CATEGORIES.map(k=>[k,[]])),fetched:new Set(),audit:[]};
 const header=node("div","mx-header");
 const heading=node("div");heading.append(node("h2","", "Matriks Alokasi Kerja"),node("p","mx-muted","Data bersama · Firebase Cloud Firestore"));
 const controls=node("div","mx-controls");
 const yearLabel=node("label","mx-year");
 yearLabel.append(node("span","","Tahun Matriks"));
 const yearPick=node("select");for(let y=2026;y<=2032;y++)yearPick.append(option(String(y),String(y)));
 yearPick.value="2026";yearLabel.append(yearPick);
 const reload=button("↻ Sinkronkan",()=>void refresh(true),"mx-secondary");
 controls.append(yearLabel,reload);header.append(heading,controls);
 const notice=node("div","mx-notice");
 const navbar=node("nav","mx-nav");
 const content=node("div","mx-body");
 const dialog=node("dialog","mx-dialog");
 root.append(header,notice,navbar,content,dialog);
 const permitted=(kind,teamId)=>context.role==="admin"||(context.role==="ketua_tim"
    &&["groups","activities","allocations","schedules","targets","workflow"].includes(kind)
    &&context.teamIds.includes(teamId));
 const rows=(kind)=>state.cache[kind]||[];
 const one=(kind,id)=>rows(kind).find(x=>x.id===id);
 const nameTeam=id=>one("teams",id)?.name||id||"—";
 const nameKro=id=>one("kros",id)?.name||id||"—";
 const nameEmployee=id=>one("employees",id)?.name||id||"—";
 const teamRows=kind=>rows(kind).filter(x=>!state.selectedTeam||x.teamId===state.selectedTeam||x.id===state.selectedTeam
   ||Array.isArray(x.teamIds)&&x.teamIds.includes(state.selectedTeam));
 function alert(text,error=false){notice.textContent=text;notice.className=error?"mx-notice mx-error":"mx-notice";}
 function modal(title,body){
  dialog.replaceChildren(node("h3","",title),body,button("Batal",()=>dialog.close(),"mx-secondary"));
  dialog.showModal();
 }
 async function fetchKind(kind,force=false){
  if(state.fetched.has(kind)&&!force)return;
  const all=[];let cursor=null,loops=0;
  do{
   const response=await api.list({kind,year:state.year,pageSize:250,...(cursor?{cursor}:{})});
   const batch=response.data?.records||[];
   all.push(...batch);cursor=response.data?.nextCursor||null;loops++;
   if(loops>85)throw Error("Pagination terlalu panjang; gunakan filter data untuk mengambil sebagian.");
  }while(cursor);
  state.cache[kind]=all;state.fetched.add(kind);
 }
 async function refresh(force=false){
  if(state.loading)return;
  state.loading=true;reload.disabled=true;
  try{
   alert("Mengambil data bersama dari Firebase…");
   const y=await api.year({year:state.year});state.yearInfo=y.data;
   const required={
    dashboard:["teams","employees","kros","activities","allocations"],
    teams:["teams","employees","kros"],
    kros:["kros","teams","activities"],
    activities:["teams","kros","groups","activities","employees","allocations"],
    schedules:["teams","activities","schedules"],monitor:["teams","employees","activities","allocations"],
    recon:["teams","kros","activities","allocations","employees"],
    standards:["standards","teams","activities"],final:["teams","kros","activities","allocations"],
    history:[],accounts:["teams"]
   }[state.page]||[];
   await Promise.all(required.map(k=>fetchKind(k,force)));
   if(state.page==="history"){
     const history=await api.audit({year:state.year});state.audit=history.data?.events||[];
   }
   alert("Tahun "+state.year+" · "+(state.yearInfo?.status||"draft").toUpperCase()+" · "+context.username+" ("+context.role+")");
   renderPage();
  }catch(e){alert("Data belum bisa diakses: "+(e?.message||"Backend belum aktif."),true);
   content.replaceChildren(node("div","mx-empty","Koneksi server belum aktif atau akun tidak memiliki izin. Data browser tidak diubah."));
  }finally{state.loading=false;reload.disabled=false;}
 }
 function navigate(page){
  state.page=page;state.filter="";state.selectedGroup="";state.selectedKro="";
  navbar.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  void refresh();
 }
 NAV.concat(context.role==="admin"?[ADMIN_NAV]:[]).forEach(([id,title])=>{
  const b=button(title,()=>navigate(id));b.dataset.page=id;navbar.append(b);
 });
 yearPick.addEventListener("change",()=>{state.year=Number(yearPick.value);
  state.fetched.clear();state.cache=Object.fromEntries(CATEGORIES.map(k=>[k,[]]));state.selectedTeam="";
  void refresh();
 });
 function filterBar(showTeam=true){
  const bar=node("div","mx-filter");
  if(showTeam){
   const team=node("select");team.append(option("","Seluruh Tim"));
   rows("teams").forEach(t=>team.append(option(t.id,t.name)));
   team.value=state.selectedTeam;
   team.addEventListener("change",()=>{state.selectedTeam=team.value;renderPage();});
   bar.append(team);
  }
  const search=node("input");search.type="search";search.placeholder="Cari data…";search.value=state.filter;
  search.addEventListener("input",()=>{state.filter=search.value.toLocaleLowerCase("id-ID");renderPage();
   const n=content.querySelector('input[type="search"]');if(n){n.focus();n.setSelectionRange(search.selectionStart,search.selectionStart);}});
  bar.append(search);return bar;
 }
 const matches=(...text)=>!state.filter||text.join(" ").toLocaleLowerCase("id-ID").includes(state.filter);
 function card(title,subtitle=""){
  const box=node("section","mx-card");const top=node("div","mx-cardhead");
  const label=node("div");label.append(node("h3","",title));if(subtitle)label.append(node("p","mx-muted",subtitle));
  top.append(label);box.append(top);return {box,top};
 }
 async function change(kind,id,record,operation,existing=null){
  try{
   await api.mutate({year:state.year,kind,id,record,operation,...(existing?.updatedAt?{expectedUpdatedAt:existing.updatedAt}:{})});
   dialog.close();state.fetched.delete(kind);
   alert("Perubahan berhasil disimpan ke database bersama.");await refresh();
  }catch(e){alert("Gagal menyimpan: "+(e?.message||"Periksa izin."),true);}
 }
 function openEditor(kind,existing=null){
  if(context.role==="kepala")return;
  const schema=FIELDS[kind];if(!schema)return;
  const form=node("form","mx-form");
  const id=node("input");id.value=existing?.id||"";id.placeholder="ID unik (tanpa spasi)";
  id.required=!existing;id.disabled=Boolean(existing);
  if(!existing)form.append(field("ID Dokumen",id));
  const inputs={};
  schema.forEach(([key,title,type])=>{
    let el;
    if(type==="team"||type==="kro"||type==="activity"){
      el=node("select");el.append(option("","Pilih "+title));
      const key=type==="team"?"teams":type==="kro"?"kros":"activities";
      rows(key).forEach(row=>el.append(option(row.id,row.name||row.description||row.code||row.id)));
    } else {
      el=node("input");el.type=type==="array"?"text":type==="checkbox"?"checkbox":type;
      if(type==="number"){el.min="0";el.step="any";}
    }
    const val=existing?.[key];
    if(type==="checkbox")el.checked=val!==false;
    else if(type==="array")el.value=(val||[]).join(", ");
    else if(val!==undefined)el.value=String(val);
    else if(key==="teamId"&&state.selectedTeam)el.value=state.selectedTeam;
    else if(key==="kroCode"&&state.selectedKro)el.value=state.selectedKro;
    inputs[key]=el;form.append(field(title,el));
  });
  const submit=button(existing?"Simpan Perubahan":"Tambah Data",()=>{
   const obj={};
   for(const [k,v] of Object.entries(inputs)){
    const t=schema.find(row=>row[0]===k)[2];
    if(t==="checkbox")obj[k]=v.checked;
    else if(t==="array")obj[k]=v.value.split(",").map(x=>x.trim()).filter(Boolean);
    else if(t==="number")obj[k]=Number(v.value||0);
    else obj[k]=v.value.trim();
   }
   const uid=id.value.trim()|| (kind==="kros"?obj.code:"");
   if(!uid){alert("ID tidak boleh kosong.",true);return;}
   void change(kind,uid,obj,existing?"update":"create",existing);
  });
  form.append(submit);
  if(existing){
   form.append(button("Hapus Data",()=>{
    if(window.confirm("Hapus "+(existing.name||existing.description||existing.id)+"?"))void change(kind,existing.id,{},"delete",existing);
   },"mx-danger"));
  }
  modal((existing?"Edit ":"Tambah ")+titleOf(kind),form);
 }
 function titleOf(k){return {teams:"Tim Kerja",employees:"Pegawai",kros:"KRO",groups:"Kelompok Kegiatan",
  activities:"Uraian Kegiatan",standards:"Standar Waktu",schedules:"Jadwal",targets:"Target",workflow:"Tahapan"}[k]||k;}
 function field(label,input){const w=node("label","mx-field");w.append(node("span","",label),input);return w;}
 function showTable(title,kind,columns,getValues,opts={}){
  const {box,top}=card(title,opts.subtitle||"");
  if(opts.add&&context.role!=="kepala")top.append(button("+ Tambah",()=>openEditor(kind),"mx-primary"));
  const t=node("table","mx-table");const th=node("thead"),tr=node("tr");
  [...columns,...(opts.edit?["Tindakan"]:[])].forEach(x=>tr.append(node("th","",x)));th.append(tr);t.append(th);
  const tbody=node("tbody");
  const items=opts.filter?opts.filter(teamRows(kind)):teamRows(kind);
  items.forEach(item=>{
    const row=node("tr");getValues(item).forEach(v=>row.append(node("td","",labelText(v))));
    if(opts.edit){
      const cell=node("td");if(permitted(kind,item.teamId||item.id))cell.append(button("Edit",()=>openEditor(kind,item),"mx-link"));
      row.append(cell);
    }
    tbody.append(row);
  });
  if(!items.length){const row=node("tr"),c=node("td","","Belum ada data");c.colSpan=columns.length+(opts.edit?1:0);row.append(c);tbody.append(row);}
  t.append(tbody);const scroll=node("div","mx-table-wrap");scroll.append(t);box.append(scroll);
  content.append(box);
 }
 function renderDashboard(){
  const summary=node("div","mx-stats");
  [["Tim Kerja",rows("teams").length],["KRO",rows("kros").length],
   ["Pegawai Aktif",rows("employees").filter(e=>e.active!==false).length],
   ["Uraian Terbaca",rows("activities").length],["Alokasi Bulanan",rows("allocations").length]]
   .forEach(([l,v])=>{const stat=node("div","mx-stat");stat.append(node("small","",l),node("strong","",fmt(v)));summary.append(stat);});
  content.append(summary);
  showTable("Tim Kerja","teams",["Tim","Ketua (ID)","Anggota"],t=>[t.name,t.leaderId,(t.memberIds||[]).length],
   {filter:ts=>ts.slice(0,12),subtitle:"Menampilkan tim yang telah tersimpan di Firebase."});
  showTable("KRO","kros",["Kode","Nama","Tim Pengampu"],k=>[k.id,k.name,(k.teamIds||[]).map(nameTeam).join(", ")],
   {filter:k=>k.slice(0,10)});
 }
 function renderTeams(){
  content.append(filterBar(false));
  showTable("Susunan Tim","teams",["Tim","Ketua (ID)","Anggota (ID)","Status"],
   t=>[t.name,t.leaderId,(t.memberIds||[]).join(", "),t.active===false?"Nonaktif":"Aktif"],
   {add:context.role==="admin",edit:context.role==="admin",filter:xs=>xs.filter(x=>matches(x.name,x.id))});
  showTable("Daftar Pegawai","employees",["ID","Nama","Jenis","Status"],
   e=>[e.id,e.name,e.type,e.active===false?"Nonaktif":"Aktif"],
   {add:context.role==="admin",edit:context.role==="admin",filter:xs=>xs.filter(x=>matches(x.name,x.id))});
 }
 function renderKros(){
  content.append(filterBar());
  showTable("Pembagian KRO ke Tim","kros",["Kode","Nama KRO","Tim Pengampu"],
   k=>[k.code,k.name,(k.teamIds||[]).map(nameTeam).join(", ")],
   {add:context.role==="admin",edit:context.role==="admin",
    filter:xs=>xs.filter(k=>matches(k.code,k.name,(k.teamIds||[]).map(nameTeam).join(" ")))});
  const missing=rows("teams").filter(t=>!rows("kros").some(k=>(k.teamIds||[]).includes(t.id)));
  if(missing.length)content.append(node("div","mx-help",missing.length+" tim belum memiliki KRO pada data tersimpan. Tim pendukung dapat diperiksa terpisah."));
 }
 function renderActivities(){
  const wizard=card("Struktur Kegiatan","Urutan: Tim → KRO → Kegiatan → Uraian → Alokasi Pegawai");
  const controls=node("div","mx-steps");
  const t=node("select");t.append(option("","1. Pilih Tim"));rows("teams").forEach(x=>t.append(option(x.id,x.name)));
  t.value=state.selectedTeam;t.addEventListener("change",()=>{state.selectedTeam=t.value;state.selectedKro="";state.selectedGroup="";state.activityId="";renderPage();});
  const k=node("select");k.append(option("","2. Pilih KRO"));
  rows("kros").filter(x=>!state.selectedTeam||(x.teamIds||[]).includes(state.selectedTeam))
   .forEach(x=>k.append(option(x.id,x.id+" · "+x.name)));
  k.value=state.selectedKro;k.addEventListener("change",()=>{state.selectedKro=k.value;state.selectedGroup="";state.activityId="";renderPage();});
  const g=node("select");g.append(option("","3. Semua Kegiatan"));
  const groups=[...new Set(rows("groups").filter(x=>!state.selectedTeam||x.teamId===state.selectedTeam)
    .filter(x=>!state.selectedKro||x.kroCode===state.selectedKro).map(x=>x.name)
    .concat(rows("activities").filter(x=>!state.selectedTeam||x.teamId===state.selectedTeam)
    .filter(x=>!state.selectedKro||x.kroCode===state.selectedKro).map(x=>x.group).filter(Boolean)))];
  groups.forEach(x=>g.append(option(x,x)));g.value=state.selectedGroup;
  g.addEventListener("change",()=>{state.selectedGroup=g.value;state.activityId="";renderPage();});
  controls.append(t,k,g);wizard.box.append(controls);
  if(state.selectedTeam&&permitted("groups",state.selectedTeam))
   wizard.box.append(button("+ Tambah Kegiatan",()=>openEditor("groups"),"mx-secondary"));
  content.append(wizard.box);
  const available=rows("activities").filter(a=>(!state.selectedTeam||a.teamId===state.selectedTeam)
   &&(!state.selectedKro||a.kroCode===state.selectedKro)&&(!state.selectedGroup||a.group===state.selectedGroup));
  const area=node("div","mx-split");
  const left=card("Uraian Kegiatan","Pilih uraian, kemudian tetapkan pegawai dan jam per orang.");
  if(state.selectedTeam&&permitted("activities",state.selectedTeam))
   left.top.append(button("+ Uraian",()=>openEditor("activities"),"mx-primary"));
  const list=node("div","mx-activitylist");
  available.slice(0,400).forEach(a=>{
   const b=button(a.description,()=>{state.activityId=a.id;renderPage();},state.activityId===a.id?"mx-item active":"mx-item");
   b.append(node("small","",a.id+" · "+(a.group||"Tanpa kegiatan")));
   list.append(b);
  });
  if(available.length>400)list.append(node("p","mx-muted","Daftar dipotong; gunakan filter tim dan KRO."));
  left.box.append(list);
  const right=card("Rincian Alokasi","Untuk rapat bersama, setiap pegawai menerima durasi penuh.");
  const selected=one("activities",state.activityId);
  if(selected){
   right.box.append(node("h3","",selected.description));
   right.box.append(node("p","mx-muted",nameTeam(selected.teamId)+" • "+nameKro(selected.kroCode)+" • "+selected.group));
   const stats=node("div","mx-meta");
   [["Satuan",selected.unit],["Volume Tahunan",fmt(selected.annualVolume)],["Standar (jam)",fmt(selected.standardHours)]]
    .forEach(([key,value])=>{const div=node("div");div.append(node("small","",key),node("strong","",value));stats.append(div);});
   right.box.append(stats);
   if(permitted("activities",selected.teamId))right.box.append(button("Edit Uraian",()=>openEditor("activities",selected),"mx-secondary"));
   if(permitted("allocations",selected.teamId)){
    const form=node("div","mx-allocation-form");
    const month=node("select");MONTHS.forEach((m,i)=>month.append(option(String(i+1),m)));
    month.value=String(new Date().getMonth()+1);
    const hours=node("input");hours.type="number";hours.min="0";hours.max="1000";hours.step="0.25";hours.value=String(selected.standardHours||4);
    const volume=node("input");volume.type="number";volume.min="0";volume.step="any";volume.value="1";
    form.append(field("Bulan",month),field("Jam per Pegawai",hours),field("Volume",volume));
    const employees=node("div","mx-checkboxes");
    rows("employees").filter(e=>{
      if(e.active===false)return false;
      if(context.role==="admin")return true;
      const roster=one("teams",selected.teamId);
      return Boolean(roster&&(roster.memberIds||[]).includes(e.id)||roster?.leaderId===e.id);
    }).forEach(e=>{
      const label=node("label"),check=node("input");check.type="checkbox";check.value=e.id;
      label.append(check,node("span","",e.name||e.id));employees.append(label);
    });
    right.box.append(form,node("h4","","Pilih Pegawai (Bisa Lebih dari Satu)"),employees);
    right.box.append(button("Simpan Alokasi",async()=>{
      const ids=[...employees.querySelectorAll("input:checked")].map(x=>x.value);
      if(!ids.length){alert("Pilih setidaknya satu pegawai.",true);return;}
      const n=Number(hours.value);
      if(!Number.isFinite(n)||n<0){alert("Jam tidak sesuai.",true);return;}
      if(!window.confirm("Tetapkan "+n+" jam untuk MASING-MASING "+ids.length+" pegawai?"))return;
      try{
       await api.batch({year:state.year,activityId:selected.id,teamId:selected.teamId,employeeIds:ids,
        month:Number(month.value),hours:n,volume:Number(volume.value)});
       state.fetched.delete("allocations");alert("Alokasi berhasil disimpan untuk "+ids.length+" pegawai.");await refresh();
      }catch(e){alert("Gagal mengalokasikan: "+(e?.message||"Server belum aktif."),true);}
    },"mx-primary"));
   }
  }else right.box.append(node("p","mx-muted","Pilih uraian kegiatan untuk menampilkan rincian."));
  area.append(left.box,right.box);content.append(area);
 }
 function renderSchedules(){
  content.append(filterBar());
  showTable("Timeline Kegiatan","schedules",["Kegiatan","Tim","Tanggal Mulai","Tanggal Selesai","Catatan"],
   x=>[one("activities",x.activityId)?.description||x.activityId,nameTeam(x.teamId),x.startDate,x.endDate,x.notes],
   {add:context.role==="admin"||context.role==="ketua_tim",edit:true,
    filter:xs=>xs.filter(x=>matches(x.activityId,x.notes))});
 }
 function renderMonitor(){
  content.append(filterBar());
  const map=new Map(rows("employees").map(e=>[e.id,{employee:e,hrs:0,records:0}]));
  rows("allocations").filter(a=>!state.selectedTeam||a.teamId===state.selectedTeam).forEach(a=>{
   const item=map.get(a.employeeId);if(item){item.hrs+=Number(a.hours)||0;item.records++;}
  });
  const sorted=[...map.values()].filter(e=>matches(e.employee.id,e.employee.name)).sort((a,b)=>b.hrs-a.hrs);
  const box=card("Monitoring Beban Pegawai","Akumulasi jam dari seluruh alokasi yang tersimpan.");
  const rowsTable=sorted.map(x=>[x.employee.id,x.employee.name,fmt(x.hrs),x.records+" alokasi",
   x.hrs>157.5?"Periksa beban": "Dalam pemantauan"]);
  box.box.append(table(["ID","Nama","Total Jam","Banyak Alokasi","Indikasi"],rowsTable));
  content.append(box.box);
 }
 function renderRecon(){
  const issues=[];
  rows("activities").forEach(a=>{
   if(!a.kroCode)issues.push(["KRO belum ditetapkan",a.id,a.description]);
   if(!rows("allocations").some(x=>x.activityId===a.id))issues.push(["Belum ada alokasi bulanan",a.id,a.description]);
  });
  rows("teams").filter(t=>!rows("kros").some(k=>(k.teamIds||[]).includes(t.id)))
   .forEach(t=>issues.push(["Tim tanpa KRO",t.id,t.name]));
  const box=card("Rekonsiliasi Matriks","Daftar indikasi yang perlu diperiksa sebelum Kepala BPS melakukan finalisasi.");
  box.box.append(table(["Jenis Pemeriksaan","ID","Rincian"],issues.slice(0,400)));
  if(issues.length>400)box.box.append(node("p","mx-muted","Menampilkan 400 indikasi pertama."));
  content.append(box.box);
 }
 function renderStandards(){
  content.append(filterBar(false));
  showTable("Standar Waktu","standards",["Kelompok","Nama Standar","Jam","Status"],
   x=>[x.group,x.name,fmt(x.hours),x.active===false?"Nonaktif":"Aktif"],
   {add:context.role==="admin",edit:context.role==="admin",
    filter:xs=>xs.filter(x=>matches(x.group,x.name))});
 }
 function renderHistory(){
  const box=card("Riwayat Perubahan","Jejak perubahan server; tidak dapat dihapus melalui aplikasi.");
  box.box.append(table(["Waktu","Aksi","Modul","ID","Peran"],
   state.audit.map(a=>[a.at||"—",a.action,a.kind,a.recordId,a.actorRole])));
  content.append(box.box);
 }
 function renderFinal(){
  const box=card("Finalisasi Matriks Tahun "+state.year,"Hanya Kepala BPS yang berwenang menetapkan.");
  box.box.append(node("div","mx-final-status","Status: "+(state.yearInfo?.status||"draft").toUpperCase()));
  if(context.role==="kepala"&&state.yearInfo?.status!=="finalized"){
   box.box.append(button("Tetapkan Rencana Tahun Ini",()=>void changeYear("approved"),"mx-secondary"));
   box.box.append(button("Finalisasi Matriks",()=>void changeYear("finalized"),"mx-primary"));
  }else box.box.append(node("p","mx-muted","Akun ini tidak memiliki kewenangan finalisasi, atau tahun sudah dikunci."));
  content.append(box.box);
 }
 async function changeYear(status){
  if(!window.confirm("Apakah yakin akan "+(status==="finalized"?"MEMFINALISASI":"menetapkan")+" matriks tahun "+state.year+"?"))return;
  try{
   await api.approve({year:state.year,status,acknowledgeIncomplete:status==="finalized"});
   alert("Status tahun diperbarui.");await refresh(true);
  }catch(e){alert("Tidak dapat mengubah status: "+(e?.message||"Periksa izin."),true);}
 }
 function renderPage(){
  content.replaceChildren();
  navbar.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.page===state.page));
  if(state.page==="dashboard")renderDashboard();
  else if(state.page==="teams")renderTeams();
  else if(state.page==="kros")renderKros();
  else if(state.page==="activities")renderActivities();
  else if(state.page==="schedules")renderSchedules();
  else if(state.page==="monitor")renderMonitor();
  else if(state.page==="recon")renderRecon();
  else if(state.page==="standards")renderStandards();
  else if(state.page==="history")renderHistory();
  else if(state.page==="final")renderFinal();
  else if(state.page==="accounts"&&context.role==="admin")
    content.append(createAccessAdminView(rows('teams')));
  if(state.yearInfo?.status==="finalized"){
    content.prepend(node("div","mx-alert","Tahun telah difinalisasi. Semua perubahan data diblokir oleh backend."));
  }
  if(context.role==="admin"&&!rows("teams").length&&state.page!=="accounts"){
   const create=button("+ Siapkan Tahun "+state.year,async()=>{
    try{await api.init({year:state.year});alert("Tahun siap diisi.");await refresh(true);}
    catch(e){alert("Gagal menyiapkan tahun: "+e.message,true);}
   },"mx-primary");
   content.prepend(create);
  }
 }
 void refresh();
 return root;
}
