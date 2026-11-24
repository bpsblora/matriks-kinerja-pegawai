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

const workbookCache=new WeakMap();
async function workbookEntries(file){
 let entries=workbookCache.get(file);
 if(!entries){entries=unzipSync(new Uint8Array(await file.arrayBuffer()));workbookCache.set(file,entries)}
 return entries;
}
function readEntry(entries,path){
 if(!entries[path])throw Error("Bagian XLSX tidak ditemukan: "+path);
 return strFromU8(entries[path]);
}
function attr(tag,name){
 return tag.match(new RegExp("(?:^|\\s)"+name.replace(":","\\:")+'="([^"]*)"'))?.[1]||"";
}
async function workbookSheets(file){
 const entries=await workbookEntries(file);
 const wb=readEntry(entries,"xl/workbook.xml");
 const relations=new Map([...readEntry(entries,"xl/_rels/workbook.xml.rels")
  .matchAll(/<Relationship\b[^>]*\/>/g)]
  .map(m=>[attr(m[0],"Id"),attr(m[0],"Target")]));
 const sheets=[...wb.matchAll(/<sheet\b[^>]*\/>/g)].map(m=>{
  const name=dexml(attr(m[0],"name")),target=relations.get(attr(m[0],"r:id"));
  const path=target?(target.startsWith("/")?target.slice(1):"xl/"+target.replace(/^(\.\.\/)*/,"")):null;
  return {name,path};
 });
 if(!sheets.length)throw Error("File tidak memiliki sheet yang dapat dibaca.");
 return {entries,sheets};
}
export async function xlsxSheets(file){
 const {sheets}=await workbookSheets(file);
 return sheets.map(s=>s.name);
}
async function sheetRows(file,sheetName){
 const {entries,sheets}=await workbookSheets(file);
 const sheet=sheets.find(s=>s.name===sheetName);
 if(!sheet)throw Error('Sheet "'+sheetName+'" tidak ditemukan.');
 if(!sheet.path)throw Error("Lokasi sheet "+sheetName+" tidak ditemukan.");
 const ss=entries["xl/sharedStrings.xml"]?readEntry(entries,"xl/sharedStrings.xml"):"";
 const strings=[...ss.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>
  dexml([...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(v=>v[1]).join("")));
 const xml=readEntry(entries,sheet.path),rows=[],rowRx=/<row\b([^>]*)>([\s\S]*?)<\/row>/g;
 let match;
 while((match=rowRx.exec(xml))){
  const row=Array(10).fill(""),rowNo=Number(attr(match[1],"r"))||rows.length+1;
  const cellRx=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;let cell;
  while((cell=cellRx.exec(match[2]))){
   const col=attr(cell[1],"r").match(/^([A-Z]+)\d+$/)?.[1];
   if(!col||col.length!==1)continue;
   const ix=col.charCodeAt(0)-65;if(ix<0||ix>9)continue;
   const value=cell[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1]||"";
   const inline=cell[2]?.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1]||"";
   row[ix]=attr(cell[1],"t")==="s"?strings[Number(value)]||"":
    inline?dexml([...inline.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>m[1]).join("")):dexml(value);
  }
  if(row.some(v=>String(v).trim())){row.rowNumber=rowNo;rows.push(row)}
 }
 return rows;
}
function headerIndex(rows){
 return rows.findIndex(r=>String(r[0]||"").trim().toLocaleLowerCase("id")==="kode tim" &&
  String(r[8]||"").toLocaleLowerCase("id").includes("organik")&&
  String(r[9]||"").toLocaleLowerCase("id").includes("mitra"));
}
function rangeBounds(rows){
 const hi=headerIndex(rows);
 const data=hi>=0?rows.slice(hi+1):rows;
 return {headerRow:hi>=0?(rows[hi].rowNumber||hi+1):null,
  firstRow:data[0]?.rowNumber||0,lastRow:data.at(-1)?.rowNumber||0};
}
export async function xlsxSheetInfo(file,sheetName){
 return rangeBounds(await sheetRows(file,sheetName));
}
function dataRows(rows,year,options={}){
 const hi=headerIndex(rows);
 if(hi<0)throw Error("Format kolom A–J tidak sesuai: baris header harus berisi Kode Tim, Tim Kerja, Kegiatan, Uraian, Vol, Satuan, Waktu per Satuan, Total Jam, Jam Organik, dan Jam Mitra. Pilih sheet yang memuat format matriks ini.");
 const firstData=rows[hi].rowNumber?rows[hi].rowNumber+1:hi+2;
 const maxRow=rows.at(-1)?.rowNumber||rows.length;
 const start=options.startRow==null?firstData:Number(options.startRow);
 const end=options.endRow==null?maxRow:Number(options.endRow);
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<firstData||end<start)
  throw Error("Rentang tidak valid. Baris awal minimal "+firstData+" dan baris akhir tidak boleh lebih kecil dari awal.");
 if(end>maxRow)throw Error("Baris akhir maksimal "+maxRow+" pada sheet ini.");
 const result=[];
 for(let i=hi+1;i<rows.length;i++){
  const r=rows[i],line=r.rowNumber||i+1;
  if(line<start||line>end)continue;
  if(!String(r[1]||"").trim()||!String(r[3]||"").trim())continue;
  result.push({id:"Y"+year+"-R"+line,group:String(r[1]).trim(),activity:String(r[2]||"").trim(),
   description:String(r[3]).trim(),volume:number(r[4]),unit:String(r[5]||"Unit"),
   standard:number(r[6]),reported:r[7]===""?null:number(r[7]),
   organic:r[8]===""?null:number(r[8]),partner:r[9]===""?null:number(r[9]),
   source:"Excel "+year+" · baris "+line});
 }
 if(!result.length)throw Error("Tidak ada uraian pada rentang "+start+"–"+end+". Periksa sheet dan nomor baris.");
 return result;
}
export async function xlsxRows(file,year,options={}){
 return dataRows(await sheetRows(file,options.sheetName||String(year)),year,options);
}
export function csvImportRows(text,year,options={}){
 const rows=csvRows(text);rows.forEach((r,i)=>r.rowNumber=i+1);
 return dataRows(rows,year,options);
}
export function previousYearDraft(rows,year){
 return rows.map((r,i)=>({...r,id:"REK-"+year+"-"+i,organic:null,partner:null,
  source:"Referensi "+(year-1)+" — pembagian Organik/Mitra perlu diverifikasi"}));
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
 const state={year:2027,items:[],names:{},assignments:{},structureStatus:"draft",approvedAt:"",capacity:1650,search:""};
 let importFile=null,previewRows=null,previewSignature="",sourceMode="manual";
 const $=id=>doc.getElementById(id);
 function load(y){
  let saved;try{saved=JSON.parse(win.localStorage.getItem(key(y))||"null")}catch{}
  state.year=y;state.items=Array.isArray(saved?.items)?saved.items:y===2026?base:[];
  state.names=saved?.names||{};state.assignments=saved?.assignments||{};state.structureStatus=saved?.structureStatus||"draft";state.approvedAt=saved?.approvedAt||"";state.capacity=number(saved?.capacity)||1650;
 }
 function store(){win.localStorage.setItem(key(state.year),JSON.stringify({items:state.items,names:state.names,assignments:state.assignments,structureStatus:state.structureStatus,approvedAt:state.approvedAt,capacity:state.capacity}))}
 function persist(){state.structureStatus="draft";state.approvedAt="";store();refreshDashboard();}
 const userRole=()=>win.__mpPreviewSessionState?.()?.role||"pegawai";
 const canEdit=()=>userRole()==="admin";
 const isHead=()=>userRole()==="kepala";
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
 "#mkpPlanningDialog [hidden]{display:none!important}",
 "#mkpPlanningDialog .source-tabs{display:flex;gap:8px;margin:12px 0}",
 "#mkpPlanningDialog .source-tabs button{min-width:145px;background:#f3f9ff;border:1px solid #b3d1e8}",
 "#mkpPlanningDialog .source-tabs button[aria-pressed=true]{background:#146da7;color:#fff;border-color:#146da7}",
 "#mkpPlanningDialog .source-panel{border:1px solid #d1e5f2;background:#f8fbff;border-radius:11px;padding:12px;margin:9px 0}",
 "#mkpPlanningDialog .import-fields{display:flex;flex-wrap:wrap;gap:9px;align-items:end}",
 "#mkpPlanningDialog .import-fields label{flex:0 1 170px;min-width:128px}",
 "#mkpPlanningDialog .import-fields label:first-child{flex:1 1 260px}",
 "#mkpPlanningDialog .import-fields input[type=number]{width:112px}",
 "#mkpPlanningDialog .import-preview{font-size:12px;padding:9px 12px;margin-top:10px;background:#eaf5fd;border-radius:9px;white-space:pre-wrap;color:#27526f}",
 "#mkpPlanningDialog .primary{background:#146da7;color:white;border-color:#146da7}",
 "#mkpPlanningDialog button:disabled{opacity:.5;cursor:not-allowed}",
 "@media(max-width:750px){#mkpPlanningDialog .stats{grid-template-columns:repeat(2,1fr)}#mkpPlanningDialog .form-grid{grid-template-columns:repeat(2,1fr)}}"
 ].join("");
 style.textContent += style.textContent.replaceAll("#mkpPlanningDialog","#mkpScenarioContent");
 style.textContent += '#mkpPlanningDialog,#mkpScenarioContent{position:static!important;inset:auto!important;display:block!important;margin:0!important;width:100%!important;height:auto!important;max-height:none!important;box-shadow:none!important;overflow:visible!important}#mkpPlanningDialog main{height:auto!important;overflow:visible!important}#mkpScenarioContent .scenario-body{padding:16px 20px}#mkpScenarioContent .scenario-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:8px 0 16px}#mkpScenarioContent .scenario-toolbar label{font-size:11px;display:grid;gap:4px;font-weight:bold}#mkpScenarioContent .scenario-toolbar input{width:135px}';
 doc.head.append(style);
 const trigger=doc.createElement("button");trigger.id="mkpPlanningOpen";trigger.type="button";trigger.textContent="Pemetaan Beban Kerja";
 const inventoryPage=doc.getElementById("pageInventory"),scenarioPage=doc.getElementById("pageScenario");
 if(!inventoryPage||!scenarioPage)throw Error("Menu perencanaan belum tersedia.");
 inventoryPage.append(trigger);
 trigger.textContent="Buka Form Inventarisasi dan Impor Excel";
 inventoryPage.insertAdjacentHTML("afterbegin", '<section class="panel" style="padding:20px"><h2>Inventarisasi Kegiatan</h2><p>Input Manual, Impor Excel berdasarkan sheet dan rentang baris, serta Gunakan Data Tahun Sebelumnya. Data Organik dan Mitra dicatat terpisah.</p></section>');
 scenarioPage.innerHTML='<section class="panel" style="padding:20px"><h2>Pemetaan &amp; Skenario Tim</h2><p>Ubah usulan nama tim untuk menggabungkan kelompok fungsi, lalu bandingkan total jam, Jam Organik, Jam Mitra, FTE, dan kebutuhan anggota.</p><button type="button" class="btn primary" id="mkpScenarioOpen">Buka Skenario Pembentukan Tim</button></section>';
 const dialog=doc.createElement("section");dialog.id="mkpPlanningDialog";
 dialog.innerHTML=[
 '<header><div><small>PERENCANAAN · SEBELUM PENETAPAN TIM</small><h2>Pemetaan Beban Organik dan Mitra</h2><small>Inventarisasi → Skenario Tim → Kebutuhan SDM → Penetapan Anggota → Alokasi Individu</small></div><button id="mkpPlanClose" type="button">Tutup ×</button></header>',
 '<main><div class="toolbar"><label>Tahun<select id="mkpPlanYear"><option>2026</option><option selected>2027</option><option>2028</option><option>2029</option><option>2030</option><option>2031</option></select></label>',
 '<label>Jam efektif per pegawai/tahun<input type="number" min="1" id="mkpPlanCapacity" value="1650" style="width:110px"></label>',
 '<button id="mkpPlanExport" type="button">Unduh Rekap CSV</button></div>',
 '<div class="source-tabs" aria-label="Pilih Metode Inventarisasi"><button data-source-mode="manual" aria-pressed="true" type="button">Input Manual</button><button data-source-mode="excel" aria-pressed="false" type="button">Impor Excel</button></div>',
 '<section class="source-panel" id="mkpPlanManualActions"><b>Pengisian langsung di website</b><p class="hint">Mulai dari nol, atau salin daftar kegiatan tahun sebelumnya sebagai draf yang bisa diubah.</p><button id="mkpPlanPrevious" type="button">Gunakan Data Tahun Sebelumnya</button> <button id="mkpPlanClear" type="button">Mulai dari Kosong</button></section>',
 '<section class="source-panel" id="mkpPlanImportActions" hidden><b>Impor Excel dengan Rentang Baris yang Ditentukan</b><p class="hint">Pilih file, sheet, baris awal data, dan baris akhir. Data tidak disimpan sebelum kamu mengeklik Impor.</p><div class="import-fields">',
 '<label>Pilih File<input type="file" id="mkpPlanImport" accept=".xlsx,.csv,.tsv"></label>',
 '<label>Sheet<select id="mkpPlanSheet" disabled><option value="">Pilih berkas dahulu</option></select></label>',
 '<label>Mulai Baris<input id="mkpPlanStartRow" type="number" min="1" step="1" value="3"></label>',
 '<label>Sampai Baris<input id="mkpPlanEndRow" type="number" min="1" step="1" value="3"></label>',
 '<label>Metode Impor<select id="mkpPlanMerge"><option value="replace">Ganti Inventarisasi Tahun Ini</option><option value="append">Gabungkan Tanpa Duplikat</option></select></label>',
 '<button id="mkpPlanCheck" type="button">Pratinjau Rentang</button><button id="mkpPlanImportNow" class="primary" type="button" disabled>Impor Data Terpilih</button></div>',
 '<div class="import-preview" id="mkpPlanPreview" role="status">File belum dipilih. Untuk workbook contoh 2027, pilih sheet 2027 dengan baris awal 3.</div></section>',
 '<div class="info" id="mkpPlanNote"></div><div class="stats" id="mkpPlanStats"></div>',
 '<h3>1. Kelompok Fungsi (Belum Merupakan Tim Final)</h3><p class="hint">Ubah nama usulan tim. Beri nama sama untuk beberapa fungsi apabila akan digabungkan.</p>',
 '<div class="table-scroll"><table><thead><tr><th>Kelompok Fungsi</th><th>Uraian</th><th>Total Orang-Jam</th><th>Organik</th><th>Mitra</th><th>Usulan Tim</th></tr></thead><tbody id="mkpPlanGroups"></tbody></table></div>',
 '<h3>2. Skenario Struktur dan Kebutuhan Anggota Organik</h3><div class="table-scroll"><table><thead><tr><th>Usulan Tim</th><th>Fungsi Tergabung</th><th>Total</th><th>Organik</th><th>Mitra</th><th>FTE Organik</th><th>Indikasi Anggota*</th></tr></thead><tbody id="mkpPlanTeams"></tbody></table></div>',
 '<p class="hint">*Indikasi = pembulatan ke atas FTE, bukan keputusan jumlah anggota. Evaluasi penugasan lintas tim, kompetensi, dan beban puncak bulanan.</p>',
 '<h3>3. Inventarisasi Kegiatan dan Rincian Uraian</h3><input id="mkpPlanSearch" placeholder="Cari kegiatan/uraian..." style="width:min(100%,380px)">',
 '<div class="table-scroll"><table><thead><tr><th>Fungsi</th><th>Kegiatan</th><th>Uraian</th><th>Volume</th><th>Jam/Satuan</th><th>Total</th><th>Organik</th><th>Mitra</th><th>Status Audit</th><th>Usulan Tim per Uraian</th><th>Tindakan</th></tr></thead><tbody id="mkpPlanRows"></tbody></table></div>',
 '<p class="hint">Menampilkan maksimal 120 uraian sekaligus. Gunakan pencarian untuk mempersempit. Isian Organik/Mitra 2026 belum tersedia dalam referensi dan tidak diisi otomatis.</p>',
 '<section id="mkpPlanManualForm"><h3>4. Input Manual — Tambah Uraian Kegiatan</h3><div class="info">Semua kegiatan menggunakan orang-jam. Rapat 5 jam × 8 peserta = <b>40 orang-jam</b>. Jika 5 peserta organik dan 3 mitra, masukkan 25 jam Organik dan 15 jam Mitra. Jangan menggandakan volume dua kali.</div>',
 '<form id="mkpPlanAdd" class="form-grid"><label>Kelompok Fungsi<input name="group" required></label><label>Nama Kegiatan<input name="activity" required></label><label>Uraian<input name="description" required></label><label>Satuan<input name="unit" value="O-Keg" required></label>',
 '<label>Volume Orang-Kegiatan<input name="volume" type="number" min="0.000001" step="any" required></label><label>Jam per Satuan<input name="standard" type="number" min="0.000001" step="any" required></label>',
 '<label>Jam Organik<input name="organic" type="number" min="0" step="any" required></label><label>Jam Mitra<input name="partner" type="number" min="0" step="any" required></label>',
 '<button type="submit">Tambah ke Inventarisasi</button></form></section>',
 '<p class="hint">Data pemetaan disimpan pada browser yang digunakan, terpisah dari data simulasi dan alokasi. Struktur tim final baru ditentukan setelah analisis disepakati.</p>',
 '</main>'
 ].join("");
 inventoryPage.append(dialog);
 trigger.remove();
 scenarioPage.innerHTML='<section id="mkpScenarioContent"><header><div><small>TAHAP 2 · SEBELUM PENETAPAN STRUKTUR</small><h2>Pemetaan &amp; Skenario Tim</h2><small>Gabung atau pisahkan kelompok fungsi untuk membandingkan kebutuhan SDM.</small></div></header><div class="scenario-body"><div class="scenario-toolbar"><label>Jam Efektif per Pegawai/Tahun <input id="mkpScenarioCapacity" type="number" min="1" value="1650"></label><button type="button" id="mkpScenarioToInventory">Lihat Inventarisasi</button><button type="button" id="mkpScenarioApprove">Tetapkan Struktur (Kepala BPS)</button><button type="button" id="mkpScenarioSync">Terapkan Uraian ke Input Alokasi</button></div><div id="mkpScenarioStatus" class="scenario-status" style="padding:10px 13px;margin-bottom:12px;background:#edf6fd;border:1px solid #d1e2ee;border-radius:9px"></div><div id="mkpScenarioTables"></div></div></section>';
 const body=dialog.querySelector("main"),headings=[...body.querySelectorAll("h3")];
 const start=headings.find(x=>x.textContent.startsWith("1. Kelompok Fungsi"));
 const stop=headings.find(x=>x.textContent.startsWith("Inventarisasi Kegiatan"));
 if(!start||!stop)throw Error("Heading skenario tidak ditemukan.");
 const scenarioTables=doc.getElementById("mkpScenarioTables");
 let item=start;
 while(item&&item!==stop){const next=item.nextElementSibling;scenarioTables.append(item);item=next;}
 const el=id=>doc.getElementById(id);
 const note=(s,warn)=>{el("mkpPlanNote").textContent=s;el("mkpPlanNote").classList.toggle("warn",!!warn)};

 function refreshDashboard(){
  const host=el("pageDashboard");if(!host||host.classList.contains("hidden"))return;
  let card=el("mkpPlanDashboard");
  if(!card){
   card=doc.createElement("section");card.id="mkpPlanDashboard";card.className="panel";
   card.style.cssText="padding:15px 19px;margin:10px 0 16px;border:1px solid #d4e5f1;border-radius:12px";
   const heading=host.querySelector(".combined-metrics");if(heading)heading.after(card);else host.prepend(card);
  }
  let total=0,organic=0,partner=0,pending=0;
  for(const item of state.items){const a=audit(item);total+=a.total;organic+=a.organic;partner+=a.partner;
   if(a.missing||a.badSplit||a.badSource)pending++;
  }
  card.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="margin:0;color:#145c91">Pemetaan Awal Beban Kerja '+state.year+'</h3><small>Inventarisasi dan alokasi pegawai dihitung terpisah</small></div>'+
   '<div class="combined-metrics" style="margin-top:12px">'+
   '<article><small>Total Tanggung Jawab Kantor</small><strong>'+fmt(total)+' Jam-Orang</strong></article>'+
   '<article><small>Jam Organik</small><strong>'+fmt(organic)+' Jam-Orang</strong></article>'+
   '<article><small>Jam Mitra</small><strong>'+fmt(partner)+' Jam-Orang</strong></article>'+
   '<article><small>Perlu Rekonsiliasi</small><strong>'+fmt(pending)+' Uraian</strong></article></div>'+
   '<p style="font-size:12px;color:#54718a;margin:10px 0 0">'+(state.structureStatus==="approved"?'Skenario struktur telah disetujui secara lokal; belum tersinkron antarpengguna.':'Skenario struktur belum disetujui.')+
   ' Perhitungan beban kantor mencakup pekerjaan yang dilaksanakan Organik maupun Mitra. Alokasi individu hanya menghitung jam pegawai kantor.</p>';
 }

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
  for(const r of state.items){
   const a=audit(r),name=(state.assignments[r.id]||state.names[r.group]||r.group||"Belum Dikelompokkan").trim();
   if(!teams.has(name))teams.set(name,{groups:new Set(),total:0,organic:0,partner:0,unverified:0});
   const g=teams.get(name);g.groups.add(r.group);g.total+=a.total;g.organic+=a.organic;g.partner+=a.partner;
   if(a.missing||a.badSplit||a.badSource)g.unverified++;
  }
  el("mkpPlanTeams").innerHTML=[...teams].sort((a,b)=>b[1].total-a[1].total).map(([name,g])=>{
   const fte=g.organic/state.capacity;
   return '<tr><td><b>'+html(name)+'</b></td><td class="wrap">'+html([...g.groups].join("; "))+'</td><td class="num">'+fmt(g.total)+'</td><td class="num">'+fmt(g.organic)+'</td><td class="num">'+fmt(g.partner)+'</td><td class="num">'+fmt(fte)+'</td><td class="num">'+fmt(Math.ceil(fte))+'</td></tr>';
  }).join("")||'<tr><td colspan="7">Belum ada skenario yang dihitung.</td></tr>';
  const query=state.search.toLocaleLowerCase("id");
  el("mkpPlanRows").innerHTML=state.items.filter(r=>!query||[r.group,r.activity,r.description].join(" ").toLocaleLowerCase("id").includes(query)).slice(0,120).map(r=>{
   const x=audit(r);
   return '<tr class="'+(x.badSplit||x.badSource?"bad":"")+'"><td>'+html(r.group)+'</td><td>'+html(r.activity)+'</td><td class="wrap">'+html(r.description)+'</td><td class="num">'+fmt(r.volume)+' '+html(r.unit)+'</td><td class="num">'+fmt(r.standard)+'</td><td class="num">'+fmt(x.total)+'</td><td class="num">'+(x.missing?"Belum dipisah":fmt(x.organic))+'</td><td class="num">'+(x.missing?"Belum dipisah":fmt(x.partner))+'</td><td>'+html(x.badSplit?"Organik + Mitra tidak sama":x.badSource?"Beda dengan Excel":x.missing?"Perlu dipisah":"Sesuai")+'</td><td><input data-assign="'+html(r.id)+'" value="'+html(state.assignments[r.id]||'')+'" placeholder="'+html(state.names[r.group]||r.group)+'" style="min-width:160px" aria-label="Usulan tim per uraian"></td><td><button data-edit="'+html(r.id)+'">Edit</button></td></tr>';
  }).join("")||'<tr><td colspan="11">Tidak ada uraian yang sesuai.</td></tr>';
  el("mkpPlanGroups").querySelectorAll("[data-func]").forEach(input=>input.addEventListener("change",()=>{
   state.names[input.dataset.func]=input.value.trim()||input.dataset.func;persist();render();
  }));
  el("mkpPlanRows").querySelectorAll("[data-assign]").forEach(input=>input.addEventListener("change",()=>{
   if(!canEdit())return;const name=input.value.trim();if(name)state.assignments[input.dataset.assign]=name;else delete state.assignments[input.dataset.assign];persist();render();
  }));
  el("mkpPlanRows").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editRow(b.dataset.edit)));
  el("mkpPlanYear").value=String(state.year);el("mkpPlanCapacity").value=String(state.capacity);el("mkpScenarioCapacity").value=String(state.capacity);
  el("mkpScenarioStatus").textContent=state.structureStatus==="approved"?
   "Struktur disetujui dalam draf lokal pada "+(state.approvedAt?new Date(state.approvedAt).toLocaleString("id-ID"):"-")+". Lanjutkan penetapan ketua, anggota, dan KRO. Belum tersinkron antarpengguna.":
   "Skenario masih berupa draf. Pastikan Total Jam = Jam Organik + Jam Mitra dan seluruh selisih sumber selesai diperiksa.";
  el("mkpScenarioApprove").disabled=!isHead()||state.year===2026||!state.items.length;
  el("mkpScenarioSync").disabled=!canEdit()||state.structureStatus!=="approved";
  for(const id of ["mkpPlanCapacity","mkpScenarioCapacity","mkpPlanPrevious","mkpPlanClear","mkpPlanImport"]){const x=el(id);if(x)x.disabled=!canEdit()}
  el("mkpPlanImportNow").disabled=!canEdit()||!previewRows;
  el("mkpPlanAdd").querySelectorAll("input,button").forEach(x=>x.disabled=!canEdit());
  el("mkpPlanGroups").querySelectorAll("[data-func]").forEach(x=>x.disabled=!canEdit());
  el("mkpPlanRows").querySelectorAll("[data-assign],[data-edit]").forEach(x=>x.disabled=!canEdit());
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
 win.__mpPlanningRefresh=page=>page==="dashboard"?refreshDashboard():render();
 el("mkpPlanClose").addEventListener("click",()=>doc.getElementById("navDashboard")?.click());
 el("mkpScenarioToInventory").addEventListener("click",()=>doc.getElementById("navInventory")?.click());
 el("mkpScenarioCapacity").addEventListener("change",e=>{state.capacity=Math.max(1,number(e.target.value));persist();render();});

 el("mkpScenarioApprove").addEventListener("click",()=>{
  if(!isHead())return note("Penetapan struktur hanya dapat dilakukan Kepala BPS.",true);
  if(!state.items.length)return note("Lengkapi inventarisasi sebelum menetapkan struktur.",true);
  const invalid=state.items.filter(r=>{const a=audit(r);return a.missing||a.badSplit||a.badSource||!r.description||!r.activity||number(r.standard)<=0;});
  if(invalid.length){el("mkpScenarioStatus").textContent="Belum dapat disetujui. "+invalid.length+" uraian masih perlu rekonsiliasi Total Jam, Organik/Mitra, atau identitas kegiatan.";return}
  const names=[...new Set(state.items.map(r=>(state.assignments[r.id]||state.names[r.group]||r.group||"").trim()).filter(Boolean))];
  if(!win.confirm("Tetapkan struktur "+names.length+" tim untuk tahun "+state.year+" dari pemetaan saat ini? Tim lama yang tidak dipilih akan dinonaktifkan hanya jika belum mempunyai penetapan/alokasi."))return;
  const result=win.__mpPlanningApplyStructure?.(names);
  if(!result?.ok){el("mkpScenarioStatus").textContent=result?.error||"Fungsi penerapan struktur belum tersedia.";return}
  state.structureStatus="approved";state.approvedAt=new Date().toISOString();store();render();
  el("mkpScenarioStatus").textContent="Struktur diterapkan dalam draf lokal: "+result.count+" tim ("+result.created+" baru, "+result.deactivated+" nonaktif). Lanjutkan Penetapan Tim dan Pembagian KRO.";
 });
 el("mkpScenarioSync").addEventListener("click",()=>{
  if(!canEdit())return note("Hanya Admin yang dapat meneruskan kegiatan ke Input Alokasi.",true);
  if(state.structureStatus!=="approved")return note("Skenario struktur tim harus ditetapkan oleh Kepala BPS terlebih dahulu.",true);
  if(!win.confirm("Teruskan rincian inventarisasi "+state.year+" ke Input Alokasi? Aktivitas identik tidak akan digandakan. Jam individu tetap harus dialokasikan terpisah."))return;
  const rows=state.items.map(r=>({...r,proposedTeam:(state.assignments[r.id]||state.names[r.group]||r.group||"").trim()}));
  const result=win.__mpPlanningSyncActivities?.(rows,state.year);
  if(!result?.ok){el("mkpScenarioStatus").textContent=result?.error||"Transfer belum tersedia.";return}
  el("mkpScenarioStatus").textContent=result.created+" uraian berhasil diteruskan; "+result.duplicates+" duplikat dilewati. Buka Input Alokasi untuk menetapkan pekerjaan pegawai.";
  render();
 });
 el("mkpPlanYear").addEventListener("change",e=>{load(number(e.target.value));invalidatePreview();render()});
 el("mkpPlanCapacity").addEventListener("change",e=>{state.capacity=Math.max(1,number(e.target.value));persist();render()});
 el("mkpPlanSearch").addEventListener("input",e=>{state.search=e.target.value;render()});

 function setSourceMode(next){
  sourceMode=next==="excel"?"excel":"manual";
  el("mkpPlanManualActions").hidden=sourceMode!=="manual";
  el("mkpPlanManualForm").hidden=sourceMode!=="manual";
  el("mkpPlanImportActions").hidden=sourceMode!=="excel";
  dialog.querySelectorAll("[data-source-mode]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.sourceMode===sourceMode)));
 }
 dialog.querySelectorAll("[data-source-mode]").forEach(b=>b.addEventListener("click",()=>setSourceMode(b.dataset.sourceMode)));
 const previewSignatureOf=()=>[state.year,importFile?.name,importFile?.size,el("mkpPlanSheet").value,el("mkpPlanStartRow").value,el("mkpPlanEndRow").value].join("|");
 function invalidatePreview(){
  previewRows=null;previewSignature="";el("mkpPlanImportNow").disabled=true;
 }
 for(const id of ["mkpPlanSheet","mkpPlanStartRow","mkpPlanEndRow"]){
  el(id).addEventListener("change",invalidatePreview);
 }
 el("mkpPlanImport").addEventListener("change",async e=>{
  importFile=e.target.files?.[0]||null;
  invalidatePreview();
  const sheet=el("mkpPlanSheet"),detail=el("mkpPlanPreview");
  sheet.innerHTML="";sheet.disabled=true;
  if(!importFile){detail.textContent="Belum ada berkas terpilih.";return}
  detail.textContent="Memeriksa isi workbook...";
  try{
   if(/\.xlsx$/i.test(importFile.name)){
    const names=await xlsxSheets(importFile);
    sheet.innerHTML=names.map(name=>'<option value="'+html(name)+'">'+html(name)+'</option>').join("");
    sheet.disabled=false;sheet.value=names.includes(String(state.year))?String(state.year):names[0];
    const info=await xlsxSheetInfo(importFile,sheet.value);
    el("mkpPlanStartRow").value=String(info.firstRow||3);
    el("mkpPlanEndRow").value=String(info.lastRow||info.firstRow||3);
    detail.textContent="Sheet tersedia: "+names.join(", ")+".\nPilihan awal: "+sheet.value+" · baris "+(info.firstRow||"?")+"–"+(info.lastRow||"?")+". Periksa rentang sebelum impor.";
   }else if(/\.(csv|tsv)$/i.test(importFile.name)){
    sheet.innerHTML='<option value="CSV">CSV / TSV (satu sheet)</option>';sheet.disabled=true;
    const rows=csvRows(await importFile.text());rows.forEach((r,i)=>r.rowNumber=i+1);
    const info=rangeBounds(rows);
    el("mkpPlanStartRow").value=String(info.firstRow||2);
    el("mkpPlanEndRow").value=String(info.lastRow||info.firstRow||2);
    detail.textContent="CSV / TSV · baris "+(info.firstRow||"?")+"–"+(info.lastRow||"?")+".";
   }else throw Error("Pilih file Excel .xlsx atau .csv/.tsv.");
  }catch(error){detail.textContent="Tidak dapat membaca file: "+String(error?.message||error);importFile=null}
 });
 el("mkpPlanSheet").addEventListener("change",async()=>{
  if(!importFile||!/\.xlsx$/i.test(importFile.name))return;
  const info=await xlsxSheetInfo(importFile,el("mkpPlanSheet").value);
  el("mkpPlanStartRow").value=String(info.firstRow||3);
  el("mkpPlanEndRow").value=String(info.lastRow||info.firstRow||3);
  el("mkpPlanPreview").textContent="Sheet "+el("mkpPlanSheet").value+" dipilih. Pilih rentang baris, lalu klik Pratinjau.";
 });
 el("mkpPlanCheck").addEventListener("click",async()=>{
  if(!importFile)return note("Pilih file Excel atau CSV terlebih dahulu.",true);
  invalidatePreview();
  const preview=el("mkpPlanPreview");preview.textContent="Membaca rentang data...";
  try{
   const opts={sheetName:el("mkpPlanSheet").value,startRow:Number(el("mkpPlanStartRow").value),endRow:Number(el("mkpPlanEndRow").value)};
   const rows=/\.xlsx$/i.test(importFile.name)?await xlsxRows(importFile,state.year,opts):
    csvImportRows(await importFile.text(),state.year,opts);
   previewRows=rows;previewSignature=previewSignatureOf();
   const groups=new Set(rows.map(x=>x.group));
   const samples=rows.slice(0,3).map(x=>x.source+" · "+x.group+" · "+x.description).join("\n");
   preview.textContent="Ditemukan "+fmt(rows.length)+" uraian pada "+fmt(groups.size)+" kelompok fungsi.\nContoh:\n"+samples+
    "\n\nLanjutkan dengan Impor Data Terpilih. Periksa kolom A–J dan audit perhitungan setelah impor.";
   el("mkpPlanImportNow").disabled=false;
  }catch(error){preview.textContent="Pratinjau gagal: "+String(error?.message||error);note("Periksa nama sheet, header dan batas baris Excel.",true)}
 });
 el("mkpPlanImportNow").addEventListener("click",()=>{
  if(!previewRows||previewSignature!==previewSignatureOf())return note("Ulangi Pratinjau Rentang sebelum impor.",true);
  const mode=el("mkpPlanMerge").value,items=previewRows;
  const duplicates=new Set(state.items.map(x=>JSON.stringify([x.group,x.activity,x.description,x.unit].map(v=>String(v||"").toLocaleLowerCase("id").trim()))));
  const newRows=mode==="append"?items.filter(x=>!duplicates.has(JSON.stringify([x.group,x.activity,x.description,x.unit].map(v=>String(v||"").toLocaleLowerCase("id").trim())))):items;
  const prompt="Impor "+fmt(newRows.length)+" uraian ke tahun "+state.year+" dari sheet "+el("mkpPlanSheet").value+
   " baris "+el("mkpPlanStartRow").value+"–"+el("mkpPlanEndRow").value+
   (mode==="replace"?"? Inventarisasi yang tersimpan pada tahun ini akan diganti.":"? Data yang sudah ada akan dipertahankan.");
  if(!win.confirm(prompt))return;
  state.items=mode==="append"?state.items.concat(newRows.map((x,i)=>({...x,id:x.id+"-IMPORT-"+Date.now()+"-"+i}))):items;
  if(mode==="replace")state.names={};
  persist();render();
  el("mkpPlanPreview").textContent="Impor berhasil: "+fmt(newRows.length)+" uraian. Data tersimpan lokal pada browser ini.";
  invalidatePreview();
 });
 el("mkpPlanPrevious").addEventListener("click",()=>{
  if(state.year<=2026)return note("Tahun 2026 sudah menjadi sumber referensi awal.",true);
  let prev;try{prev=JSON.parse(win.localStorage.getItem(key(state.year-1))||"null")}catch{}
  const rows=prev?.items||(state.year===2027?base:[]);
  if(!rows.length)return note("Belum ada kegiatan dari tahun "+(state.year-1)+". Lengkapi terlebih dahulu atau input manual.",true);
  if(!win.confirm("Gunakan "+fmt(rows.length)+" uraian dari "+(state.year-1)+" sebagai draf "+state.year+
    "? Seluruh pembagian Organik/Mitra akan dikosongkan untuk ditinjau ulang, dan data pemetaan tahun ini akan diganti."))return;
  state.items=previousYearDraft(rows,state.year);state.names={};persist();render();
  note("Daftar tahun lalu telah disalin sebagai draf "+state.year+". Edit volume, standar waktu, dan Jam Organik/Mitra sebelum menetapkan kebutuhan tim.");
 });
 el("mkpPlanClear").addEventListener("click",()=>{
  if(!win.confirm("Mulai inventarisasi "+state.year+" dari kosong? Semua rincian yang disimpan lokal untuk tahun tersebut akan dihapus."))return;
  state.items=[];state.names={};persist();render();note("Inventarisasi kosong. Silakan input kegiatan dan uraian secara manual.");
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
 load(Math.max(2026,Math.min(2031,selectedYear)));render();setSourceMode("manual");
}
