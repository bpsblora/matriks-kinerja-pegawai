#!/usr/bin/env node
/**
 * Import complete V25 v2.6 year 2026 snapshot into a PRIVATE production
 * Firestore project after TI approval. Data never goes to the public bundle.
 *
 * Default = DRY RUN; NO WRITE without --write and approval phrase.
 * Refuses current US-based DEV Firebase project mkp-bps-blora.
 *
 * Run locally/Cloud Shell with the original HTML (not committed):
 * node scripts/import-legacy-2026.mjs "/secure/Matriks...v2_6.html" --project YOUR_APPROVED_PROD_PROJECT
 */
import fs from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(new URL("../functions/package.json",import.meta.url));
const {initializeApp,applicationDefault,getApps}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const args=process.argv.slice(2);
const file=args.find(x=>x.endsWith(".html"));
const project=args[args.indexOf("--project")+1];
const writes=args.includes("--write");
const confirm=process.env.MATRIX_IMPORT_APPROVAL==="YES_TI_APPROVED_PRIVATE_PROD";
if(!file||!project||project==="--write"){
 console.error("Usage: node scripts/import-legacy-2026.mjs /secure/V25_v2_6.html --project APPROVED_PROD_PROJECT [--write]");
 process.exit(2);
}
if(project==="mkp-bps-blora"){
 console.error("IMPOR DIBLOKIR: proyek DEV saat ini berada di nam5 (US), tidak untuk data pegawai asli.");
 process.exit(2);
}
if(writes&&!confirm){
 console.error("IMPOR DIBLOKIR: memerlukan persetujuan TI dan MATRIX_IMPORT_APPROVAL=YES_TI_APPROVED_PRIVATE_PROD.");
 process.exit(2);
}
const html=fs.readFileSync(file,"utf8");
function embedded(id){
 const match=new RegExp('<script\\s+id=["\\\']'+id+'["\\\'][^>]*>([\\s\\S]*?)<\\/script>',"i").exec(html);
 if(!match)throw Error("Sumber tidak memuat seed "+id);
 return JSON.parse(match[1]);
}
const seed=embedded("seed"),kro=embedded("kroSeed"),standards=embedded("standardSeed");
if(seed.meta?.year!==2026 || seed.activities.length<1400 || seed.employees.length!==40)
 throw Error("Sumber v2.6 tidak sesuai referensi 2026. Impor dibatalkan.");

const teams=new Map(seed.teams.map(t=>[t.id,{name:t.name}]));
const activities=new Map(seed.activities.map(a=>[a.id,a]));
const mappedKros=new Map();
for(const k of kro.kros)for(const mapping of k.mappings||[]){
 if(!mappedKros.has(mapping.team_id))mappedKros.set(mapping.team_id,[]);
 mappedKros.get(mapping.team_id).push(k.code);
}
const data={
 teams:seed.teams.map(t=>{
  const roster=kro.official_roster?.[t.id];
  return [t.id,{name:t.name,leaderId:roster?.leaderId||"",
    memberIds:[...new Set(roster?.members||[])],active:true}];
 }),
 employees:seed.employees.map(e=>[e.id,{name:e.full_name,active:e.active!==false,type:e.type||"pegawai"}]),
 kros:kro.kros.map(k=>[k.code,{code:k.code,name:k.name,active:true,
   teamIds:[...new Set((k.mappings||[]).map(m=>m.team_id).filter(id=>teams.has(id)))]}]),
 activities:seed.activities.map(a=>{
  const codes=[...new Set(mappedKros.get(a.team_id)||[])];
  return [a.id,{teamId:a.team_id,kroCode:codes.length===1?codes[0]:"",
   group:a.group||"Tanpa kelompok",description:a.description||"Tanpa uraian",
   unit:a.unit||"Kegiatan",standardHours:Math.max(0,Number(a.standard_hours)||0),
   annualVolume:Math.max(0,Number(a.annual_volume)||0),calculationMode:a.calculation_mode||"belum_ditentukan",
   active:a.status!=="nonaktif"}];
 }),
 annualAllocations:seed.annual_allocations_source.map(([activityId,employeeId,volume])=>{
  const a=activities.get(activityId);
  return [activityId+"__"+employeeId,{activityId,employeeId,teamId:a?.team_id||"",
   volume:Math.max(0,Number(volume)||0),hours:Math.max(0,Number(volume)||0)*Math.max(0,Number(a?.standard_hours)||0)}];
 }).filter(([,a])=>teams.has(a.teamId)),
 allocations:seed.monthly_allocations_source.map(([activityId,employeeId,month,volume])=>{
  const a=activities.get(activityId);
  return [activityId+"__"+employeeId+"__"+month,{activityId,employeeId,month:Number(month),
   teamId:a?.team_id||"",volume:Math.max(0,Number(volume)||0),
   hours:Math.max(0,Number(volume)||0)*Math.max(0,Number(a?.standard_hours)||0)}];
 }).filter(([,a])=>teams.has(a.teamId)),
 standards:standards.map(s=>[s.id,{group:s.group,name:s.name,hours:Number(s.hours)||0,unit:"jam",active:true}]),
 targets:seed.monthly_activity_source.filter(([activityId,month,volume])=>Number.isFinite(Number(volume))&&volume!==null)
  .map(([activityId,month,volume])=>{
   const a=activities.get(activityId);
   return [activityId+"__"+month,{activityId,teamId:a?.team_id||"",month:Number(month),volume:Number(volume)}];
  }).filter(([,t])=>teams.has(t.teamId))
};
console.log("DATA SOURCES (private, will NOT enter GitHub):");
for(const [kind,rows]of Object.entries(data))console.log(" ",kind+":",rows.length);
console.log("Catatan: jam alokasi hasil konversi volume × standar jam, perlu verifikasi rapat/satuan.");
console.log("KRO dengan beberapa kemungkinan tim belum dipaksakan sebagai penetapan.");
if(!writes){console.log("DRY RUN selesai, tidak ada data yang ditulis.");process.exit(0);}

if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:project});
const db=getFirestore();
const year=db.collection("matrixYears").doc("2026");
if((await year.get()).exists)throw Error("Tahun 2026 sudah ada di tujuan. Impor idempoten sengaja diblokir untuk mencegah overwrite.");
await year.create({year:2026,status:"draft",source:"V25 v2.6",approvedDataImport:true,
 createdAt:FieldValue.serverTimestamp(),sourceStatus:"memerlukan validasi satuan dan pemetaan KRO"});
for(const [kind,rows] of Object.entries(data)){
 const writer=db.bulkWriter();
 writer.onWriteError(err=>{console.error("Firestore write failed",kind,err.code);return err.failedAttempts<3;});
 for(const [id,record]of rows)writer.create(year.collection(kind).doc(id),{
  ...record,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),
  importedFrom:"Matriks 2026 V25 v2.6",requiresVerification:kind==="allocations"||kind==="annualAllocations"||kind==="activities"
 });
 await writer.close();
 console.log("Selesai impor",kind,rows.length);
}
console.log("Impor selesai ke proyek",project,". Data tetap memerlukan pemeriksaan operasional.");
