/* Firebase Spark Admin account management: usernames and passwords belong to
 * the Admin UI, not to individually supplied staff email addresses.
 *
 * Reset Password rotates the underlying Firebase Auth identity and atomically
 * revokes the old Firestore role profile; the user's username does not change.
 */
import {
 listSparkRoleAccounts,createSparkKetuaAccount,updateSparkAccount,
 resetSparkAccountPassword,changeSparkOwnPassword,normalizeSparkUsername
} from "./sparkRoleAuth.js";

const n=(tag,value)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;return el;};
const button=(title,cb)=>{const b=n("button",title);b.type="button";b.addEventListener("click",cb);return b;};
function labelled(label,input){const wrap=n("label",label);wrap.className="account-field";wrap.append(input);return wrap;}
function passwordInput(placeholder){
 const i=n("input");i.type="password";i.required=true;i.minLength=6;i.maxLength=72;
 i.pattern="[A-Za-z0-9]{6,72}";i.autocomplete="new-password";i.placeholder=placeholder;return i;
}
function passwordLengthOk(value){
 return /^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{6,72}$/.test(String(value||""));
}
export function createSparkAccessAdminView(teams=[]){
 const section=n("section");section.className="admin-access";
 const head=n("div");head.className="admin-access-heading";
 const title=n("div");
 title.append(n("span","AKUN PERAN · FIREBASE SPARK"),n("h2","Kelola Akun Akses"),
  n("p","Tambah akun Ketua Tim, edit username, tentukan tim, dan tetapkan ulang password."));
 title.firstChild.className="admin-access-eyebrow";
 const actions=n("div");actions.className="actions";
 const add=button("+ Tambah Akun Ketua Tim",()=>openCreate());
 const reload=button("↻ Muat Ulang",()=>void load());reload.className="secondary";
 const mine=button("Ubah Password Saya",()=>openMyPassword());mine.className="secondary";
 actions.append(add,reload,mine);head.append(title,actions);
 const status=n("p");status.className="admin-access-message";status.setAttribute("role","status");
 const listing=n("div");listing.className="table-wrap";
 const dialog=n("dialog");dialog.className="account-dialog";
 const message=n("p");message.className="account-modal-message";message.setAttribute("role","alert");
 const safeTeams=(teams||[]).filter(t=>t.active!==false).slice()
   .sort((a,b)=>String(a.name).localeCompare(String(b.name),"id"));
 const teamName=id=>safeTeams.find(t=>t.id===id)?.name||id;
 section.append(head,status,listing,dialog);
 let busy=false;
 function say(text){status.textContent=text;message.textContent=text;}
 function modal(name,body){
  const h=n("h2",name),cancel=button("Batal",()=>dialog.close());cancel.className="secondary";
  message.textContent="";
  dialog.replaceChildren(h,body,message,cancel);
  if(!dialog.open)dialog.showModal();
 }
 function teamChooser(selected=[]){
  const box=n("div");box.className="account-team-checks";
  for(const t of safeTeams){
   const label=n("label");label.className="account-team-option";
   const check=n("input");check.type="checkbox";check.value=t.id;check.checked=selected.includes(t.id);
   label.append(check,n("span",t.name));box.append(label);
  }
  return {box,get:()=>[...box.querySelectorAll("input:checked")].map(c=>c.value)};
 }
 async function action(fn,success){
  if(busy)return;
  busy=true;
  try{
   say("Menyimpan perubahan akun di Firebase…");
   await fn();
   dialog.close();
   busy=false;
   await load();
   status.textContent=success;
  }catch(error){
   busy=false;
   const code=String(error?.code||"");
   const denied=code==="permission-denied"||code==="firestore/permission-denied"||
    String(error?.message||"").includes("Missing or insufficient permissions");
   say(denied?
    "Belum dapat menyimpan akun: Firestore Rules masih membatasi penulisan. Login Admin sudah aktif, tetapi aturan khusus Kelola Akun belum diterapkan. Uji dan aktifkan firestore.spark.rules terlebih dahulu.":
    "Tidak berhasil: "+(error?.message||"Cek koneksi dan izin akun Admin."));
  }
 }
 function validatePw(a,b){
  if(!passwordLengthOk(a)){say("Password minimal 6 karakter, wajib mengandung huruf dan angka, tanpa spasi atau simbol.");return false;}
  if(a!==b){say("Konfirmasi password tidak sama.");return false;}
  return true;
 }
 function newPasswordFields(body){
  const pass=passwordInput("Minimal 6 karakter; huruf dan angka saja");
  const confirm=passwordInput("Ulangi password baru");
  body.append(labelled("Password Baru",pass),labelled("Ulangi Password",confirm));
  return ()=>{
   const first=pass.value,second=confirm.value;
   if(!validatePw(first,second))return null;
   pass.value="";confirm.value="";
   return first;
  };
 }
 function openCreate(){
  const body=n("div");body.className="account-fields";
  const username=n("input");username.minLength=3;username.maxLength=32;
  username.placeholder="Contoh: katim_ppid";username.required=true;
  const getPassword=newPasswordFields(body);
  const choice=teamChooser();
  body.prepend(labelled("Username Ketua Tim",username));
  body.append(labelled("Tim yang Dikelola (centang)",choice.box));
  body.append(button("Buat Akun",()=>{
   let name;try{name=normalizeSparkUsername(username.value);}catch(e){say(e.message);return;}
   const tids=choice.get();if(!tids.length){say("Pilih minimal satu tim.");return;}
   const pw=getPassword();if(pw===null)return;
   void action(()=>createSparkKetuaAccount({username:name,password:pw,teamIds:tids}),
    "Akun Ketua Tim dibuat. Berikan password awal secara pribadi.");
  }));
  modal("Tambah Akun Ketua Tim",body);
 }
 function openEdit(account){
  const body=n("div");body.className="account-fields";
  const username=n("input");username.value=account.username;
  username.maxLength=32;username.minLength=3;
  const choice=teamChooser(account.teamIds||[]);
  const active=n("input");active.type="checkbox";active.checked=account.active;
  body.append(labelled("Username",username),labelled("Tim yang Dikelola",choice.box),
   labelled("Akun Aktif",active));
  const help=n("p","Mengubah username tidak mengubah password. Username lama berhenti berlaku setelah perubahan berhasil.");
  help.className="account-help";body.append(help);
  body.append(button("Simpan Perubahan",()=>{
   let name;try{name=normalizeSparkUsername(username.value);}catch(e){say(e.message);return;}
   const tids=choice.get();if(!tids.length){say("Pilih minimal satu tim.");return;}
   void action(()=>updateSparkAccount(account.uid,{
    username:name,teamIds:tids,active:active.checked
   }),"Username, tim, dan status akun diperbarui.");
  }));
  modal("Edit Akun "+account.username,body);
 }
 function openReset(account){
  const body=n("div");body.className="account-fields";
  const note=n("p","Admin menetapkan password pengganti untuk akun "+account.username+
   ". Username tetap sama; akses akun lama langsung dinonaktifkan. Password lama tidak dapat dilihat.");
  note.className="account-help";
  const getPassword=newPasswordFields(body);
  body.prepend(note);
  body.append(button("Tetapkan Password Baru",()=>{
   const pw=getPassword();if(pw===null)return;
   void action(()=>resetSparkAccountPassword(account.uid,pw),
    "Password baru ditetapkan untuk "+account.username+". Akses akun sebelumnya dinonaktifkan.");
  }));
  modal("Reset Password · "+account.username,body);
 }
 function openMyPassword(){
  const body=n("div");body.className="account-fields";
  const old=passwordInput("Password saat ini");old.autocomplete="current-password";
  // Password Admin lama boleh saja dibuat sebelum aturan minimum baru berlaku.
  old.removeAttribute("minlength");old.removeAttribute("pattern");
  body.append(labelled("Password Saat Ini",old));
  const getPassword=newPasswordFields(body);
  body.append(button("Ubah Password Saya",()=>{
   const next=getPassword();if(next===null)return;
   const current=old.value;old.value="";
   void action(()=>changeSparkOwnPassword(current,next),"Password akun Admin berhasil diganti.");
  }));
  modal("Ubah Password Saya",body);
 }
 async function load(){
  if(busy)return;
  status.textContent="Memuat akun dari Firestore…";
  try{
   const users=await listSparkRoleAccounts();
   const table=n("table"),thead=n("thead"),tr=n("tr");
   ["Username","Peran","Tim","Status","Tindakan"].forEach(label=>tr.append(n("th",label)));
   thead.append(tr);const body=n("tbody");
   for(const a of users){
    const row=n("tr");
    [
     a.username,a.role==="ketua_tim"?"Ketua Tim":a.role==="admin"?"Admin":"Kepala BPS",
     (a.teamIds||[]).map(teamName).join(", ")||"—",
     a.active?"Aktif":"Nonaktif"
    ].forEach(x=>row.append(n("td",x)));
    const controls=n("td");controls.className="account-actions";
    if(a.role==="ketua_tim"){
     controls.append(
      button("Edit Akun",()=>openEdit(a)),
      button("Reset Password",()=>openReset(a)),
      button(a.active?"Nonaktifkan":"Aktifkan",()=>{
       const body=n("div");
       body.append(n("p","Ubah status akun "+a.username+"?"),
        button("Konfirmasi",()=>void action(()=>
         updateSparkAccount(a.uid,{
          username:a.username,teamIds:a.teamIds,active:!a.active
         }),"Status akun diperbarui.")));
       modal("Konfirmasi Status Akun",body);
      })
     );
    }else controls.append(n("span","Dikelola melalui akun pemilik"));
    row.append(controls);body.append(row);
   }
   table.append(thead,body);listing.replaceChildren(table);
   status.textContent=users.length+" akun terdaftar · "+users.filter(a=>a.active).length+" aktif.";
  }catch{
   listing.replaceChildren();
   status.textContent="Daftar akun belum dapat dimuat. Periksa akun Admin dan aturan Firestore Spark.";
  }
 }
 add.disabled=!safeTeams.length;
 if(!safeTeams.length)status.textContent="Daftar tim belum tersedia.";
 void load();
 return section;
}
