import { unzipSync, strFromU8 } from "fflate";

// Tahap perencanaan terpisah dari penetapan tim dan alokasi individu.
// Seluruh beban menggunakan orang-jam; kegiatan bersama tidak dikecualikan.
const PREFIX="bps-blora-workload-planning-v1-";
const fmt=n=>Number(n||0).toLocaleString("id-ID",{maximumFractionDigits:2});
const number=x=>{const n=Number(String(x??"").replace(",","."));return Number.isFinite(n)?n:0};
const html=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function personHourTotals(organicVolume,partnerVolume,hoursPerUnit){
 const organic=number(organicVolume)*number(hoursPerUnit),partner=number(partnerVolume)*number(hoursPerUnit);
 return {organic,partner,total:organic+partner};
}
function excel2026(doc){
 try{
  const seed=JSON.parse(doc.getElementById("seed").textContent);
  const people=new Map((seed.employees||[]).map(e=>[e.id,e.type]));
  const totals=new Map();
  for(const [activityId,personId,volume] of seed.annual_allocations_source||[]){
   if(!totals.has(activityId))totals.set(activityId,{organic:0,partner:0});
   const current=totals.get(activityId);
   if(people.get(personId)==="pegawai")current.organic+=number(volume);
   else if(people.get(personId)==="mitra")current.partner+=number(volume);
  }
  return (seed.activities||[]).map(a=>{
   const sum=totals.get(a.id),standard=number(a.standard_hours);
   return {id:a.id,group:a.team||"Belum Terpetakan",activity:a.group||"Kegiatan",
    description:a.description||"",volume:sum?sum.organic+sum.partner:number(a.annual_volume),unit:a.unit||"Unit",
    standard,reported:a.annual_hours_reported==null?null:number(a.annual_hours_reported),
    organic:sum?(sum.organic*standard):null,partner:sum?(sum.partner*standard):null,
    source:"Referensi Excel 2026 — alokasi dan selisih perlu diverifikasi"};
  });
 }catch{return []}
}
function dexml(s){return String(s||"").replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g,c=>{
 if(c==="&amp;")return "&";if(c==="&lt;")return "<";if(c==="&gt;")return ">";if(c==="&quot;")return '"';if(c==="&apos;")return "'";
 const n=c.startsWith("&#x")?parseInt(c.slice(3),16):parseInt(c.slice(2),10);
 return Number.isFinite(n)?String.fromCodePoint(n):c;
 });}
function csvRows(src){
 const delim=src.split(/\r?\n/,2)[0].includes("\t")?"\t":src.split(/\r?\n/,2)[0].includes(";")?";":",";
 const rows=[];let row=[],part="",q=false;
 for(let i=0;i<src.length;i++){const c=src[i];
  if(c==='"'){if(q&&src[i+1]==='"'){part+='"';i++}else q=!q}
  else if(!q&&c===delim){row.push(part);part=""}
  else if(!q&&(c==="\r"||c==="\n")){row.push(part);if(row.some(x=>x.trim()))rows.push(row);row=[];part="";if(c==="\r"&&src[i+1]==="\n")i++}
  else part+=c;
 }
 row.push(part);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
function dataRows(rows,year){
 const header=rows.findIndex(r=>String(r[0]||"").trim().toLocaleLowerCase("id")==="kode tim" &&
  String(r[8]||"").toLocaleLowerCase("id").includes("organik"));
 if(header<0)throw Error("Header A–J tidak cocok. Diperlukan Kode Tim, Tim Kerja, Kegiatan, Uraian, Vol, Satuan, Waktu per Satuan, Total Jam, Jam Organik, Jam Mitra.");
 const result=[];
 for(let i=header+1;i<rows.length;i++){
  const r=rows[i];if(!String(r[1]||"").trim()||!String(r[3]||"").trim())continue;
  result.push({id:"Y"+year+"-R"+(i+1),group:String(r[1]).trim(),activity:String(r[2]||"").trim(),
   description:String(r[3]).trim(),volume:number(r[4]),unit:String(r[5]||"Unit"),
   standard:number(r[6]),reported:number(r[7]),organic:number(r[8]),partner:number(r[9]),
   source:"Excel "+year+" · baris "+(i+1)});
 }
 if(!result.length)throw Error("Tidak ditemukan uraian dengan kelompok fungsi dan nama tugas.");
 return result;
}
async function xlsxRows(file,year){
 const entries=unzipSync(new Uint8Array(await file.arrayBuffer()));
 const read=p=>{if(!entries[p])throw Error("Bagian XLSX tidak ditemukan: "+p);return strFromU8(entries[p])};
 const wb=read("xl/workbook.xml"),sheet=[...wb.matchAll(/<sheet\b[^>]*\/>/g)].map(m=>m[0]).find(s=>s.includes('name="'+year+'"'));
 if(!sheet)throw Error("Sheet "+year+" tidak ada di workbook.");
 const relationId=sheet.match(/r:id="([^"]+)"/)?.[1];
 const rel=[...read("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*\/>/g)].map(m=>m[0]).find(s=>s.includes('Id="'+relationId+'"'));
 const target=rel?.match(/Target="([^"]+)"/)?.[1];
 if(!target)throw Error("Lokasi worksheet tidak diketahui.");
 const path=target.startsWith("/")?target.slice(1):"xl/"+target.replace(/^(\.\.\/)*/,"");
 const ss=entries["xl/sharedStrings.xml"]?strFromU8(entries["xl/sharedStrings.xml"]):"";
 const strings=[...ss.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>
  dexml([...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(v=>v[1]).join("")));
 const xml=read(path),rows=[],rowRx=/<row\b[^>]*>([\s\S]*?)<\/row>/g;
 let match;
 while((match=rowRx.exec(xml))){
  const row=Array(10).fill(""),content=match[1],cellRx=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let cell;
  while((cell=cellRx.exec(content))){
   const col=cell[1].match(/\br="([A-Z]+)\d+"/)?.[1];
   if(!col||col.length!==1)continue;
   const index=col.charCodeAt(0)-65;
   if(index>=10)break;
   const value=cell[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1]||"";
   const inline=cell[2]?.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1]||"";
   row[index]=/\bt="s"/.test(cell[1])?strings[Number(value)]||"":inline?dexml(inline.replace(/<[^>]*>/g,"")):dexml(value);
  }
  if(row.some(Boolean))rows.push(row);
 }
 return dataRows(rows,year);
}
function audit(r){
 const total=number(r.volume)*number(r.standard),missing=r.organic==null||r.partner==null;
 const organic=missing?0:number(r.organic),partner=missing?0:number(r.partner);
 return {total,organic,partner,missing,badSplit:!missing&&Math.abs(total-organic-partner)>.02,
  badSource:r.reported!=null&&Math.abs(total-number(r.reported))>.02};
}
export function mountWorkloadPlanning(doc,{simulation=false}={}){
 if(!doc||doc.getElementById("mkpPlanningOpen"))return;
 const win=doc.defaultView,base=excel2026(doc),key=y=>(simulation?"mkp-simulasi-v1:":"")+PREFIX+y;
 const state={year:2027,items:[],names:{},capacity:1650,search:""};
 const $=id=>doc.getElementById(id);
 function load(y){
  let saved;try{saved=JSON.parse(win.localStorage.getItem(key(y))||"null")}catch{}
  state.year=y;state.items=Array.isArray(saved?.items)?saved.items:y===2026?base:[];
  state.names=saved?.names||{};state.capacity=number(saved?.capacity)||1650;
 }
 function persist(){win.localStorage.setItem(key(state.year),JSON.stringify({items:state.items,names:state.names,capacity:state.capacity}))}
 const style=doc.createElement("style");
 style.textContent=[
 "#mkpPlanningOpen{padding:8px 12px!important;border-radius:9px!important;border:1px solid #9fc9e3!important;background:#e4f4ff!important;color:#125688!important;font-weight:850!important;cursor:pointer!important}",
 "#mkpPlanningDialog{position:fixed;inset:9px;margin:auto;width:min(1200px,calc(100vw - 18px));height:min(94vh,950px);max-width:none;max-height:none;padding:0;border-radius:14px;border:1px solid #c4dce9;box-shadow:0 25px 95px #15395755;background:#fff;color:#153f61;font:13px/1.5 Arial,sans-serif;overflow:hidden}",
 "#mkpPlanningDialog::backdrop{background:#092c52b2}#mkpPlanningDialog *{box-sizing:border-box}",
 "#mkpPlanningDialog header{background:#165f96;color:white;padding:15px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}",
 "#mkpPlanningDialog header h2{margin:0;color:white;font-size:20px}#mkpPlanningDialog header small{color:#dbedff}",
 "#mkpPlanningDialog main{height:calc(100% - 86px);overflow:auto;padding:16px 20px}",
 "#mkpPlanningDialog .toolbar{display:flex;align-items:end;flex-wrap:wrap;gap:9px}#mkpPlanningDialog label{font-weight:700;font-size:11px;display:grid;gap:4px}",
 "#mkpPlanningDialog button{border:1px solid #bed7e9;border-radius:8px;background:#f0f7fc;color:#155e92;padding:8px 11px;cursor:pointer;font-weight:800}",
 "#mkpPlanningDialog #mkpPlanClose{background:#ffffff20;color:white;border-color:#ffffff8c;font-size:19px}",
 "#mkpPlanningDialog input,#mkpPlanningDialog select{padding:7px 9px;border:1px solid #bed7e7;border-radius:7px;background:white;color:#123c60;font:inherit;max-width:100%}",
 "#mkpPlanningDialog .info{padding:11px 13px;background:#edf7ff;border:1px solid #cee4f3;border-radius:9px;margin:12px 0;color:#315f7c}",
 "#mkpPlanningDialog .info.warn{background:#fff7e4;border-color:#efd6a1;color:#795822}",
 "#mkpPlanningDialog .stats{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px;margin:12px 0}",
 "#mkpPlanningDialog .stats section{padding:12px;background:#f4f9fc;border:1px solid #d6e8f2;border-radius:10px}",
 "#mkpPlanningDialog .stats strong{display:block;font-size:19px;color:#165f96}#mkpPlanningDialog .stats small{color:#638097}",
 "#mkpPlanningDialog h3{font-size:15px;color:#166391;margin:17px 0 8px}",
 "#mkpPlanningDialog .table-scroll{overflow:auto;max-height:320px;border:1px solid #d9e8f1;border-radius:9px}",
 "#mkpPlanningDialog table{border-collapse:collapse;width:100%;font-size:12px}",
 "#mkpPlanningDialog th,#mkpPlanningDialog td{padding:8px 10px;border-bottom:1px solid #e5edf4;text-align:left;white-space:nowrap}",
 "#mkpPlanningDialog th{position:sticky;top:0;background:#e7f3fb;z-index:1;color:#1b567e}",
 "#mkpPlanningDialog td.wrap{white-space:normal;min-width:190px;max-width:350px}",
 "#mkpPlanningDialog td.num{text-align:right;font-variant-numeric:tabular-nums}#mkpPlanningDialog tr.bad{background:#fff5e3}",
 "#mkpPlanningDialog .form-grid{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px;margin-top:10px}",
 "#mkpPlanningDialog .hint{font-size:11px;color:#647f91;margin:8px 0}",
 "@media(max-width:750px){#mkpPlanningDialog .stats{grid-template-columns:repeat(2,1fr)}#mkpPlanningDialog .form-grid{grid-template-columns:repeat(2,1fr)}}"
 ].join("");
 doc.head.append(style);
 const trigger=doc.createElement("button");trigger.id="mkpPlanningOpen";trigger.type="button";trigger.textContent="Pemetaan Beban Kerja";
 (doc.querySelector(".rightbar")||doc.querySelector(".topbar")||doc.body).prepend(trigger);
 const dialog=doc.createElement("dialog");dialog.id="mkpPlanningDialog";
 dialog.innerHTML=[
 '<header><div><small>PERENCANAAN · SEBELUM PENETAPAN TIM</small><h2>Pemetaan Beban Organik dan Mitra</h2><small>Inventarisasi → Skenario Tim → Kebutuhan SDM → Penetapan Anggota → Alokasi Individu</small></div><button id="mkpPlanClose" type="button">Tutup ×</button></header>',
 '<main><div class="toolbar"><label>Tahun<select id="mkpPlanYear"><option>2026</option><option selected>2027</option><option>2028</option><option>2029</option><option>2030</option><option>2031</option></select></label>',
 '<label>Jam efektif per pegawai/tahun<input type="number" min="1" id="mkpPlanCapacity" value="1650" style="width:110px"></label>',
 '<label>Impor XLSX / CSV<input type="file" id="mkpPlanImport" accept=".xlsx,.csv,.tsv"></label>',
 '<button id="mkpPlanPrevious" type="button">Gunakan Data Tahun Sebelumnya</button><button id="mkpPlanExport" type="button">Unduh Rekap CSV</button></div>',
 '<div class="info" id="mkpPlanNote"></div><div class="stats" id="mkpPlanStats"></div>',
 '<h3>1. Kelompok Fungsi (Belum Merupakan Tim Final)</h3><p class="hint">Ubah nama usulan tim. Beri nama sama untuk beberapa fungsi apabila akan digabungkan.</p>',
 '<div class="table-scroll"><table><thead><tr><th>Kelompok Fungsi</th><th>Uraian</th><th>Total Orang-Jam</th><th>Organik</th><th>Mitra</th><th>Usulan Tim</th></tr></thead><tbody id="mkpPlanGroups"></tbody></table></div>',
 '<h3>2. Skenario Struktur dan Kebutuhan Anggota Organik</h3><div class="table-scroll"><table><thead><tr><th>Usulan Tim</th><th>Fungsi Tergabung</th><th>Total</th><th>Organik</th><th>Mitra</th><th>FTE Organik</th><th>Indikasi Anggota*</th></tr></thead><tbody id="mkpPlanTeams"></tbody></table></div>',
 '<p class="hint">*Indikasi = pembulatan ke atas FTE, bukan keputusan jumlah anggota. Evaluasi penugasan lintas tim, kompetensi, dan beban puncak bulanan.</p>',
 '<h3>3. Inventarisasi Kegiatan dan Rincian Uraian</h3><input id="mkpPlanSearch" placeholder="Cari kegiatan/uraian..." style="width:min(100%,380px)">',
 '<div class="table-scroll"><table><thead><tr><th>Fungsi</th><th>Kegiatan</th><th>Uraian</th><th>Volume</th><th>Jam/Satuan</th><th>Total</th><th>Organik</th><th>Mitra</th><th>Status Audit</th><th>Tindakan</th></tr></thead><tbody id="mkpPlanRows"></tbody></table></div>',
 '<p class="hint">Menampilkan maksimal 120 uraian sekaligus. Gunakan pencarian untuk mempersempit. Isian Organik/Mitra 2026 belum tersedia dalam referensi dan tidak diisi otomatis.</p>',
 '<h3>4. Tambah Uraian untuk Inventarisasi</h3><div class="info">Semua kegiatan menggunakan orang-jam. Rapat 5 jam × 8 peserta = <b>40 orang-jam</b>. Jika 5 peserta organik dan 3 mitra, masukkan 25 jam Organik dan 15 jam Mitra. Jangan menggandakan volume dua kali.</div>',
 '<form id="mkpPlanAdd" class="form-grid"><label>Kelompok Fungsi<input name="group" required></label><label>Nama Kegiatan<input name="activity" required></label><label>Uraian<input name="description" required></label><label>Satuan<input name="unit" value="O-Keg" required></label>',
 '<label>Volume Orang-Kegiatan<input name="volume" type="number" min="0.000001" step="any" required></label><label>Jam per Satuan<input name="standard" type="number" min="0.000001" step="any" required></label>',
 '<label>Jam Organik<input name="organic" type="number" min="0" step="any" required></label><label>Jam Mitra<input name="partner" type="number" min="0" step="any" required></label>',
 '<button type="submit">Tambah ke Inventarisasi</button></form>',
 '<p class="hint">Data pemetaan disimpan pada browser yang digunakan, terpisah dari data simulasi dan alokasi. Struktur tim final baru ditentukan setelah analisis disepakati.</p>',
 '</main>'
 ].join("");
 doc.body.append(dialog);
 const el=id=>doc.getElementById(id);
 const note=(s,warn)=>{el("mkpPlanNote").textContent=s;el("mkpPlanNote").classList.toggle("warn",!!warn)};
 function render(){
  let total=0,org=0,mitra=0,reported=0,unknown=0,problems=0;const groups=new Map();
  for(const r of state.items){const x=audit(r);total+=x.total;org+=x.organic;mitra+=x.partner;reported+=r.reported==null?x.total:number(r.reported);
   if(x.missing)unknown+=x.total;if(x.badSplit||x.badSource)problems++;
   const key=r.group||"Belum Dikelompokkan";
   if(!groups.has(key))groups.set(key,{count:0,total:0,organic:0,partner:0});
   const g=groups.get(key);g.count++;g.total+=x.total;g.organic+=x.organic;g.partner+=x.partner;
  }
  el("mkpPlanStats").innerHTML=[["Uraian",fmt(state.items.length)],["Total Hitung Ulang",fmt(total)+" Jam"],["Total Sumber Excel",fmt(reported)+" Jam"],["Jam Organik",fmt(org)],["Jam Mitra",fmt(mitra)]].map(a=>'<section><small>'+a[0]+'</small><strong>'+a[1]+'</strong></section>').join("");
  const list=[...groups].sort((a,b)=>b[1].total-a[1].total);
  el("mkpPlanGroups").innerHTML=list.map(([name,g])=>
   '<tr><td>'+html(name)+'</td><td class="num">'+fmt(g.count)+'</td><td class="num">'+fmt(g.total)+'</td><td class="num">'+fmt(g.organic)+'</td><td class="num">'+fmt(g.partner)+'</td><td><input data-func="'+html(name)+'" value="'+html(state.names[name]||name)+'" style="min-width:200px"></td></tr>'
  ).join("")||'<tr><td colspan="6">Data kosong. Impor Matriks Kegiatan Pegawai 2027.xlsx untuk memulai.</td></tr>';
  const teams=new Map();
  for(const [name,g] of list){const dest=(state.names[name]||name).trim()||name;
   if(!teams.has(dest))teams.set(dest,{groups:[],total:0,organic:0,partner:0});
   const x=teams.get(dest);x.groups.push(name);x.total+=g.total;x.organic+=g.organic;x.partner+=g.partner;
  }
  el("mkpPlanTeams").innerHTML=[...teams].sort((a,b)=>b[1].total-a[1].total).map(([name,g])=>{
   const fte=g.organic/state.capacity;
   return '<tr><td><b>'+html(name)+'</b></td><td class="wrap">'+html(g.groups.join("; "))+'</td><td class="num">'+fmt(g.total)+'</td><td class="num">'+fmt(g.organic)+'</td><td class="num">'+fmt(g.partner)+'</td><td class="num">'+fmt(fte)+'</td><td class="num">'+fmt(Math.ceil(fte))+'</td></tr>';
  }).join("")||'<tr><td colspan="7">Belum ada skenario yang dihitung.</td></tr>';
  const query=state.search.toLocaleLowerCase("id");
  el("mkpPlanRows").innerHTML=state.items.filter(r=>!query||[r.group,r.activity,r.description].join(" ").toLocaleLowerCase("id").includes(query)).slice(0,120).map(r=>{
   const x=audit(r);
   return '<tr class="'+(x.badSplit||x.badSource?"bad":"")+'"><td>'+html(r.group)+'</td><td>'+html(r.activity)+'</td><td class="wrap">'+html(r.description)+'</td><td class="num">'+fmt(r.volume)+' '+html(r.unit)+'</td><td class="num">'+fmt(r.standard)+'</td><td class="num">'+fmt(x.total)+'</td><td class="num">'+(x.missing?"Belum dipisah":fmt(x.organic))+'</td><td class="num">'+(x.missing?"Belum dipisah":fmt(x.partner))+'</td><td>'+html(x.badSplit?"Organik + Mitra tidak sama":x.badSource?"Beda dengan Excel":x.missing?"Perlu dipisah":"Sesuai")+'</td><td><button data-edit="'+html(r.id)+'">Edit</button></td></tr>';
  }).join("")||'<tr><td colspan="10">Tidak ada uraian yang sesuai.</td></tr>';
  el("mkpPlanGroups").querySelectorAll("[data-func]").forEach(input=>input.addEventListener("change",()=>{
   state.names[input.dataset.func]=input.value.trim()||input.dataset.func;persist();render();
  }));
  el("mkpPlanRows").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editRow(b.dataset.edit)));
  el("mkpPlanYear").value=String(state.year);el("mkpPlanCapacity").value=String(state.capacity);
  if(!state.items.length)note("Belum ada rincian "+state.year+". Impor workbook atau gunakan referensi tahun sebelumnya.",true);
  else if(unknown||problems)note("Audit: "+fmt(unknown)+" orang-jam belum dipisah Organik/Mitra; "+problems+" baris memiliki selisih. Total dihitung dari volume × standar waktu; angka sumber Excel (H) ditampilkan terpisah. Rekonsiliasi sebelum menentukan SDM.",true);
  else note(fmt(state.items.length)+" uraian terpetakan. Total Beban = Organik + Mitra. FTE hanya memakai Jam Organik.");
 }
 function editRow(id){
  const r=state.items.find(a=>a.id===id);if(!r)return;
  const shell=doc.createElement("dialog");shell.style.cssText="border:1px solid #b7d5e9;border-radius:13px;padding:20px;max-width:480px;width:calc(100vw - 36px);color:#194f7c;font:13px Arial";
  shell.innerHTML='<h3 style="margin:0 0 12px">Ubah Rincian Beban Kerja</h3><form method="dialog" id="mkpRowForm" style="display:grid;gap:10px">'+
   '<label>Uraian<input name="description" style="display:block;width:100%" value="'+html(r.description)+'" required></label>'+
   '<label>Volume Total<input name="volume" type="number" step="any" min="0" value="'+html(r.volume)+'" required></label>'+
   '<label>Jam per Satuan<input name="standard" type="number" step="any" min="0.000001" value="'+html(r.standard)+'" required></label>'+
   '<label>Jam Organik<input name="organic" type="number" min="0" step="any" value="'+html(r.organic??"")+'" required></label>'+
   '<label>Jam Mitra<input name="partner" type="number" min="0" step="any" value="'+html(r.partner??"")+'" required></label>'+
   '<div style="display:flex;gap:8px;justify-content:end"><button value="cancel">Batal</button><button value="save" style="background:#176b9d;color:white">Simpan</button></div></form>';
  doc.body.append(shell);shell.showModal();
  shell.addEventListener("close",()=>{
   if(shell.returnValue==="save"){
    const fd=new FormData(shell.querySelector("form"));
    const vol=number(fd.get("volume")),std=number(fd.get("standard")),organic=number(fd.get("organic")),partner=number(fd.get("partner"));
    if(std<=0||vol<0||organic<0||partner<0){note("Angka volume, standar, atau pembagian jam tidak valid.",true)}
    else{r.description=String(fd.get("description")).trim();r.volume=vol;r.standard=std;r.organic=organic;r.partner=partner;persist();render();}
   }
   shell.remove();
  },{once:true});
 }
 trigger.addEventListener("click",()=>{render();dialog.showModal()});
 el("mkpPlanClose").addEventListener("click",()=>dialog.close());
 el("mkpPlanYear").addEventListener("change",e=>{load(number(e.target.value));render()});
 el("mkpPlanCapacity").addEventListener("change",e=>{state.capacity=Math.max(1,number(e.target.value));persist();render()});
 el("mkpPlanSearch").addEventListener("input",e=>{state.search=e.target.value;render()});
 el("mkpPlanImport").addEventListener("change",async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{
   note("Membaca data Excel "+f.name+" ...");
   const rows=/\.xlsx$/i.test(f.name)?await xlsxRows(f,state.year):dataRows(csvRows(await f.text()),state.year);
   if(!win.confirm("Impor "+rows.length+" uraian dari "+f.name+" ke tahun "+state.year+"? Draf pemetaan lokal tahun ini akan diganti."))return;
   state.items=rows;state.names={};persist();render();note("Impor berhasil: "+fmt(rows.length)+" uraian. Periksa baris yang perlu rekonsiliasi.");
  }catch(error){note("Impor gagal: "+String(error?.message||error),true)}
  finally{e.target.value=""}
 });
 el("mkpPlanPrevious").addEventListener("click",()=>{
  if(state.year<=2026)return note("Tahun 2026 menggunakan referensi matriks Excel.",true);
  let prev;try{prev=JSON.parse(win.localStorage.getItem(key(state.year-1))||"null")}catch{}
  const rows=prev?.items||(state.year===2027?base:[]);
  if(!rows.length)return note("Inventarisasi tahun "+(state.year-1)+" belum tersedia.",true);
  if(!win.confirm("Gunakan "+rows.length+" uraian "+(state.year-1)+" sebagai referensi "+state.year+"? Volume dan pembagian organik/mitra harus ditinjau ulang."))return;
  state.items=rows.map((r,i)=>({...r,id:"REK-"+state.year+"-"+i,organic:null,partner:null,source:"Referensi "+(state.year-1)}));
  state.names={};persist();render();
 });
 el("mkpPlanExport").addEventListener("click",()=>{
  const map=new Map();
  for(const r of state.items){const x=audit(r),name=state.names[r.group]||r.group;if(!map.has(name))map.set(name,{total:0,org:0,partner:0});
   const v=map.get(name);v.total+=x.total;v.org+=x.organic;v.partner+=x.partner;
  }
  const rows=[["Usulan Tim","Total Orang-Jam","Jam Organik","Jam Mitra","FTE Organik"],...[...map].map(([n,v])=>[n,v.total,v.org,v.partner,v.org/state.capacity])];
  const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(";")).join("\r\n");
  const a=doc.createElement("a"),url=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}));
  a.href=url;a.download="Pemetaan_Beban_"+state.year+".csv";a.click();win.setTimeout(()=>URL.revokeObjectURL(url),3000);
 });
 el("mkpPlanAdd").addEventListener("submit",e=>{
  e.preventDefault();const v=new FormData(e.currentTarget),total=number(v.get("volume"))*number(v.get("standard")),organic=number(v.get("organic")),partner=number(v.get("partner"));
  if(total<=0||Math.abs(total-organic-partner)>.02)return note("Total harus sama dengan Jam Organik + Jam Mitra. Periksa volume dan standar waktu.",true);
  state.items.push({id:"NEW-"+Date.now(),group:String(v.get("group")).trim(),activity:String(v.get("activity")).trim(),
   description:String(v.get("description")).trim(),unit:String(v.get("unit")).trim(),volume:number(v.get("volume")),standard:number(v.get("standard")),
   reported:total,organic,partner,source:"Input perencanaan "+state.year});
  persist();e.currentTarget.reset();render();note("Uraian berhasil ditambahkan dengan total "+fmt(total)+" orang-jam.");
 });
 const selectedYear=number(doc.getElementById("yearSelect")?.value)||2027;
 load(Math.max(2026,Math.min(2031,selectedYear)));render();
}
