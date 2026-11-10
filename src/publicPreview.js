import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signInWithCustomToken, signOut } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase/client.js";
import sitePolishCss from "./sitePolish.css?raw";

// GitHub Pages is a preview. Real roles and shared writes remain disabled.
// Google BPS Blora stays the viewer identity. Role credentials are checked by
// the server separately and never inferred from a client-side role selection.
const roleLoginReady=import.meta.env.VITE_ROLE_AUTH_READY==="true"&&import.meta.env.VITE_MATRIX_BACKEND_READY==="true";
const roleApp=roleLoginReady?initializeApp(auth.app.options,"matriks-role-session"):null;
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
<section class="mp-frame-wrap" id="mpView" hidden><iframe id="mpFrame" title="Matriks Kinerja Pegawai BPS Blora" referrerpolicy="no-referrer"></iframe></section>`;
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
   <button id="mpRoleMenu" class="mp-role-menu" type="button" aria-haspopup="dialog" aria-controls="mpRoleDialog" title="Masuk dengan username dan password Admin atau Ketua Tim">
     <span class="mp-role-menu-label">Login Peran</span><strong id="mpCurrentRole">Mode Lihat</strong><span class="mp-role-caret" aria-hidden="true">⌄</span>
   </button>
   <button id="mpRoleLogout" type="button" hidden title="Keluar dari sesi peran, kembali ke Mode Lihat">Keluar Peran</button>
   <button id="mpSignOut" type="button" title="Keluar dari akun Google BPS Blora">Keluar Google</button>
 </div>
 <dialog id="mpRoleDialog" class="mp-role-dialog" aria-labelledby="mpRoleDialogTitle">
   <div class="mp-role-dialog-head"><div><small>LOGIN TAHAP KEDUA</small><h3 id="mpRoleDialogTitle">Login Peran</h3><p>Gunakan akun Admin atau Ketua Tim yang telah ditetapkan.</p></div><button type="button" id="mpRoleDismiss" class="mp-role-dismiss" aria-label="Tutup pilihan peran">×</button></div>
   <form id="mpRoleLoginForm">
     <div class="mp-role-dialog-body">
       <div class="mp-role-connected"><strong>Google BPS Blora Tetap Terhubung</strong><small>Sesi Google digunakan untuk Mode Lihat. Login Peran diperlukan hanya jika akan mengelola matriks.</small></div>
       <label for="mpRoleUsername">Username Peran</label>
       <input id="mpRoleUsername" name="username" autocomplete="username" minlength="3" maxlength="32" required placeholder="Admin atau username Ketua Tim">
       <label for="mpRolePassword">Password Peran</label>
       <input id="mpRolePassword" name="password" type="password" autocomplete="current-password" required placeholder="Masukkan password peran">
       <p class="mp-role-warning">${roleLoginReady?'Akses edit diperiksa oleh server sesuai peran dan tim akun.':'Login Admin dan Ketua Tim belum diaktifkan pada preview ini. Setelah login Google, akses tetap Mode Lihat sampai backend peran diaktifkan.'}</p>
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
 @media(max-width:1100px){.rightbar{flex-wrap:wrap;justify-content:flex-end}.mp-identity{flex-wrap:wrap}.mp-user{max-width:180px}}
 @media(max-width:650px){.mp-identity{width:100%}.mp-user{flex:1 1 130px}.mp-role-menu{flex:1;justify-content:center}}
 </style>`;
 if(!html.includes('<div class="rightbar">'))throw new Error("Header prototipe tidak ditemukan.");
 return html.replace("</head>", styles + '<style id="mkp-site-polish">' + sitePolishCss + "</style></head>").replace('<div class="rightbar">','<div class="rightbar">'+header);
}
function bindAuthenticatedSession(frame){
 const doc=frame.contentDocument,preview=frame.contentWindow;
 if(!doc)return;
 const get=id=>doc.getElementById(id);
 get("mpSignOut")?.addEventListener("click",()=>signOut(auth));
 const dialog=get("mpRoleDialog"),opener=get("mpRoleMenu"),
  select=get("mpRoleSelect"),team=get("mpRoleTeam"),
  teamLabel=get("mpRoleTeamLabel"),badge=get("mpCurrentRole"),
  warning=get("mpRoleError");
 if(!dialog||!opener||!select||!team||!teamLabel||!badge)return;
 const state=()=>preview?.__mpPreviewSessionState?.()||null;
 const showTeamChoice=()=>{
  const isTeam=select.value==="ketua";
  team.hidden=!isTeam;teamLabel.hidden=!isTeam;team.disabled=!isTeam;
 };
 function refresh(info=state()){
  if(!info){opener.disabled=true;badge.textContent="Peran Tidak Tersedia";return;}
  opener.disabled=false;
  badge.textContent=info.label+(info.teamName?" · "+info.teamName:"")+" (Simulasi)";
  select.value=info.role;
  const savedTeam=team.value;
  team.replaceChildren(...(info.teams||[]).map(t=>{
   const option=doc.createElement("option");
   option.value=t.id;option.textContent=t.name;
   return option;
  }));
  team.value=info.teamId||savedTeam||info.teams?.[0]?.id||"";
  showTeamChoice();
 }
 refresh();
 opener.addEventListener("click",()=>{
  refresh();warning.textContent="";
  if(!dialog.open)dialog.showModal();
  select.focus({preventScroll:true});
 });
 select.addEventListener("change",showTeamChoice);
 get("mpRoleDismiss")?.addEventListener("click",()=>dialog.close());
 get("mpRoleCancel")?.addEventListener("click",()=>dialog.close());
 dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
 get("mpRoleApply")?.addEventListener("click",()=>{
  const targetTeam=select.value==="ketua"?team.value:"";
  const updated=preview?.__mpPreviewSwitchRole?.(select.value,targetTeam);
  if(!updated){warning.textContent="Peran atau tim belum valid. Pilih kembali.";return;}
  dialog.close();refresh(updated);
  opener.focus({preventScroll:true});
 });
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
