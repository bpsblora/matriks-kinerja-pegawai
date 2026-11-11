import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signInWithCustomToken, signOut } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase/client.js";
import sitePolishCss from "./sitePolish.css?raw";
import {createAccessAdminView} from "./adminAccess.js";
import {createSparkAccessAdminView} from "./sparkAccessAdmin.js";
import {
 sparkRoleReady,sparkRoleAuth,loginSparkRole,restoreSparkRole,logoutSparkRole,
 watchSparkRoleRevocation
} from "./sparkRoleAuth.js";
import "./adminAccess.css";

// GitHub Pages is a preview. Real roles and shared writes remain disabled.
// Google BPS Blora stays the viewer identity. Role credentials are checked by
// the server separately and never inferred from a client-side role selection.
// Prefer Firebase Spark's built-in Email/Password & Firestore Rules.
const legacyRoleReady=!sparkRoleReady&&import.meta.env.VITE_ROLE_AUTH_READY==="true";
const roleLoginReady=sparkRoleReady||legacyRoleReady;
const accountsReady=sparkRoleReady||(legacyRoleReady&&import.meta.env.VITE_ACCESS_ADMIN_READY==="true");
const roleApp=legacyRoleReady?initializeApp(auth.app.options,"matriks-role-session"):null;
const roleAuth=roleApp?getAuth(roleApp):null;
const roleFunctions=roleApp?getFunctions(roleApp,import.meta.env.VITE_FIREBASE_FUNCTION_REGION||"us-central1"):null;
const roleSignIn=roleLoginReady?httpsCallable(functions,"usernameSignIn",{timeout:30000}):null;
const readRoleProfile=roleFunctions?httpsCallable(roleFunctions,"getAccessContext",{timeout:30000}):null;
const root=document.getElementById("app");
const logo="https://bpsblora.github.io/bolo-inpek/logo-bps-blora.jpg";
const googleIcon="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg";
const approvedUid=import.meta.env.VITE_VIEWER_GOOGLE_UID||"";
const allowedDomains=(import.meta.env.VITE_ALLOWED_GOOGLE_DOMAINS||"bps.go.id").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);
const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let runId=0,protoCache=null,loading=null,initial=true;
const safe=value=>String(value||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
root.innerHTML=`
<section class="mp-entry" id="mpEntry">
  <div class="mp-splash" id="mpSplash" aria-label="Matriks Pegawai sedang dibuka">
    <div><img class="mp-splash-logo" src="${logo}" alt="Logo BPS Kabupaten Blora"><div class="mp-splash-ground" aria-hidden="true"></div></div>
  </div>
  <section class="mp-welcome" id="mpWelcome" role="dialog" aria-modal="true" aria-labelledby="mpWelcomeTitle">
    <img class="mp-logo" src="${logo}" alt="Logo BPS Blora">
    <p class="mp-eyebrow">BPS KABUPATEN BLORA</p>
    <h1 id="mpWelcomeTitle">Selamat Datang di Matriks Kinerja Pegawai</h1>
    <p class="mp-description">Silakan masuk dengan akun Google BPS Blora untuk melanjutkan.</p>
    <button class="mp-google" id="mpLogin" type="button"><img src="${googleIcon}" alt="">Masuk dengan Google</button>
    <p class="mp-error" id="mpError" role="alert"></p>
    
  </section>
</section>
<section class="mp-frame-wrap" id="mpView" hidden><iframe id="mpFrame" title="Matriks Kinerja Pegawai BPS Blora" referrerpolicy="no-referrer"></iframe></section>
<dialog id="mpAccountsDialog" class="mp-accounts-dialog" aria-labelledby="mpAccountsTitle">
  <div class="mp-accounts-shell">
    <header class="mp-accounts-header"><div><span>KHUSUS ADMIN</span><h2 id="mpAccountsTitle">Kelola Akun Akses</h2><p>Buat akun Ketua Tim dan kelola kewenangannya melalui server.</p></div>
    <button id="mpAccountsClose" type="button" aria-label="Tutup Kelola Akun">×</button></header>
    <div id="mpAccountsContent" class="mp-accounts-content"></div>
  </div>
</dialog>`;
const $=id=>document.getElementById(id);
function revealWelcome(){
 $("mpSplash").classList.add("is-done");
 $("mpWelcome").classList.add("is-visible");
}
// The welcome screen must appear after the logo animation regardless of Firebase readiness.
let authChecked=false;
window.setTimeout(()=>{
 if(!$("mpEntry").hidden)revealWelcome();
},reducedMotion?0:1850);
window.setTimeout(()=>{
 if(!authChecked&&!$("mpEntry").hidden){
  $("mpError").textContent="Koneksi login belum siap. Muat ulang halaman untuk mencoba lagi.";
  revealWelcome();
 }
},12000);
function sparkLoginErrorText(error,username){
 const code=String(error?.code||"");
 const message=String(error?.message||"");
 if(message.startsWith("SPARK_PROFILE_")){
  const [reason,uid,fieldType,length,codepoints]=message.split(":");
  const ref="UID Authentication: "+(uid||"tidak diketahui")+". ";
  if(reason==="SPARK_PROFILE_MISSING")
   return "Password diterima Firebase. "+ref+"Dokumen sparkRoleProfiles/{UID} tidak ditemukan. Cocokkan Document ID Firestore dengan UID ini persis, termasuk huruf besar/kecil dan karakter I/l/1.";
  if(reason==="SPARK_PROFILE_INACTIVE")
   return "Password diterima Firebase. "+ref+"Field active pada profil harus bertipe Boolean true.";
  if(reason==="SPARK_PROFILE_ROLE_INVALID")
   return "Password diterima Firebase. "+ref+"Field role tidak valid. Untuk Admin, gunakan string admin.";
  if(reason==="SPARK_PROFILE_USERNAME_INVALID")
   return "Password sudah diterima Firebase. "+ref+
    "Nilai username yang benar-benar terbaca dari server berbeda dengan admin. "+
    "Tipe: "+(fieldType||"tidak diketahui")+", jumlah karakter: "+(length||"?")+
    (codepoints?", kode Unicode: "+codepoints.replace(/,/g," "):"")+
    ". Username admin harus persis 5 karakter: a d m i n. "+
    "Tidak perlu mengganti password atau membuat akun baru.";
  if(reason==="SPARK_PROFILE_EMAIL_MISMATCH")
   return "Password diterima Firebase. "+ref+"Email internal di profil tidak sesuai dengan akun Authentication. Periksa konfigurasi loginEmail bila ada.";
  return "Password diterima Firebase. "+ref+"Profil peran tidak sesuai format. Periksa tipe dan isi field-nya.";
 }
 if(code==="permission-denied"||code==="firestore/permission-denied"){
  return "Login belum selesai: Firestore menolak pembacaan profil. Aturan firestore.spark.rules belum diterapkan atau akun tidak memiliki izin. Jangan ubah password dahulu.";
 }
 if(code==="auth/invalid-credential"||code==="auth/wrong-password"||code==="auth/user-not-found"){
  return username==="admin"?
   "Kredensial Admin ditolak Firebase. Periksa kembali username admin, password, dan email internal akun yang dibuat di Firebase Authentication.":
   "Username atau password tidak cocok.";
 }
 if(code==="auth/operation-not-allowed"){
  return "Metode Email/Password belum diaktifkan pada Firebase Authentication.";
 }
 if(message.includes("Akun tidak aktif")||message.includes("belum diizinkan Admin")){
  return "Kredensial diterima, tetapi profil peran belum aktif. Pastikan dokumen sparkRoleProfiles dengan Document ID = UID akun Admin sudah dibuat dan berisi role admin serta active true.";
 }
 if(code==="unavailable"||code==="firestore/unavailable"){
  return "Layanan Firestore belum dapat dihubungi. Periksa koneksi lalu coba lagi.";
 }
 return "Login belum berhasil. Periksa akun, izin Firestore Spark dan koneksi; jangan membuat ulang akun Admin sebelum penyebabnya diketahui.";
}
function errorText(code){
 if(code==="auth/unauthorized-domain")return "Domain website belum diizinkan di Firebase Authentication.";
 if(code==="auth/popup-blocked")return "Izinkan pop-up browser, kemudian coba lagi.";
 if(code==="auth/popup-closed-by-user"||code==="auth/cancelled-popup-request")return "Login dibatalkan.";
 if(code==="auth/network-request-failed")return "Koneksi bermasalah. Coba lagi.";
 return "Login belum berhasil. Silakan coba kembali.";
}
async function loadPrototype(){
 if(protoCache)return protoCache;
 if(loading)return loading;
 loading=(async()=>{
  const urls=Array.from({length:17},(_,i)=>import.meta.env.BASE_URL+"v26/part-"+String(i+1).padStart(3,"0")+".txt");
  const chunks=await Promise.all(urls.map(async url=>{
    const result=await fetch(url,{cache:"no-cache"});
    if(!result.ok)throw new Error("Berkas prototipe tidak tersedia.");
    return result.text();
  }));
  const html=chunks.join("");
  if(!html.includes("Prototipe V25 v2.6")||!html.includes('id="seed"')||!html.includes("function enterPrototypeEdit()"))
    throw new Error("Berkas V25 v2.6 belum lengkap.");
  protoCache=html;return html;
 })().finally(()=>{loading=null});
 return loading;
}
function addAuthenticatedHeader(html,user){
 // Existing demo role controls are hidden: they are NOT Firebase authorization.
 const email=safe(user.email),name=safe(user.displayName||user.email.split("@")[0]);
 const header=`<div class="mp-identity" role="group" aria-label="Google BPS Blora dan sesi login peran">
   <span class="mp-user"><strong>${name}</strong><small>${email}</small></span>
   <button id="mpRoleMenu" class="mp-role-menu" type="button" aria-haspopup="dialog" aria-controls="mpRoleDialog" aria-expanded="false" title="Masuk dengan username dan password Admin atau Ketua Tim">
     <span class="mp-role-menu-label">Login Peran</span><strong id="mpCurrentRole">Mode Lihat</strong><span class="mp-role-caret" aria-hidden="true"></span>
   </button>
   <label id="mpAssignedTeamLabel" class="mp-assigned-team" hidden>Tim Aktif <select id="mpAssignedTeam" aria-label="Tim yang dikelola"></select></label>
   <button id="mpManageAccounts" class="mp-accounts-trigger" type="button" hidden title="Kelola username, password dan tim Ketua Tim">Kelola Akun Akses</button>
   <button id="mpRoleLogout" type="button" hidden title="Keluar dari sesi peran, kembali ke Mode Lihat">Keluar Peran</button>
   <button id="mpSignOut" type="button" title="Keluar dari akun Google BPS Blora">Keluar Google</button>
 </div>
 <dialog id="mpRoleDialog" class="mp-role-dialog" aria-labelledby="mpRoleDialogTitle">
   <div class="mp-role-dialog-head"><div><small>AKSES PENGELOLA</small><h3 id="mpRoleDialogTitle">Login Sesuai Peran</h3><p>Masukkan username dan password Admin atau Ketua Tim sesuai kewenangan.</p></div><button type="button" id="mpRoleDismiss" class="mp-role-dismiss" aria-label="Tutup pilihan peran">×</button></div>
   <form id="mpRoleLoginForm">
     <div class="mp-role-dialog-body">
       <div class="mp-role-connected"><strong>Google BPS Blora · Mode Lihat</strong><small>Akses pengelolaan hanya terbuka setelah login peran berhasil diverifikasi.</small></div>
       <label for="mpRoleUsername">Username Peran</label>
       <input id="mpRoleUsername" name="username" autocomplete="username" minlength="3" maxlength="32" required placeholder="Admin atau username Ketua Tim">
       <label for="mpRolePassword">Password Peran</label>
       <input id="mpRolePassword" name="password" type="password" autocomplete="current-password" required placeholder="Masukkan password peran">
       <p class="mp-role-warning">${sparkRoleReady?'Login melalui Firebase Authentication paket Spark. Hak akses Admin dan Ketua Tim diperiksa oleh Firestore Security Rules.':'Layanan autentikasi peran belum aktif. Mode Lihat tetap tersedia.'}</p>
       <p id="mpRoleError" class="mp-role-error" role="alert"></p>
     </div>
     <div class="mp-role-dialog-foot"><button type="button" id="mpRoleCancel">Batal</button><button type="submit" id="mpRoleApply" ${roleLoginReady?'':'disabled'}>Masuk Peran</button></div>
   </form>
 </dialog>`;
 const styles=`<style>
 .rightbar .role-switch,.rightbar #rolePill,.rightbar #sessionUser,.rightbar #btnRoster{display:none!important}
 .mp-identity{display:flex;align-items:center;gap:9px;padding:5px 7px;background:#edf6ff;border:1px solid #d7e9f8;border-radius:12px;flex-wrap:wrap}
 .mp-user{display:flex;flex-direction:column;max-width:210px;min-width:0;line-height:1.3}
 .mp-user strong{font:700 12px Nunito,Arial,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .mp-user small{font:600 10px Nunito,Arial,sans-serif;color:#6a849d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .mp-role{padding:7px 9px;background:#d7ecff;border-radius:8px;color:#0b5c9d;font:800 11px Nunito,Arial,sans-serif;white-space:nowrap}
 #mpSignOut{border:1px solid #c8dced;border-radius:8px;padding:8px 10px;color:#245b87;background:#fff;font:800 11px Nunito,Arial,sans-serif}
 @media(max-width:800px){.mp-identity{width:100%}.mp-user{flex:1}}

 .mp-role-menu{min-height:39px;display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid #b6d7ee;border-radius:9px;background:#fff;color:#175e94;cursor:pointer;white-space:nowrap}
 .mp-role-menu:hover,.mp-role-menu:focus-visible{background:#e5f3ff;border-color:#76b5e1}
 .mp-role-menu-label{color:#64839d;font:800 10px Nunito,Arial,sans-serif}
 #mpCurrentRole{font:900 11px Nunito,Arial,sans-serif;color:#145c90}
 .mp-role-caret{font-size:16px}
 .mp-role-dialog{box-sizing:border-box;position:fixed;inset:0;margin:auto;width:min(445px,calc(100vw - 24px));max-width:none;padding:0;border:1px solid #c6dfef;border-radius:17px;background:#fff;color:#1b517b;overflow:hidden;box-shadow:0 24px 76px rgba(13,45,78,.29)}
 .mp-role-dialog::backdrop{background:rgba(11,41,71,.55);backdrop-filter:blur(3px)}
 .mp-role-dialog-head{display:flex;justify-content:space-between;gap:14px;padding:17px 19px;background:linear-gradient(110deg,#eef8ff,#fff);border-bottom:1px solid #dceaf6}
 .mp-role-dialog-head small{font-size:10px;color:#3980ad;font-weight:900;letter-spacing:.07em}
 .mp-role-dialog-head h3{margin:4px 0;font:900 19px Nunito,Arial,sans-serif;color:#17527f}
 .mp-role-dialog-head p{margin:0;font-size:11px;color:#6a879e}
 .mp-role-dismiss{flex:0 0 34px;width:34px;height:34px;border:1px solid #c9dded;border-radius:10px;background:#fff;color:#255f8e;font-size:23px;cursor:pointer}
 .mp-role-dialog-body{padding:16px 19px;display:flex;flex-direction:column;gap:8px}
 .mp-role-dialog-body label{font-size:11.5px;font-weight:900;color:#1e5d88;margin-top:6px}
 .mp-role-dialog-body select{box-sizing:border-box;width:100%;min-height:42px;padding:9px 11px;border:1px solid #c5dded;border-radius:10px;background:#fff;color:#195781;font:800 12px Nunito,Arial,sans-serif}
 .mp-role-warning{margin:8px 0 0;padding:10px 11px;border:1px solid #d8e0e7;border-radius:9px;background:#f4f6f8;color:#566b7d;font-size:11px;line-height:1.6}
 .mp-role-error{margin:0;color:#af4254;font-size:11px}
 .mp-role-dialog-foot{display:flex;justify-content:flex-end;gap:9px;padding:12px 19px;border-top:1px solid #dce9f5;background:#f8fbff}
 .mp-role-dialog-foot button{min-height:38px;border:1px solid #c3d9ea;border-radius:9px;background:#fff;padding:8px 14px;color:#26608e;font:900 11px Nunito,Arial,sans-serif;cursor:pointer}
 #mpRoleApply{background:#146ca9;color:#fff;border-color:#146ca9}

 .mp-role-dialog-body input{box-sizing:border-box;width:100%;min-height:42px;padding:9px 11px;border:1px solid #c5dded;border-radius:10px;background:#fff;color:#195781;font:800 12px Nunito,Arial,sans-serif}
 .mp-role-dialog-body input:focus-visible{outline:3px solid #85c5f2;outline-offset:1px}
 .mp-role-dialog-body input::placeholder{font-weight:600;color:#829caf}
 .mp-role-connected{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border:1px solid #cce5f5;border-radius:10px;background:#f0f8ff}
 .mp-role-connected strong{font:900 12px Nunito,Arial,sans-serif;color:#195f91}
 .mp-role-connected small{font:650 10.5px/1.5 Nunito,Arial,sans-serif;color:#64839b}
 #mpRoleLoginForm{display:block;margin:0;padding:0}
 #mpRoleApply:disabled{opacity:.48;cursor:not-allowed;box-shadow:none}
 #mpRoleLogout{border:1px solid #bcd9ed;border-radius:8px;padding:8px 10px;background:#eaf5ff;color:#175c92;font:900 11px Nunito,Arial,sans-serif;cursor:pointer}
 #mpRoleLogout[hidden]{display:none!important}
 .mp-role-dialog-body .mp-role-warning{color:#526779}

 @media(max-width:1100px){.rightbar{flex-wrap:wrap;justify-content:flex-end}.mp-identity{flex-wrap:wrap}.mp-user{max-width:180px}}
 @media(max-width:650px){.mp-identity{width:100%}.mp-user{flex:1 1 130px}.mp-role-menu{flex:1;justify-content:center}}

 /* Header role action: a clean CSS chevron replaces the uneven text glyph. */
 .mp-role-menu{
   position:relative; isolation:isolate; overflow:hidden;
   display:inline-flex; align-items:center; justify-content:center;
   min-height:42px; min-width:168px; gap:8px;
   padding:7px 12px; border-radius:11px;
   border:1px solid #97c9ed;
   background:linear-gradient(118deg,#e6f5ff 0%,#f8fcff 58%,#e4f3ff 100%);
   box-shadow:0 2px 9px rgba(27,106,172,.10),inset 0 1px 0 rgba(255,255,255,.92);
   color:#155b91;
   transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease,background .2s ease;
 }
 .mp-role-menu::after{
   content:"";pointer-events:none;position:absolute;inset:0;
   background:linear-gradient(105deg,transparent 25%,rgba(255,255,255,.75) 49%,transparent 72%);
   transform:translateX(-120%);transition:transform .56s ease;
   z-index:0;
 }
 .mp-role-menu>*{position:relative;z-index:1}
 .mp-role-menu:hover:not(:disabled),.mp-role-menu:focus-visible:not(:disabled){
   background:linear-gradient(118deg,#dcefff,#f3faff);
   border-color:#58a8dc;
   box-shadow:0 5px 15px rgba(20,100,172,.19),0 0 0 3px rgba(81,174,231,.10);
   transform:translateY(-1px);
 }
 .mp-role-menu:hover::after,.mp-role-menu:focus-visible::after{transform:translateX(120%)}
 .mp-role-menu:active:not(:disabled){transform:translateY(0) scale(.99)}
 .mp-role-menu[aria-expanded="true"]{
   border-color:#429fda;
   background:#e2f2ff;
   box-shadow:0 0 0 3px rgba(64,159,218,.14),0 5px 15px rgba(19,91,156,.12);
 }
 .mp-role-menu-label{font-size:10px;letter-spacing:.015em;color:#4c789b}
 #mpCurrentRole{
   display:inline-flex;align-items:center;gap:7px;
   padding:5px 9px;border-radius:8px;
   background:#d5ecff;border:1px solid #b5dcf9;
   color:#0d5b92;font-weight:950;font-size:11px;line-height:1.3;
   box-shadow:inset 0 1px 0 rgba(255,255,255,.7);
 }
 #mpCurrentRole::before{
   content:"";flex:0 0 7px;width:7px;height:7px;border-radius:50%;
   background:#218bc6;box-shadow:0 0 0 3px rgba(47,153,212,.14);
   animation:mpModeStatusPulse 2.9s ease-in-out infinite;
 }
 .mp-role-menu.is-role-active #mpCurrentRole{
   background:#e3f8ed;border-color:#b8e8cb;color:#1c7752;
 }
 .mp-role-menu.is-role-active #mpCurrentRole::before{
   background:#29a174;box-shadow:0 0 0 3px rgba(45,166,117,.15);
 }
 .mp-role-caret{
   display:block;flex:0 0 8px;width:8px;height:8px;
   margin:0 3px 4px 1px;padding:0;
   border:0;border-right:2px solid #236b9d;border-bottom:2px solid #236b9d;
   border-radius:0 1px 1px 0;
   transform:rotate(45deg);
   transform-origin:center;
   transition:transform .22s ease,border-color .22s ease,margin .22s ease;
 }
 .mp-role-menu[aria-expanded="true"] .mp-role-caret{
   transform:translateY(4px) rotate(225deg);
   border-color:#10629d;
 }
 @keyframes mpModeStatusPulse{
   0%,100%{box-shadow:0 0 0 3px rgba(47,153,212,.12)}
   50%{box-shadow:0 0 0 5px rgba(47,153,212,.24)}
 }
 @media(prefers-reduced-motion:reduce){
   .mp-role-menu,.mp-role-menu::after,.mp-role-caret{transition:none!important}
   #mpCurrentRole::before{animation:none!important}
 }

 .mp-accounts-trigger{
   display:inline-flex;align-items:center;justify-content:center;
   min-height:38px;padding:8px 12px;
   border:1px solid #a9d8c6;border-radius:10px;
   background:linear-gradient(120deg,#e8f9ef,#f5fcf8);
   color:#177650;font:900 11px Nunito,Arial,sans-serif;
   white-space:nowrap;cursor:pointer;transition:background .15s,transform .15s;
 }
 .mp-accounts-trigger:hover:not(:disabled){background:#d8f4e6;transform:translateY(-1px)}
 .mp-accounts-trigger:disabled{background:#eef2f6;color:#7890a4;border-color:#dbe3ec;cursor:not-allowed}
 .mp-accounts-trigger[hidden]{display:none!important}
 .mp-assigned-team{
   display:flex;align-items:center;gap:6px;white-space:nowrap;
   color:#4c7090;font:850 10.5px Nunito,Arial,sans-serif;
 }
 .mp-assigned-team select{
   max-width:165px;min-height:35px;padding:6px 9px;border-radius:9px;
   border:1px solid #bcd9ed;background:#fff;color:#195a8e;
   font:850 11px Nunito,Arial,sans-serif;cursor:pointer;
 }
 .mp-assigned-team[hidden]{display:none!important}
 .mp-accounts-trigger:focus-visible,.mp-assigned-team select:focus-visible{outline:3px solid #92d0f5;outline-offset:1px}
 @media(max-width:660px){.mp-assigned-team{flex:1 1 100%;justify-content:flex-end}}
 </style>`;
 if(!html.includes('<div class="rightbar">'))throw new Error("Header prototipe tidak ditemukan.");
 return html.replace("</head>", styles + '<style id="mkp-site-polish">' + sitePolishCss + "</style></head>").replace('<div class="rightbar">','<div class="rightbar">'+header);
}
/* A Google login only opens Mode Lihat. The second (independent) Firebase
   auth instance holds a verified role account and never replaces the Google
   BPS Blora identity. No client-side role picker can grant an edit role. */
function verifiedRoleContext(data){
 if(!data||data.mode!=="role"||data.active!==true)return null;
 const roles={admin:"admin",ketua_tim:"ketua",kepala:"kepala"};
 const role=roles[data.role];
 if(!role)return null;
 const teamIds=Array.isArray(data.teamIds)?data.teamIds.filter(t=>typeof t==="string"):[];
 if(role==="ketua"&&(teamIds.length<1||teamIds.some(id=>!/^[A-Z][0-9]{3}$/.test(id))))return null;
 return {role,teamId:role==="ketua"?teamIds[0]:"",teamIds,username:String(data.username||"")};
}
async function verifyRoleSession(){
 if(!roleLoginReady||!roleAuth?.currentUser||!readRoleProfile)return null;
 try{
  const reply=await readRoleProfile({});
  const verified=verifiedRoleContext(reply?.data);
  if(!verified)throw new Error("Peran belum diizinkan");
  return verified;
 }catch{
  await signOut(roleAuth).catch(()=>{});
  return null;
 }
}
function bindAuthenticatedSession(frame){
 const doc=frame.contentDocument,preview=frame.contentWindow;
 if(!doc)return;
 const get=id=>doc.getElementById(id);
 const dialog=get("mpRoleDialog"),opener=get("mpRoleMenu"),
  form=get("mpRoleLoginForm"),username=get("mpRoleUsername"),
  password=get("mpRolePassword"),apply=get("mpRoleApply"),
  badge=get("mpCurrentRole"),warning=get("mpRoleError"),roleLogout=get("mpRoleLogout"),
  accountButton=get("mpManageAccounts"),accountDialog=$("mpAccountsDialog"),
  accountContent=$("mpAccountsContent"),assignedTeam=get("mpAssignedTeam"),
  assignedTeamLabel=get("mpAssignedTeamLabel");
 if(!dialog||!opener||!form||!username||!password||!apply||!badge||!warning||!roleLogout||!accountButton||!accountDialog||!accountContent||!assignedTeam||!assignedTeamLabel)return;
 let liveRole=null,busy=false,stopRoleWatch=null;
 const closeAccounts=()=>{
  if(accountDialog.open)accountDialog.close();
  accountContent.replaceChildren();
 };
 $("mpAccountsClose")?.addEventListener("click",closeAccounts);
 accountDialog.addEventListener("click",e=>{if(e.target===accountDialog)closeAccounts();});
 accountButton.addEventListener("click",()=>{
  // UI visibility is convenience only; server enforces requireAdmin()
  // for every operation and checks Firebase custom role credentials.
  if(!accountsReady||liveRole?.role!=="admin")return;
  const teams=preview?.__mpPreviewSessionState?.()?.teams||[];
  if(sparkRoleReady){
   if(!sparkRoleAuth?.currentUser)return;
   accountContent.replaceChildren(createSparkAccessAdminView(teams));
  }else{
   if(!roleAuth?.currentUser||!roleFunctions)return;
   accountContent.replaceChildren(createAccessAdminView(teams,{functionsClient:roleFunctions}));
  }
  if(!accountDialog.open)accountDialog.showModal();
 });

 function renderRole(profile){
  if(stopRoleWatch){stopRoleWatch();stopRoleWatch=null;}
  liveRole=profile;
  if(sparkRoleReady&&profile){
   stopRoleWatch=watchSparkRoleRevocation(()=>{
    // Server-backed profile revocation overrides any local UI edit mode.
    if(stopRoleWatch){stopRoleWatch();stopRoleWatch=null;}
    void exitRole();
   });
  }
  const state=preview?.__mpPreviewSessionState?.();
  const display=profile?(state?.label||"Pengelola")+(state?.teamName?" · "+state.teamName:""):"Mode Lihat";
  badge.textContent=display;
  opener.classList.toggle("is-role-active",!!profile);
  opener.disabled=!!profile;
  roleLogout.hidden=!profile;
  roleLogout.disabled=!profile;
  accountButton.hidden=profile?.role!=="admin";
  accountButton.disabled=profile?.role!=="admin"||!accountsReady;
  accountButton.title=accountsReady?"Kelola username, password dan tim melalui Firebase Spark":"Kelola akun belum diaktifkan di Firebase";
  const assigned=profile?.role==="ketua"?profile.teamIds||[]:[];
  const options=(state?.teams||[]).filter(t=>assigned.includes(t.id));
  assignedTeamLabel.hidden=options.length<=1;
  assignedTeam.disabled=options.length<=1;
  assignedTeam.replaceChildren(...options.map(t=>{
   const option=doc.createElement("option");option.value=t.id;option.textContent=t.name;return option;
  }));
  if(options.length)assignedTeam.value=state?.teamId||options[0].id;
  if(profile?.role!=="admin")closeAccounts();
  opener.setAttribute("aria-label",profile?"Masuk sebagai "+display:"Login Peran untuk mengelola data");
 }
 async function exitRole(){
  if(busy)return;
  closeAccounts();
  busy=true;roleLogout.disabled=true;
  try{
   if(sparkRoleReady)await logoutSparkRole();
   else if(roleAuth)await signOut(roleAuth);
  }finally{
   preview?.__mpPreviewSwitchRole?.("pegawai");
   renderRole(null);
   busy=false;
  }
 }
 renderRole(null);
 get("mpSignOut")?.addEventListener("click",async()=>{
  closeAccounts();
  if(stopRoleWatch){stopRoleWatch();stopRoleWatch=null;}
  if(sparkRoleReady)await logoutSparkRole().catch(()=>{});
  else if(roleAuth)await signOut(roleAuth).catch(()=>{});
  await signOut(auth);
 });
 roleLogout.addEventListener("click",exitRole);
 assignedTeam.addEventListener("change",()=>{
  const tid=assignedTeam.value;
  if(!liveRole||liveRole.role!=="ketua"||!liveRole.teamIds?.includes(tid))return;
  const changed=preview?.__mpPreviewSwitchRole?.("ketua",tid);
  if(changed)renderRole(liveRole);
 });
 opener.addEventListener("click",()=>{
  if(liveRole)return;
  warning.textContent="";
  password.value="";
  if(!dialog.open)dialog.showModal();
  opener.setAttribute("aria-expanded","true");
  username.focus({preventScroll:true});
 });
 get("mpRoleDismiss")?.addEventListener("click",()=>dialog.close());
 get("mpRoleCancel")?.addEventListener("click",()=>dialog.close());
 dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
 dialog.addEventListener("close",()=>opener.setAttribute("aria-expanded","false"));
 form.addEventListener("submit",async event=>{
  event.preventDefault();
  if(busy)return;
  if(!roleLoginReady||(!sparkRoleReady&&(!roleSignIn||!roleAuth))){
   warning.textContent="Login peran belum disiapkan di Firebase. Mode Lihat tetap tersedia.";
   return;
  }
  const typedUser=username.value.trim().toLowerCase(),typedPassword=password.value;
  if(!typedUser||!typedPassword)return;
  busy=true;apply.disabled=true;warning.textContent="";
  try{
   if(!auth.currentUser)throw new Error("Login Google BPS Blora harus aktif.");
   let profile=null;
   if(sparkRoleReady){
    const spark=await loginSparkRole(typedUser,typedPassword);
    profile={
     role:spark.role==="ketua_tim"?"ketua":spark.role,
     teamId:spark.role==="ketua_tim"?spark.teamIds[0]:"",
     teamIds:spark.teamIds,username:spark.username
    };
   }else{
    const response=await roleSignIn({username:typedUser,password:typedPassword});
    if(typeof response?.data?.token!=="string")throw new Error("Token login peran tidak tersedia.");
    await signInWithCustomToken(roleAuth,response.data.token);
    profile=await verifyRoleSession();
   }
   if(!profile)throw new Error("Akun peran tidak diizinkan.");
   const changed=preview?.__mpPreviewSwitchRole?.(profile.role,profile.teamId);
   if(!changed){
    if(sparkRoleReady)await logoutSparkRole();
    else if(roleAuth)await signOut(roleAuth);
    throw new Error("Tim akun peran belum tersedia dalam matriks.");
   }
   renderRole(profile);
   dialog.close();
   password.value="";
  }catch(error){
   warning.textContent=sparkRoleReady?
    sparkLoginErrorText(error,typedUser):
    "Login gagal: periksa username, password, atau izin akun peran.";
   password.value="";
  }finally{busy=false;apply.disabled=!roleLoginReady;}
 });
 // Restore a verified second-stage session only after Google and the iframe
 // have loaded. A stale/unverified role session is cleared to Mode Lihat.
 if(sparkRoleReady&&sparkRoleAuth){
  sparkRoleAuth.authStateReady().then(async()=>{
   if(frame.contentWindow!==preview||!auth.currentUser)return;
   const spark=await restoreSparkRole();
   if(!spark)return;
   const profile={
    role:spark.role==="ketua_tim"?"ketua":spark.role,
    teamId:spark.role==="ketua_tim"?spark.teamIds[0]:"",
    teamIds:spark.teamIds,username:spark.username
   };
   const changed=preview?.__mpPreviewSwitchRole?.(profile.role,profile.teamId);
   if(changed)renderRole(profile);
   else await logoutSparkRole().catch(()=>{});
  }).catch(()=>{renderRole(null)});
 }else if(roleAuth)roleAuth.authStateReady().then(async()=>{
  if(frame.contentWindow!==preview||!auth.currentUser)return;
  const profile=await verifyRoleSession();
  if(!profile)return;
  const changed=preview?.__mpPreviewSwitchRole?.(profile.role,profile.teamId);
  if(changed)renderRole(profile);
  else await signOut(roleAuth).catch(()=>{});
 }).catch(()=>{renderRole(null)});
}
async function openPrototype(user,run){
 try{
   const html=addAuthenticatedHeader(await loadPrototype(),user);
   if(run!==runId)return;
   const frame=$("mpFrame");
   frame.onload=()=>bindAuthenticatedSession(frame);
   frame.srcdoc=html;
   $("mpEntry").hidden=true;$("mpView").hidden=false;
 }catch(err){
   if(run!==runId)return;
   $("mpEntry").hidden=false;$("mpView").hidden=true;
   $("mpError").textContent="Website belum dapat dimuat. "+(err.message||"Coba muat ulang.");
   revealWelcome();
 }
}
$("mpLogin").addEventListener("click",async()=>{
 const button=$("mpLogin");
 button.disabled=true;$("mpError").textContent="";
 try{
   const provider=new GoogleAuthProvider();
   provider.setCustomParameters({hd:"bps.go.id"});
   await signInWithPopup(auth,provider);
 }catch(e){$("mpError").textContent=errorText(e.code);}
 finally{button.disabled=false;}
});
onAuthStateChanged(auth,async user=>{
 authChecked=true;
 const run=++runId;
 if(!user){
   $("mpView").hidden=true;$("mpFrame").removeAttribute("srcdoc");
   $("mpEntry").hidden=false;
   if(initial)initial=false;
   // The animation timer controls first paint; Firebase must never block the welcome card.
   return;
 }
 try{
   const token=await user.getIdTokenResult();
   if(run!==runId)return;
   const email=(user.email||"").toLowerCase();
   const matchesDomain=allowedDomains.some(domain=>email.endsWith("@"+domain));
   const isExplicitViewer=!!approvedUid&&user.uid===approvedUid;
   if(token.signInProvider!=="google.com"||token.claims.email_verified!==true||!(matchesDomain||isExplicitViewer)){
     await signOut(auth);
     $("mpError").textContent="Gunakan akun Google BPS yang diizinkan.";
     revealWelcome();return;
   }
   await openPrototype(user,run);
 }catch(e){
   if(run===runId){$("mpError").textContent=errorText(e.code);revealWelcome();}
 }
},error=>{
 authChecked=true;
 $("mpError").textContent="Login Google belum dapat dimuat. Coba muat ulang halaman.";
 revealWelcome();
});
