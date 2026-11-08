import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "./firebase/client.js";

// GitHub Pages is a preview. Real roles and shared writes remain disabled.
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
    <p class="mp-note">Versi uji coba · Perubahan masih tersimpan di browser ini</p>
  </section>
</section>
<section class="mp-frame-wrap" id="mpView" hidden><iframe id="mpFrame" title="Matriks Kinerja Pegawai BPS Blora" referrerpolicy="no-referrer"></iframe></section>`;
const $=id=>document.getElementById(id);
function revealWelcome(){
 $("mpSplash").classList.add("is-done");
 $("mpWelcome").classList.add("is-visible");
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
 const header=`<div class="mp-identity" role="group" aria-label="Akun dan akses">
   <span class="mp-user"><strong>${name}</strong><small>${email}</small></span>
   <span class="mp-role" title="Peran prototipe lokal, bukan izin database bersama">Akses: Penguji</span>
   <button id="mpSignOut" type="button" title="Keluar dari akun Google">Keluar</button>
 </div>`;
 const styles=`<style>
 .rightbar .role-switch,.rightbar #rolePill,.rightbar #sessionUser,.rightbar #btnRoster{display:none!important}
 .mp-identity{display:flex;align-items:center;gap:9px;padding:5px 7px;background:#edf6ff;border:1px solid #d7e9f8;border-radius:12px;flex-wrap:wrap}
 .mp-user{display:flex;flex-direction:column;max-width:210px;min-width:0;line-height:1.3}
 .mp-user strong{font:700 12px Nunito,Arial,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .mp-user small{font:600 10px Nunito,Arial,sans-serif;color:#6a849d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .mp-role{padding:7px 9px;background:#d7ecff;border-radius:8px;color:#0b5c9d;font:800 11px Nunito,Arial,sans-serif;white-space:nowrap}
 #mpSignOut{border:1px solid #c8dced;border-radius:8px;padding:8px 10px;color:#245b87;background:#fff;font:800 11px Nunito,Arial,sans-serif}
 @media(max-width:800px){.mp-identity{width:100%}.mp-user{flex:1}}
 </style>`;
 if(!html.includes('<div class="rightbar">'))throw new Error("Header prototipe tidak ditemukan.");
 return html.replace("</head>",styles+"</head>").replace('<div class="rightbar">','<div class="rightbar">'+header);
}
async function openPrototype(user,run){
 try{
   const html=addAuthenticatedHeader(await loadPrototype(),user);
   if(run!==runId)return;
   const frame=$("mpFrame");
   frame.onload=()=>{
     const doc=frame.contentDocument;
     doc?.getElementById("mpSignOut")?.addEventListener("click",()=>signOut(auth));
   };
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
   provider.setCustomParameters({hd:"bps.go.id",prompt:"select_account"});
   await signInWithPopup(auth,provider);
 }catch(e){$("mpError").textContent=errorText(e.code);}
 finally{button.disabled=false;}
});
onAuthStateChanged(auth,async user=>{
 const run=++runId;
 if(!user){
   $("mpView").hidden=true;$("mpFrame").removeAttribute("srcdoc");
   $("mpEntry").hidden=false;
   if(initial){
     initial=false;
     if(reducedMotion)revealWelcome();
     else window.setTimeout(()=>{if(run===runId)revealWelcome()},1800);
   }else revealWelcome();
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
});
