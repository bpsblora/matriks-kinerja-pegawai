import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "./firebase/client.js";

const approvedUid = import.meta.env.VITE_VIEWER_GOOGLE_UID || "";
const root = document.querySelector("#app");
const prototypeParts = Array.from({length:17},(_,i)=>"/v26/part-"+String(i+1).padStart(3,"0")+".txt");
let activeRun = 0;
let cachedSource = null;
let loading = null;
root.innerHTML = `
<header class="mp-head">
  <div class="mp-brand"><div class="mp-mark">MP</div><div><strong>Matriks Kinerja Pegawai</strong><span>BPS Kabupaten Blora · V25 Terpadu v2.6</span></div></div>
  <div class="mp-session"><span id="mpAccount"></span><button type="button" id="mpLogout" class="mp-logout" hidden>Keluar</button></div>
</header>
<section id="mpLogin" class="mp-login">
  <div class="mp-login-card">
    <div class="mp-eyebrow">MATRIKS PEGAWAI BPS BLORA</div>
    <h1>Masuk ke Matriks Kinerja Pegawai</h1>
    <p>Gunakan Gmail BPS Blora untuk membuka prototipe terakhir. Tidak perlu username dan password tambahan.</p>
    <button type="button" id="mpGoogle" class="mp-primary">Masuk dengan Google BPS Blora</button>
    <p class="mp-note">Versi pengujian V25 v2.6 menggunakan identitas pegawai anonim. Perubahan tersimpan di browser ini sampai penyimpanan bersama diaktifkan.</p>
    <p id="mpStatus" class="mp-status" role="status"></p>
  </div>
</section>
<section id="mpApp" class="mp-frame-wrap" hidden><iframe id="mpFrame" title="Prototipe Matriks Pegawai V25 Terpadu v2.6" referrerpolicy="no-referrer"></iframe></section>
`;

const $=id=>document.getElementById(id);
const login=$("mpLogin"),app=$("mpApp"),frame=$("mpFrame"),status=$("mpStatus"),
  google=$("mpGoogle"),logout=$("mpLogout"),account=$("mpAccount");
function message(text){status.textContent=text;}

async function loadPrototype(){
  if(cachedSource)return cachedSource;
  if(loading)return loading;
  loading=(async()=>{
    const parts=await Promise.all(prototypeParts.map(async url=>{
      const response=await fetch(url,{cache:"no-cache"});
      if(!response.ok)throw new Error("File prototipe tidak tersedia: "+url);
      return response.text();
    }));
    const html=parts.join("");
    if(!html.includes("Prototipe V25 v2.6")||!html.includes('id="seed"')||!html.includes("function enterPrototypeEdit()"))
      throw new Error("Paket prototipe tidak lengkap.");
    cachedSource=html;
    return html;
  })().finally(()=>{loading=null});
  return loading;
}

google.addEventListener("click",async()=>{
  google.disabled=true;
  message("Membuka login Google…");
  try{
    await signInWithPopup(auth,new GoogleAuthProvider());
  }catch(error){
    const code=error?.code;
    message(code==="auth/unauthorized-domain"
      ?"Domain website belum ditambahkan pada Authorized domains Firebase."
      :code==="auth/popup-blocked"
      ?"Browser memblokir jendela Google. Izinkan pop-up untuk situs ini."
      :"Login belum berhasil. "+(code||"Periksa koneksi lalu coba kembali."));
  }finally{google.disabled=false;}
});

logout.addEventListener("click",async()=>{await signOut(auth).catch(()=>{});window.location.reload();});
onAuthStateChanged(auth,async user=>{
  const run=++activeRun;
  if(!user){
    login.hidden=false;app.hidden=true;logout.hidden=true;account.textContent="";frame.removeAttribute("srcdoc");message("");
    return;
  }
  try{
    const token=await user.getIdTokenResult();
    if(run!==activeRun)return;
    if(!approvedUid||user.uid!==approvedUid||token.signInProvider!=="google.com"||token.claims.email_verified!==true){
      await signOut(auth);
      message("Gunakan Gmail BPS Blora yang telah terdaftar untuk mengakses website.");
      return;
    }
    message("Menyiapkan Matriks Pegawai V25 v2.6…");
    account.textContent=user.email||"Gmail BPS Blora";logout.hidden=false;
    frame.srcdoc=await loadPrototype();
    if(run!==activeRun)return;
    login.hidden=true;app.hidden=false;
  }catch(error){
    if(run===activeRun)message("Prototipe belum dapat dibuka: "+(error?.message||"Silakan muat ulang halaman."));
  }
});
