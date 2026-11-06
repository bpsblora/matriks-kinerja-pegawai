"use strict";
/*
 * Matrix cloud backend — deliberately disabled until approved for Blaze + data location.
 * All writes go through callable Functions and are audited server-side.
 * Firestore client rules stay deny-all (so no direct browser bypass).
 */
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {getFirestore,FieldValue,FieldPath}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
const S=require("./matrixSchema");
const db=()=>getFirestore();
const opt={region:"us-central1",memory:"256MiB",timeoutSeconds:60,maxInstances:5};
const respond=(code,msg)=>{throw new HttpsError(code,msg);};
const isAdmin=a=>a.role==="admin";
const isHead=a=>a.role==="kepala";
const own=(a,t)=>isAdmin(a)||isHead(a)||a.teamIds.includes(t);

function enabled(){
 if(process.env.MATRIX_BACKEND_ENABLED!=="true")
  respond("failed-precondition","Database Matriks masih terkunci sampai persetujuan TI, penempatan data, dan pengujian keamanan.");
}
async function actor(req){
 enabled();
 if(!req.auth||req.auth.token?.firebase?.sign_in_provider!=="custom")respond("permission-denied","Login menggunakan akun peran.");
 const uid=req.auth.uid;
 const [profile,authUser]=await Promise.all([
  db().collection("users").doc(uid).get(),
  getAuth().getUser(uid).catch(()=>null)
 ]);
 const p=profile.exists?profile.data():null;
 if(!authUser||authUser.disabled||!p||p.active!==true||p.accessAccount!==true
   ||!["admin","ketua_tim","kepala"].includes(p.role))
   respond("permission-denied","Akun belum aktif atau peran tidak sesuai.");
 return {uid,role:p.role,username:p.username,teamIds:Array.isArray(p.teamIds)?p.teamIds:[]};
}
function typeAndYear(req){
 let year;
 try{year=S.year(req.data?.year);}catch(e){respond("invalid-argument",e.message);}
 const kind=req.data?.kind;
 if(!S.TYPES.includes(kind))respond("invalid-argument","Jenis data tidak dikenal.");
 return {year,kind};
}
const yr=(year)=>db().collection("matrixYears").doc(year);
const items=(year,kind)=>yr(year).collection(kind);
const auditRef=()=>db().collection("matrixAudit").doc();
function isAllowedToSee(a,kind,row,id){
 return S.accessible(a.role,a.teamIds,kind,{...row,id});
}
function safeFields(kind,row,id) {
 const record={id};
 for(const f of S.FIELDS[kind])if(Object.prototype.hasOwnProperty.call(row,f))record[f]=row[f];
 if(row.updatedAt?.toDate)record.updatedAt=row.updatedAt.toDate().toISOString();
 return record;
}
exports.listMatrixRecords=onCall(opt,async req=>{
 const a=await actor(req),{year,kind}=typeAndYear(req);
 const pageSize=Math.min(250,Math.max(1,Number(req.data?.pageSize)||150));
 const cursor=req.data?.cursor;
 if(cursor!==undefined&&(typeof cursor!=="string"||!S.DOC_ID.test(cursor)))respond("invalid-argument","Cursor tidak valid.");
 let query=items(year,kind).orderBy(FieldPath.documentId()).limit(pageSize);
 if(cursor)query=query.startAfter(cursor);
 const snap=await query.get();
 const records=snap.docs.filter(doc=>isAllowedToSee(a,kind,doc.data(),doc.id))
  .map(doc=>safeFields(kind,doc.data(),doc.id));
 return {records,nextCursor:snap.size===pageSize?snap.docs[snap.docs.length-1].id:null,year,kind};
});

exports.getMatrixYearState=onCall(opt,async req=>{
 const a=await actor(req);let y;
 try{y=S.year(req.data?.year);}catch(e){respond("invalid-argument",e.message);}
 const snap=await yr(y).get();
 const item=snap.exists?snap.data():{};
 return {year:y,status:item.status||"draft",finalizedAt:item.finalizedAt?.toDate?.()?.toISOString?.()||null,
  finalizedBy:item.finalizedBy||null,role:a.role,teamIds:a.teamIds};
});

exports.mutateMatrixRecord=onCall(opt,async req=>{
 const a=await actor(req),{year,kind}=typeAndYear(req);
 const op=req.data?.operation,id=req.data?.id;
 if(!["create","update","delete"].includes(op))respond("invalid-argument","Aksi tidak sesuai.");
 if(typeof id!=="string"||!S.DOC_ID.test(id))respond("invalid-argument","ID tidak valid.");
 let patch={};
 if(op!=="delete")try{patch=S.validateRecord(kind,id,req.data?.record);}catch(e){respond("invalid-argument",e.message);}
 const target=items(year,kind).doc(id),audit=auditRef(),yearRef=yr(year);
 return db().runTransaction(async tx=>{
   const [yearSnap,prior]=await Promise.all([tx.get(yearRef),tx.get(target)]);
   const state=yearSnap.exists?yearSnap.data():null;
   if(!state)respond("failed-precondition","Tahun belum disiapkan Admin.");
   if(state.status==="finalized")respond("failed-precondition","Tahun telah difinalisasi Kepala BPS.");
   const before=prior.exists?prior.data():null;
   if(op==="create"&&before)respond("already-exists","ID sudah digunakan.");
   if(op!=="create"&&!before)respond("not-found","Data tidak ditemukan.");
   const combined={...(before||{}),...patch};
   const targetTeam=kind==="teams"?id:combined.teamId;
   if(!S.canManage(a.role,a.teamIds,kind,targetTeam))
     respond("permission-denied","Peran/tim tidak memiliki izin mengubah data ini.");
   if(before?.teamId&&patch.teamId&&before.teamId!==patch.teamId)
     respond("permission-denied","Perpindahan data antar-tim perlu proses Admin khusus.");
   if(kind==="kros"&&patch.code&&patch.code!==id)
     respond("invalid-argument","Kode KRO harus sama dengan ID.");
   if(kind==="allocations"){
     if(!S.validateRecord(kind,id,combined))respond("invalid-argument","Alokasi tidak valid.");
     const act=await tx.get(items(year,"activities").doc(combined.activityId));
     if(!act.exists||act.data().teamId!==combined.teamId)
       respond("failed-precondition","Kegiatan bukan milik tim yang dipilih.");
     const employee=await tx.get(items(year,"employees").doc(combined.employeeId));
     if(!employee.exists||employee.data().active===false)
       respond("failed-precondition","Pegawai tidak aktif atau belum terdaftar.");
   }
   if(kind==="schedules"&&combined.startDate&&combined.endDate&&combined.startDate>combined.endDate)
     respond("invalid-argument","Tanggal mulai tidak boleh lebih besar dari tanggal selesai.");
   if(kind==="workflow"&&a.role==="ketua_tim"&&!["draft","submitted","revision"].includes(combined.status))
     respond("permission-denied","Ketua Tim tidak dapat menetapkan persetujuan/finalisasi.");
   const timestamp=FieldValue.serverTimestamp();
   if(op==="delete")tx.delete(target);
   else tx.set(target,{...patch,updatedAt:timestamp,updatedBy:a.uid,...(op==="create"?{createdAt:timestamp,createdBy:a.uid}:{})},{merge:op==="update"});
   tx.create(audit,{year,kind,recordId:id,action:op,actorUid:a.uid,actorRole:a.role,teamId:targetTeam||null,
    at:timestamp,changedFields:op==="delete"?[]:Object.keys(patch)});
   return {success:true,id,operation:op};
 });
});

exports.saveActivityAllocations=onCall(opt,async req=>{
 const a=await actor(req);let year;
 try{year=S.year(req.data?.year);}catch(e){respond("invalid-argument",e.message);}
 const activityId=req.data?.activityId,month=Number(req.data?.month),hours=Number(req.data?.hours),
   volume=Number(req.data?.volume??1),teamId=req.data?.teamId,ids=req.data?.employeeIds;
 if(typeof activityId!=="string"||!S.DOC_ID.test(activityId)||!S.TEAM.test(teamId)
    ||!Number.isInteger(month)||month<1||month>12||!Number.isFinite(hours)||hours<0||hours>1000
    ||!Number.isFinite(volume)||volume<0||!Array.isArray(ids)||ids.length<1||ids.length>40
    ||new Set(ids).size!==ids.length||!ids.every(id=>S.EMPLOYEE.test(id)))
    respond("invalid-argument","Alokasi/bulan/daftar pegawai tidak sesuai.");
 if(!S.canManage(a.role,a.teamIds,"allocations",teamId))
    respond("permission-denied","Tidak dapat mengalokasikan untuk tim ini.");
 const refs=ids.map(employeeId=>items(year,"allocations").doc(S.allocationId(activityId,employeeId,month)));
 return db().runTransaction(async tx=>{
  const meta=await tx.get(yr(year));
  if(!meta.exists||meta.data().status==="finalized")respond("failed-precondition","Tahun belum siap atau terkunci.");
  const act=await tx.get(items(year,"activities").doc(activityId));
  if(!act.exists||act.data().teamId!==teamId)respond("failed-precondition","Uraian bukan milik tim tersebut.");
  const employees=await Promise.all(ids.map(id=>tx.get(items(year,"employees").doc(id))));
  if(employees.some(e=>!e.exists||e.data().active===false))respond("failed-precondition","Ada pegawai yang belum aktif.");
  const existing=await Promise.all(refs.map(ref=>tx.get(ref)));
  const stamp=FieldValue.serverTimestamp();
  refs.forEach((ref,i)=>{
    tx.set(ref,{activityId,employeeId:ids[i],teamId,month,hours,volume,
      updatedBy:a.uid,updatedAt:stamp,
      ...(existing[i].exists?{}:{createdAt:stamp,createdBy:a.uid})},{merge:true});
  });
  tx.create(auditRef(),{year,kind:"allocations",recordId:activityId,action:"batch.allocate",actorUid:a.uid,
     teamId,month,participants:ids.length,individualHours:hours,at:stamp});
  return {success:true,participants:ids.length,individualHours:hours};
 });
});

exports.changeMatrixYearStatus=onCall(opt,async req=>{
 const a=await actor(req);let year;
 try{year=S.year(req.data?.year);}catch(e){respond("invalid-argument",e.message);}
 const next=req.data?.status;
 if(!["draft","approved","finalized"].includes(next))respond("invalid-argument","Status tidak sesuai.");
 if(!isHead(a))respond("permission-denied","Hanya Kepala BPS yang dapat menetapkan status tahun.");
 if(next==="finalized"&&req.data?.acknowledgeIncomplete!==true)
   respond("failed-precondition","Periksa rekonsiliasi terlebih dahulu dan konfirmasi finalisasi.");
 const ref=yr(year);
 return db().runTransaction(async tx=>{
   const before=await tx.get(ref);
   if(!before.exists)respond("not-found","Tahun belum disiapkan.");
   const current=before.data().status||"draft";
   if(current==="finalized"&&next!=="finalized")respond("failed-precondition","Pembukaan kembali tahun perlu prosedur audit khusus.");
   if(current===next)return {success:true,status:next,unchanged:true};
   const stamp=FieldValue.serverTimestamp();
   tx.update(ref,{status:next,updatedAt:stamp,updatedBy:a.uid,
     ...(next==="finalized"?{finalizedAt:stamp,finalizedBy:a.uid}:{})});
   tx.create(auditRef(),{year,kind:"year",action:"year."+next,actorUid:a.uid,actorRole:a.role,at:stamp});
   return {success:true,status:next};
 });
});

exports.initMatrixYear=onCall(opt,async req=>{
 const a=await actor(req);let year;
 try{year=S.year(req.data?.year);}catch(e){respond("invalid-argument",e.message);}
 if(!isAdmin(a))respond("permission-denied","Hanya Admin yang dapat menyiapkan tahun.");
 const ref=yr(year);
 const current=await ref.get();
 if(current.exists)return {success:true,status:current.data().status||"draft",created:false};
 await ref.create({year:Number(year),status:"draft",createdBy:a.uid,createdAt:FieldValue.serverTimestamp()});
 return {success:true,status:"draft",created:true};
});

exports.listMatrixAudit=onCall(opt,async req=>{
 const a=await actor(req);
 if(!isAdmin(a)&&!isHead(a))respond("permission-denied","Riwayat detail hanya untuk Admin/Kepala.");
 let y;try{y=S.year(req.data?.year);}catch(e){respond("invalid-argument",e.message);}
 const snap=await db().collection("matrixAudit").orderBy("at","desc").limit(250).get();
 return {events:snap.docs.filter(d=>d.data().year===y).map(d=>({
  id:d.id,action:d.data().action,kind:d.data().kind,recordId:d.data().recordId,
  actorRole:d.data().actorRole,at:d.data().at?.toDate?.()?.toISOString?.()||null
 }))};
});
