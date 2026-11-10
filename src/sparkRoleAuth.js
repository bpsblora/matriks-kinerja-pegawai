/* Spark-only role login and Admin account administration.
 * Firebase Authentication Email/Password + Firestore Security Rules.
 * NO Cloud Functions, custom tokens, Admin SDK, service account, or billing.
 *
 * Username is deterministically converted to an internal Firebase Auth email.
 * The synthetic address is not an inbox. Forgotten-password recovery needs
 * account replacement by Admin; logged-in users can change their own password.
 */
import {initializeApp} from "firebase/app";
import {
 getAuth,signInWithEmailAndPassword,createUserWithEmailAndPassword,
 signOut,deleteUser,EmailAuthProvider,reauthenticateWithCredential,
 updatePassword
} from "firebase/auth";
import {
 getFirestore,collection,doc,getDoc,getDocs,setDoc,updateDoc,serverTimestamp
} from "firebase/firestore";
import {app} from "./firebase/client.js";

const DOMAIN="roles.mkp-bps-blora.invalid";
const USERNAME=/^[a-z][a-z0-9._-]{2,31}$/;
const TEAM=/^[A-Z][0-9]{3}$/;
const ROLES=new Set(["admin","ketua_tim","kepala"]);
export const sparkRoleReady=import.meta.env.VITE_SPARK_ROLE_AUTH_READY==="true";
const roleApp=sparkRoleReady?initializeApp(app.options,"matriks-spark-role"):null;
const createApp=sparkRoleReady?initializeApp(app.options,"matriks-spark-account-creator"):null;
export const sparkRoleAuth=roleApp?getAuth(roleApp):null;
const creatorAuth=createApp?getAuth(createApp):null;
const roleDb=roleApp?getFirestore(roleApp):null;
export function normalizeSparkUsername(input){
 const name=String(input||"").trim().toLowerCase();
 if(!USERNAME.test(name))throw Error("Username harus 3–32 karakter: huruf kecil, angka, titik, _ atau -.");
 return name;
}
export function sparkLoginEmail(username){
 return normalizeSparkUsername(username)+"@"+DOMAIN;
}
function validProfile(p,user){
 if(!p||p.active!==true||!ROLES.has(p.role)||typeof p.username!=="string"||!user)return null;
 if(sparkLoginEmail(p.username)!==user.email?.toLowerCase())return null;
 const teamIds=Array.isArray(p.teamIds)?p.teamIds:[];
 if(p.role==="ketua_tim"&&(!teamIds.length||teamIds.some(id=>!TEAM.test(id))))return null;
 return {username:p.username,role:p.role,teamIds,active:true,uid:user.uid};
}
export async function getSparkRoleProfile(){
 if(!sparkRoleReady||!sparkRoleAuth?.currentUser)return null;
 const user=sparkRoleAuth.currentUser;
 const snap=await getDoc(doc(roleDb,"sparkRoleProfiles",user.uid));
 return snap.exists()?validProfile(snap.data(),user):null;
}
export async function loginSparkRole(username,password){
 if(!sparkRoleReady||!sparkRoleAuth)throw Error("Aktifkan Email/Password dan aturan Spark di Firebase terlebih dahulu.");
 if(!password)throw Error("Masukkan password peran.");
 await signInWithEmailAndPassword(sparkRoleAuth,sparkLoginEmail(username),password);
 try{
  const profile=await getSparkRoleProfile();
  if(!profile)throw Error("Akun belum didaftarkan atau dinonaktifkan oleh Admin.");
  return profile;
 }catch(e){
  await signOut(sparkRoleAuth).catch(()=>{});
  throw e;
 }
}
export async function restoreSparkRole(){
 if(!sparkRoleAuth?.currentUser)return null;
 try{
  const profile=await getSparkRoleProfile();
  if(!profile)await signOut(sparkRoleAuth);
  return profile;
 }catch{
  await signOut(sparkRoleAuth).catch(()=>{});
  return null;
 }
}
export async function logoutSparkRole(){
 if(sparkRoleAuth?.currentUser)await signOut(sparkRoleAuth);
}
async function requireAdmin(){
 const p=await getSparkRoleProfile();
 if(!p||p.role!=="admin")throw Error("Hanya akun Admin aktif dapat mengelola akun akses.");
 return p;
}
function checkTeams(teamIds){
 if(!Array.isArray(teamIds)||!teamIds.length||teamIds.length>25)return false;
 return teamIds.every(id=>typeof id==="string"&&TEAM.test(id))&&new Set(teamIds).size===teamIds.length;
}
export async function listSparkRoleAccounts(){
 await requireAdmin();
 const result=await getDocs(collection(roleDb,"sparkRoleProfiles"));
 return result.docs.map(x=>({
  uid:x.id,username:x.data().username,role:x.data().role,
  teamIds:x.data().teamIds||[],active:x.data().active===true
 })).sort((a,b)=>a.username.localeCompare(b.username,"id"));
}
export async function createSparkKetuaAccount({username,password,teamIds}){
 const actor=await requireAdmin();
 const name=normalizeSparkUsername(username);
 if(!checkTeams(teamIds))throw Error("Ketua Tim wajib memiliki satu atau lebih tim yang valid.");
 if(new TextEncoder().encode(String(password||"")).length<12||new TextEncoder().encode(password).length>72)
  throw Error("Password harus 12–72 byte.");
 if(!creatorAuth)throw Error("Mode Spark belum siap.");
 let registered=null;
 try{
  // Separate Auth instance keeps the Admin role and Google viewer signed in.
  registered=await createUserWithEmailAndPassword(creatorAuth,sparkLoginEmail(name),password);
  await setDoc(doc(roleDb,"sparkRoleProfiles",registered.user.uid),{
   username:name,role:"ketua_tim",teamIds:[...teamIds],active:true,
   createdBy:actor.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()
  });
  return {uid:registered.user.uid,username:name};
 }catch(e){
  // Never leave an orphan authenticated account after a rejected profile write.
  if(registered?.user)await deleteUser(registered.user).catch(()=>{});
  throw e;
 }finally{
  await signOut(creatorAuth).catch(()=>{});
 }
}
export async function updateSparkAccount(uid,{teamIds,active}){
 const actor=await requireAdmin();
 if(!uid||uid===actor.uid)throw Error("Admin tidak dapat mengubah akunnya sendiri dari menu ini.");
 const target=doc(roleDb,"sparkRoleProfiles",uid);
 const snap=await getDoc(target);
 if(!snap.exists()||snap.data().role!=="ketua_tim")
  throw Error("Hanya akun Ketua Tim yang dapat diubah dari menu ini.");
 if(!checkTeams(teamIds)||typeof active!=="boolean")throw Error("Tim atau status akun tidak valid.");
 await updateDoc(target,{teamIds:[...teamIds],active,updatedAt:serverTimestamp()});
 return true;
}
export async function changeSparkOwnPassword(currentPassword,newPassword){
 if(!sparkRoleAuth?.currentUser||!await getSparkRoleProfile())throw Error("Silakan login peran dahulu.");
 const size=new TextEncoder().encode(String(newPassword||"")).length;
 if(size<12||size>72)throw Error("Password baru harus 12–72 byte.");
 const user=sparkRoleAuth.currentUser;
 await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,currentPassword));
 await updatePassword(user,newPassword);
 return true;
}
