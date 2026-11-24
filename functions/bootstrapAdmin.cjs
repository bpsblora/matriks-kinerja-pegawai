#!/usr/bin/env node
"use strict";
/**
 * Bootstrap the FIRST Matrix Admin in an explicitly approved Firebase project.
 * Never uses a shared Gmail password. Run once from trusted Cloud Shell.
 * Password input is invisible; nothing is written to GitHub or log files.
 */
const {initializeApp,applicationDefault,getApps}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const bcrypt=require("bcryptjs");
const {normalizeUsername,credentialKey,passwordInputValid}=require("./security.js");

async function inputSecret(prompt) {
 if(!process.stdin.isTTY)throw Error("Gunakan terminal interaktif tepercaya, bukan pipeline.");
 const stdin=process.stdin;const wasRaw=stdin.isRaw;
 stdin.setRawMode(true);stdin.resume();process.stdout.write(prompt);
 return new Promise(resolve=>{
  let s="";
  function onData(chunk){
   for(const byte of chunk){
    if(byte===3){process.stdout.write("\nDibatalkan.\n");process.exit(130);}
    if(byte===13||byte===10){
     stdin.off("data",onData);stdin.setRawMode(Boolean(wasRaw));stdin.pause();
     process.stdout.write("\n");resolve(s);return;
    }
    if(byte===127||byte===8){s=s.slice(0,-1);continue;}
    if(byte>=32&&byte<=126)s+=String.fromCharCode(byte);
   }
  }
  stdin.on("data",onData);
 });
}
async function main(){
 const project=process.argv[2],username=normalizeUsername(process.argv[3]||"admin");
 if(!project||!username)throw Error("Penggunaan: node bootstrapAdmin.cjs PROJECT_ID [username]");
 if(process.env.MATRIX_BOOTSTRAP_APPROVED!=="YES")
  throw Error("Belum ada persetujuan bootstrap. Set MATRIX_BOOTSTRAP_APPROVED=YES setelah izin TI.");
 if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:project});
 const db=getFirestore(),auth=getAuth();
 const admins=await db.collection("users").where("role","==","admin").limit(3).get();
 if(admins.docs.some(d=>d.data().accessAccount===true))
  throw Error("Admin Matriks sudah tersedia; bootstrap pertama diblokir.");
 const key=credentialKey(username),ref=db.collection("authCredentials").doc(key);
 if((await ref.get()).exists)throw Error("Username sudah terdaftar.");
 const password=await inputSecret("Masukkan password Admin Matriks (12–72 byte): ");
 if(!passwordInputValid(password))throw Error("Password terlalu pendek/panjang.");
 const again=await inputSecret("Ulangi password: ");
 if(password!==again)throw Error("Password tidak sama.");
 const passwordHash=await bcrypt.hash(password,12);
 const record=await auth.createUser({displayName:"Matriks Admin "+username,disabled:false});
 try{
  const stamp=FieldValue.serverTimestamp();
  await db.runTransaction(async tx=>{
   if((await tx.get(ref)).exists)throw Error("Username sudah digunakan.");
   tx.create(ref,{uid:record.uid,passwordHash,disabled:false,createdAt:stamp,updatedAt:stamp});
   tx.create(db.collection("users").doc(record.uid),{
    username,role:"admin",active:true,accessAccount:true,teamIds:[],
    createdAt:stamp,updatedAt:stamp,createdBy:"bootstrap-trusted-operator"
   });
   tx.create(db.collection("auditLogs").doc(),{
    action:"account.bootstrap-admin",actorUid:"trusted-operator",targetUid:record.uid,at:stamp
   });
  });
 }catch(e){await auth.deleteUser(record.uid).catch(()=>{});throw e;}
 console.log("Admin pertama berhasil didaftarkan. Username:",username);
 console.log("Tidak ada password yang disimpan di repository atau ditampilkan di log.");
}
main().catch(e=>{console.error("Bootstrap tidak selesai:",e.message);process.exitCode=1;});
