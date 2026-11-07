#!/usr/bin/env node
/**
 * Staging of year-2027 KRO and suggested 2026 team matches.
 * Never imports budget amounts, payroll, passwords, or employee identities.
 * DRY RUN by default. Never writes to the US DEV project.
 * Usage:
 *   node scripts/import-kro-2027.mjs "/secure/Matriks...v2_6.html" --project APPROVED_PRIVATE_PROJECT
 *   MATRIX_IMPORT_APPROVAL=YES_TI_APPROVED_PRIVATE_PROD node scripts/import-kro-2027.mjs "...html" --project APPROVED_PRIVATE_PROJECT --write
 */
import fs from "node:fs";
import {createRequire} from "node:module";
const args=process.argv.slice(2);
const file=args.find(x=>x.toLowerCase().endsWith(".html"));
const index=args.indexOf("--project");
const project=index<0?null:args[index+1];
const write=args.includes("--write");
if(!file||!project||project.startsWith("--")) {
 console.error("Penggunaan: node scripts/import-kro-2027.mjs FILE_V25.html --project PROD_ID [--write]");
 process.exit(2);
}
if(project==="mkp-bps-blora")throw Error("Proyek DEV nam5 ditolak untuk impor data kantor.");
if(write&&process.env.MATRIX_IMPORT_APPROVAL!=="YES_TI_APPROVED_PRIVATE_PROD")
 throw Error("Persetujuan TI untuk project/lokasi/biaya belum dikonfirmasi.");
const html=fs.readFileSync(file,"utf8");
function readSeed(id){
 const re=new RegExp('<script\\b[^>]*\\bid=["\\\']'+id+'["\\\'][^>]*>([\\s\\S]*?)<\\/script>',"i");
 const match=html.match(re);if(!match)throw Error("Seed "+id+" tidak ditemukan.");
 return JSON.parse(match[1]);
}
const source=readSeed("kro2027Seed");
if(source.year!==2027||!Array.isArray(source.kros)||source.kros.length<25)throw Error("Sumber KRO 2027 tidak sesuai.");
const rows=source.kros.map(k=>{
 if(typeof k.code!=="string"||!/^\\d{4}\\.[A-Z0-9]+\\.\\d{3,4}$/.test(k.code)||typeof k.name!=="string"||!k.name.trim())
   throw Error("Ada KRO dengan kode atau nama tidak valid.");
 const suggestedTeamIds=[...new Set((k.mappings||[]).map(m=>m.team_id).filter(id=>/^T\\d{3}$/.test(id)))];
 return [k.code,{code:k.code,name:k.name.trim(),teamIds:[],suggestedTeamIds,active:true,
  notes:"Usulan berdasarkan penugasan 2026. Tim pengampu 2027 wajib dipilih dan ditetapkan ulang."}];
});
if(new Set(rows.map(([id])=>id)).size!==rows.length)throw Error("Kode KRO 2027 duplikat.");
console.log("VALIDASI 2027 LULUS; KRO:",rows.length);
console.log("Saran tim 2026 tersedia:",rows.filter(([,k])=>k.suggestedTeamIds.length).length);
console.log("Penetapan KRO ke tim 2027 masih KOSONG dan harus dikonfirmasi Admin.");
if(!write){console.log("DRY RUN: tidak menulis ke Firebase.");process.exit(0);}
const require=createRequire(new URL("../functions/package.json",import.meta.url));
const {initializeApp,applicationDefault,getApps}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:project});
const db=getFirestore();
const year=db.collection("matrixYears").doc("2027");
const current=await year.get();
if(!current.exists||current.data().status!=="draft")
  throw Error("Admin perlu membuat tahun 2027 dalam status draft sebelum impor KRO.");
const existing=await year.collection("kros").limit(1).get();
if(!existing.empty)throw Error("KRO 2027 sudah ada. Tidak akan menimpa penetapan yang telah dibuat.");
const writer=db.bulkWriter();
for(const [code,record] of rows)writer.create(year.collection("kros").doc(code),{
 ...record,updatedAt:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp(),
 importedFrom:"V25 v2.6 KRO2027",requiresVerification:true
});
await writer.close();
console.log("KRO 2027 tersimpan; rekomendasi bukan penetapan dan tidak otomatis dicentang.");
