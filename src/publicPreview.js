// Public, anonymous and browser-local V25 prototype preview.
// No Firebase sign-in, no Firestore reads/writes, no real employee data.
const root=document.querySelector("#app");
root.innerHTML=`
<section class="mp-frame-wrap" id="mpFrameWrap">
  <div style="padding:24px" id="mpLoading" role="status">Memuat Matriks Pegawai…</div>
  <iframe id="mpFrame" title="Matriks Kinerja Pegawai BPS Blora" referrerpolicy="no-referrer" hidden></iframe>
</section>`;
(async()=>{
 try{
   const urls=Array.from({length:17},(_,i)=>import.meta.env.BASE_URL+"v26/part-"+String(i+1).padStart(3,"0")+".txt");
   const chunks=await Promise.all(urls.map(async url=>{
     const response=await fetch(url,{cache:"no-cache"});
     if(!response.ok)throw new Error("Bagian prototipe tidak dapat dimuat.");
     return response.text();
   }));
   const html=chunks.join("");
   if(!html.includes("Prototipe V25 v2.6")||!html.includes('id="seed"')||!html.includes("function enterPrototypeEdit()"))
     throw new Error("Versi prototipe belum lengkap.");
   const frame=document.getElementById("mpFrame");
   frame.srcdoc=html;
   frame.hidden=false;
   document.getElementById("mpLoading").remove();
 }catch(error){
   document.getElementById("mpLoading").textContent="Prototipe gagal dimuat: "+error.message;
 }
})();
