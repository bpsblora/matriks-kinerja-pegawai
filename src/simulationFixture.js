// Isolated, fictional end-to-end fixture for the V25/v26 prototype.
// No Firestore writes. The prototype stays entirely in browser-local data.
export const SIM_PREFIX="mkp-simulasi-v1:";

const teams=[
 {id:"T901",name:"SIM · Statistik Sosial"},
 {id:"T902",name:"SIM · Statistik Produksi"},
 {id:"T903",name:"SIM · Neraca dan Analisis"}
];
const people=[
 ["E901","Andi Pratama"],["E902","Budi Santoso"],["E903","Citra Maharani"],
 ["E904","Dini Lestari"],["E905","Eko Saputra"],["E906","Fitri Amelia"],
 ["E907","Galih Nugroho"],["E908","Hana Putri"],["E909","Indra Wijaya"],
 ["E910","Joko Firmansyah"]
].map(([id,full_name])=>({id,full_name,type:"pegawai",active:true}));
const roster={
 T901:{leaderId:"E901",leaderName:"Andi Pratama",members:["E904","E905","E909"]},
 T902:{leaderId:"E902",leaderName:"Budi Santoso",members:["E905","E906","E907"]},
 T903:{leaderId:"E903",leaderName:"Citra Maharani",members:["E907","E908","E909"]}
};
// Each allocation is a quantity, multiplied by standard_hours. Each date
// interval represents workday-level expectations; K02+K07 overload E904 on 4 Feb.
const cases=[
 {id:"SIM-K01",team:"T901",group:"Persiapan Susenas",desc:"Persiapan Susenas",std:4,mode:"terbagi",start:"2026-02-02",end:"2026-02-02",qty:{E901:1,E904:1},kro:"SIM.001"},
 {id:"SIM-K02",team:"T901",group:"Pemeriksaan Susenas",desc:"Pemeriksaan Susenas",std:6,mode:"terbagi",start:"2026-02-03",end:"2026-02-05",qty:{E904:3,E905:3},kro:"SIM.002"},
 {id:"SIM-K03",team:"T902",group:"Pendataan Industri",desc:"Pendataan Industri",std:5,mode:"terbagi",start:"2026-02-02",end:"2026-02-06",qty:{E902:5,E906:5},kro:"SIM.003"},
 {id:"SIM-K04",team:"T902",group:"Pemeriksaan Industri",desc:"Pemeriksaan Industri",std:4,mode:"terbagi",start:"2026-02-03",end:"2026-02-03",qty:{E905:1,E907:1},kro:"SIM.004"},
 {id:"SIM-K05",team:"T903",group:"Penyusunan PDRB",desc:"Penyusunan PDRB",std:6,mode:"terbagi",start:"2026-02-02",end:"2026-02-06",qty:{E903:5,E908:5,E909:5},kro:"SIM.005"},
 {id:"SIM-K06",team:"T903",group:"Rapat Evaluasi",desc:"Rapat Evaluasi",std:4,mode:"bersama",start:"2026-02-04",end:"2026-02-04",qty:{E901:1,E903:1,E907:1},kro:"SIM.006"},
 {id:"SIM-K07",team:"T901",group:"Validasi Data Sosial",desc:"Validasi Data Sosial",std:4,mode:"terbagi",start:"2026-02-04",end:"2026-02-04",qty:{E904:1,E909:1},kro:"SIM.002"},
 {id:"SIM-K08",team:"T902",group:"Evaluasi Lapangan",desc:"Evaluasi Lapangan",std:5,mode:"terbagi",start:"2026-02-09",end:"2026-02-11",qty:{E906:3,E910:3},kro:"SIM.004"}
];
const kros=[
 ["SIM.001","Persiapan Kegiatan Statistik Sosial","T901"],
 ["SIM.002","Pengolahan dan Pemeriksaan Statistik Sosial","T901"],
 ["SIM.003","Pendataan Statistik Produksi","T902"],
 ["SIM.004","Pengawasan Statistik Produksi","T902"],
 ["SIM.005","Penyusunan Neraca Regional","T903"],
 ["SIM.006","Koordinasi dan Evaluasi Neraca","T903"]
].map(([code,name,team_id])=>({
 code,name,source_row:0,details:[],
 mappings:[{team_id,confidence:"Data Simulasi",evidence:"Fixture pengujian, bukan KRO resmi"}],
 suggested_team_names:[],user_confirmed:true
}));

export const simulationSeed={
 meta:{year:2026,dataset:"SIMULASI MATRIKS PEGAWAI 2026",source_file:"Data Fiktif untuk Pengujian",status:"simulation_only"},
 teams,employees:people,
 activities:cases.map(c=>({
  id:c.id,team_id:c.team,team:teams.find(t=>t.id===c.team)?.name||c.team,
  group:c.group,description:c.desc,unit:c.mode==="bersama"?"Rapat":"Dokumen",
  standard_hours:c.std,
  annual_volume:c.mode==="bersama"?1:Object.values(c.qty).reduce((a,b)=>a+b,0),
  annual_hours_reported:Object.values(c.qty).reduce((a,b)=>a+b,0)*c.std,
  status:"aktif",calculation_mode:c.mode
 })),
 monthly_activity_source:cases.map(c=>[
  c.id,2,c.mode==="bersama"?1:Object.values(c.qty).reduce((a,b)=>a+b,0),
  c.mode==="bersama"?"Rapat":"Dokumen",c.std,Object.values(c.qty).reduce((a,b)=>a+b,0)*c.std
 ]),
 annual_allocations_source:cases.flatMap(c=>Object.entries(c.qty).map(([id,qty])=>[c.id,id,qty])),
 monthly_allocations_source:cases.flatMap(c=>Object.entries(c.qty).map(([id,qty])=>[c.id,id,2,qty]))
};
export const simulationKroSeed={
 year:2026,pok_source:"SIMULASI — bukan dokumen POK",matrix_source:"Data uji fiktif",
 official_roster_source:"Simulasi struktur 3 tim",kros,
 official_roster:roster,extra_teams_in_roster:[],excluded_codes:[],
 mapping_source_file:"Skenario uji internal"
};
export const simulationKro2027Seed={
 year:2027,pok_source:"SIMULASI — kode KRO sementara",
 mapping_reference:"Rekomendasi 2026; wajib ditetapkan kembali untuk 2027",
 kros:kros.map(k=>({...k,mapping_status:"Simulasi acuan 2026 — belum ditetapkan"}))
};
const groupKroOverrides=Object.fromEntries(cases.map(c=>[JSON.stringify([c.team,c.group]),c.kro]));
const schedules=Object.fromEntries(cases.map(c=>[
 c.id+"|2",{
  start:c.start,end:c.end,note:"Data simulasi untuk pengujian alokasi.",
  updatedAt:"2026-02-01T00:00:00.000Z",updatedBy:"SIMULASI",anchor:2,isRange:false,
  share:1,originalTarget:c.mode==="bersama"?1:Object.values(c.qty).reduce((a,b)=>a+b,0),
  originalStandard:c.std,originalAmounts:c.qty,selectedIds:Object.keys(c.qty)
 }
]));
export const simulationOverlay={
 activityEdits:{},added:[],allocEdits:{},monthlyStdEdits:{},targets:{},
 days:21,dailyHours:8,log:[],masterEdits:{},scheduleEdits:schedules,
 workflowPlans:{},groupKroOverrides,pokBudgetRevisions:{},customStandards:[]
};

function replaceSeed(html,id,payload){
 const open='<script id="'+id+'" type="application/json">';
 const start=html.indexOf(open);
 if(start<0)throw Error("Bibit simulasi "+id+" tidak ditemukan.");
 const pos=start+open.length,end=html.indexOf("</script>",pos);
 if(end<0)throw Error("Bibit simulasi "+id+" tidak lengkap.");
 return html.slice(0,pos)+JSON.stringify(payload)+html.slice(end);
}
export function simulationMarkup(original){
 let html=replaceSeed(original,"seed",simulationSeed);
 html=replaceSeed(html,"kroSeed",simulationKroSeed);
 html=replaceSeed(html,"kro2027Seed",simulationKro2027Seed);
 // Patch Storage inside THIS iframe realm only, before prototype scripts run.
 // Normal website data retain their original unprefixed keys and are untouched.
 const bootstrap=JSON.stringify({
  "bps-blora-matriks-selected-year-v14":"2026",
  "bps-blora-matriks-pegawai-2026-prototype-v13":JSON.stringify(simulationOverlay)
 });
 const shim=`<script>
 (function(){
  const prefix=${JSON.stringify(SIM_PREFIX)},defaults=${bootstrap};
  const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
  const remove=Storage.prototype.removeItem,rawKey=Storage.prototype.key;
  for(const [k,v] of Object.entries(defaults)){
   if(get.call(window.localStorage,prefix+k)===null)set.call(window.localStorage,prefix+k,v);
  }
  Storage.prototype.getItem=function(k){return get.call(this,this===window.localStorage?prefix+String(k):k)};
  Storage.prototype.setItem=function(k,v){return set.call(this,this===window.localStorage?prefix+String(k):k,v)};
  Storage.prototype.removeItem=function(k){return remove.call(this,this===window.localStorage?prefix+String(k):k)};
  Storage.prototype.clear=function(){
   if(this!==window.localStorage)return;
   const names=[];
   for(let i=0;i<this.length;i++){const k=rawKey.call(this,i);if(k&&k.startsWith(prefix))names.push(k);}
   names.forEach(k=>remove.call(this,k));
  };
  window.__mkpSimulation=true;
 })();
 </`+"script>";
 if(!html.includes("</head>"))throw Error("Header simulasi tidak ditemukan.");
 return html.replace("</head>",shim+"</head>");
}
export function clearSimulationData(storage){
 const keys=[];
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i);
  if(key&&key.startsWith(SIM_PREFIX))keys.push(key);
 }
 keys.forEach(key=>storage.removeItem(key));
 return keys.length;
}
