/* Firestore Emulator role-security tests for Firebase Spark.
 * Tests run against the LOCAL emulator, never against a real BPS database.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initializeTestEnvironment,assertFails,assertSucceeds} from "@firebase/rules-unit-testing";
import {
 doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp
} from "firebase/firestore";

const viewer="AYyTDvPFAWdyjD9WRADKwIRP4in2";
const adminUid="dev_admin_id";
const oldUid="dev_katim_old";
const newUid="dev_katim_new";
const xEmail="a".repeat(24)+"@roles.mkp-bps-blora.invalid";
const yEmail="b".repeat(24)+"@roles.mkp-bps-blora.invalid";
const projectId="demo-matriks-spark";
const env=await initializeTestEnvironment({
 projectId,
 firestore:{host:"127.0.0.1",port:8080,rules:readFileSync("firestore.spark.rules","utf8")}
});
function ctx(uid,email,provider="password",verified=false){
 return env.authenticatedContext(uid,{
  email,email_verified:verified,
  firebase:{sign_in_provider:provider}
 }).firestore();
}
const admin=ctx(adminUid,"admin@roles.mkp-bps-blora.invalid");
const viewerDb=ctx(viewer,"office@bps.go.id","google.com",true);
const stranger=ctx("google_other","other@bps.go.id","google.com",true);
const katim=ctx(oldUid,xEmail);
const profile=(uid,username,email,active=true)=>({
 username,loginEmail:email,role:"ketua_tim",teamIds:["T001"],active,
 createdBy:adminUid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()
});
const handle=(uid,email)=>({
 uid,authEmail:email,createdBy:adminUid,
 createdAt:serverTimestamp(),updatedAt:serverTimestamp()
});
const p=(db,uid)=>doc(db,"sparkRoleProfiles",uid);
const h=(db,name)=>doc(db,"sparkRoleHandles",name);
try{
 await env.withSecurityRulesDisabled(async context=>{
  await setDoc(p(context.firestore(),adminUid),{
   username:"admin",role:"admin",active:true,teamIds:[],
   createdBy:"trusted-firebase-console",createdAt:serverTimestamp()
  });
 });
 // Office Google may resolve a username, but cannot list Admin accounts.
 await assertFails(getDocs(collection(viewerDb,"sparkRoleProfiles")));
 await assertFails(getDocs(collection(stranger,"sparkRoleHandles")));
 await assertFails(getDoc(h(stranger,"katim_ppid")));
 await assertFails(setDoc(p(stranger,"fake_admin"),{
  username:"admin",role:"admin",active:true,teamIds:[]}));
 await assertSucceeds(getDocs(collection(admin,"sparkRoleProfiles")));
 // A normal viewer or Ketua Tim must never grant their own Admin privileges.
 await assertFails(updateDoc(p(admin,adminUid),{role:"ketua_tim"}));
 await assertFails(setDoc(h(stranger,"katim_harga"),{
  uid:"malicious",authEmail:"0123456789abcdef01234567@roles.mkp-bps-blora.invalid"
 }));

 // Admin MUST create an Auth-backed profile and its handle atomically.
 await assertFails(setDoc(p(admin,oldUid),profile(oldUid,"katim_ppid",xEmail)));
 const creation=writeBatch(admin);
 creation.set(p(admin,oldUid),profile(oldUid,"katim_ppid",xEmail));
 creation.set(h(admin,"katim_ppid"),handle(oldUid,xEmail));
 await assertSucceeds(creation.commit());
 const firstHandle=await assertSucceeds(getDoc(h(viewerDb,"katim_ppid")));
 assert.equal(firstHandle.data().authEmail,xEmail);
 await assertSucceeds(getDoc(p(katim,oldUid)));
 await assertFails(getDocs(collection(katim,"sparkRoleProfiles")));
 await assertFails(updateDoc(p(katim,oldUid),{role:"admin"}));

 // Renaming a username requires updating the profile and both mappings
 // in one batch; old username cannot remain a valid login.
 await assertFails(updateDoc(p(admin,oldUid),{username:"katim_keuangan"}));
 const rename=writeBatch(admin);
 rename.set(h(admin,"katim_keuangan"),handle(oldUid,xEmail));
 rename.delete(h(admin,"katim_ppid"));
 rename.update(p(admin,oldUid),{username:"katim_keuangan",updatedAt:serverTimestamp()});
 await assertSucceeds(rename.commit());
 assert.equal((await assertSucceeds(getDoc(h(viewerDb,"katim_ppid")))).exists(),false);
 assert.equal((await assertSucceeds(getDoc(h(viewerDb,"katim_keuangan")))).data().uid,oldUid);

 // A password reset rotates the underlying auth UID, keeps the username,
 // and revokes the old profile with the SAME atomic commit.
 const rotation=writeBatch(admin);
 rotation.set(p(admin,newUid),profile(newUid,"katim_keuangan",yEmail));
 rotation.update(h(admin,"katim_keuangan"),{
  uid:newUid,authEmail:yEmail,updatedAt:serverTimestamp()
 });
 rotation.update(p(admin,oldUid),{active:false,updatedAt:serverTimestamp()});
 await assertSucceeds(rotation.commit());
 assert.equal((await assertSucceeds(getDoc(h(viewerDb,"katim_keuangan")))).data().uid,newUid);
 assert.equal((await assertSucceeds(getDoc(p(katim,oldUid)))).data().active,false);
 await assertFails(getDocs(collection(katim,"sparkRoleProfiles")));
 await assertFails(deleteDoc(h(admin,"katim_keuangan")));

 // No one gets matrix permission because they know a role password.
 await assertFails(getDoc(doc(admin,"matrixYears","2026")));
 await assertFails(setDoc(doc(admin,"matrixYears","2026"),{status:"open"}));
 await assertFails(getDoc(doc(viewerDb,"matrixYears","2026")));
 console.log("Spark Firestore Rules: Admin create, rename, reset and revoke checks PASS");
}finally{
 await env.cleanup();
}
