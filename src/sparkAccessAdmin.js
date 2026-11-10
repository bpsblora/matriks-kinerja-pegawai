/* Admin-managed Ketua Tim accounts on Firebase Spark, no Cloud Functions.
 * Every account change is authorized by Firestore Security Rules and uses the
 * active ADMIN Auth session, never the shared Google viewer identity.
 */
import {
 listSparkRoleAccounts,createSparkKetuaAccount,updateSparkAccount,
 changeSparkOwnPassword,normalizeSparkUsername
} from "./sparkRoleAuth.js";

const n=(tag,value)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;return el;};
const button=(title,cb)=>{const b=n("button",title);b.type="button";b.addEventListener("click",cb);return b;};
function labelled(label,input){const wrap=n("label",label);wrap.className="account-field";wrap.append(input);return wrap;}
function passwordInput(placeholder){
 const i=n("input");i.type="password";i.required=true;
 i.autocomplete="new-password";i.placeholder=placeholder;return i;
}
export function createSparkAccessAdminView(teams=[]){
 const section=n("section");section.className="admin-access";
 const head=n("div");head.className="admin-access-heading";
 const title=n("div");title.append(n("span","PENGELOLAAN AKUN · SPARK GRATIS"),n("h2","Kelola Akun Akses"),
  n("p","Admin menambah akun Ketua Tim dan menetapkan tim. Data disimpan di Firebase Authentication dan Firestore."));
 title.firstChild.className="admin-access-eyebrow";
 const actions=n("div");actions.className="actions";
 const add=button("+ Tambah Akun Ketua Tim",()=>openCreate());
 const reload=button("↻ Muat Ulang",()=>load());reload.className="secondary";
 const mine=button("Ubah Password Saya",()=>openMyPassword());mine.className="secondary";
 actions.append(add,reload,mine);head.append(title,actions);
 const status=n("p");status.className="admin-access-message";status.setAttribute("role","status");
 const listing=n("div");listing.className="table-wrap";
 const dialog=n("dialog");dialog.className="account-dialog";
 const safeTeams=(teams||[]).filter(t=>t.active!==false).slice()
   .sort((a,b)=>String(a.name).localeCompare(String(b.name),"id"));
 const teamName=id=>safeTeams.find(t=>t.id===id)?.name||id;
 section.append(head,status,listing,dialog);
 let busy=false;
 function say(message){status.textContent=message;}
 function modal(title,body){
  const h=n("h2",title),cancel=button("Batal",()=>dialog.close());
  cancel.className="secondary";
  dialog.replaceChildren(h,body,cancel);
  if(!dialog.open)dialog.showModal();
 }
 function teamChooser(selected=[]){
  const box=n("div");box.className="account-team-checks";
  for(const t of safeTeams){
   const label=n("label");label.className="account-team-option";
   const check=n("input");check.type="checkbox";check.value=t.id;
   check.checked=selected.includes(t.id);
   label.append(check,n("span",t.name));box.append(label);
  }
  return {box,get:()=>[...box.querySelectorAll("input:checked")].map(c=>c.value)};
 }
 async function action(fn,success){
  if(busy)return;busy=true;
  try{
   say("Memproses permintaan melalui Firebase…");
   await fn();dialog.close();say(success);await load();
  }catch(e){say("Gagal: "+(e?.message||"Periksa izin akses dan koneksi Firebase."));}
  finally{busy=false;}
 }
 function openCreate(){
  const body=n("div");body.className="account-fields";
  const username=n("input");username.minLength=3;username.maxLength=32;
  username.placeholder="misalnya katim_ppid";username.required=true;
  const password=passwordInput("12–72 byte; jangan pakai password Google");
  const choice=teamChooser();
  body.append(labelled("Username Ketua Tim",username),labelled("Password Awal",password),
    labelled("Tim yang Dikelola (centang)",choice.box));
  body.append(button("Buat Akun Ketua Tim",()=>{
   let name;try{name=normalizeSparkUsername(username.value);}catch(e){say(e.message);return;}
   const pass=password.value,tids=choice.get();password.value="";
   if(!tids.length){say("Pilih minimal satu tim.");return;}
   void action(()=>createSparkKetuaAccount({username:name,password:pass,teamIds:tids}),
    "Akun Ketua Tim dibuat. Informasikan password awal secara pribadi.");
  }));
  modal("Tambah Akun Ketua Tim",body);
 }
 function openEdit(account){
  const body=n("div");body.className="account-fields";
  const username=n("input");username.value=account.username;username.disabled=true;
  const choice=teamChooser(account.teamIds||[]);
  const active=n("input");active.type="checkbox";active.checked=account.active;
  body.append(labelled("Username (tetap)",username),
   labelled("Tim yang Dikelola",choice.box),labelled("Akun Aktif",active));
  body.append(button("Simpan Perubahan",()=>{
   const tids=choice.get();
   if(!tids.length){say("Pilih minimal satu tim.");return;}
   void action(()=>updateSparkAccount(account.uid,{teamIds:tids,active:active.checked}),
    "Pengaturan akun diperbarui.");
  }));
  modal("Edit Akun "+account.username,body);
 }
 function openMyPassword(){
  const body=n("div");body.className="account-fields";
  const old=passwordInput("Password sekarang");
  old.autocomplete="current-password";
  const next=passwordInput("Password baru: minimal 12 karakter");
  body.append(labelled("Password Saat Ini",old),labelled("Password Baru",next),
   button("Ubah Password Saya",()=>{
    const oldPwd=old.value,newPwd=next.value;old.value="";next.value="";
    void action(()=>changeSparkOwnPassword(oldPwd,newPwd),"Password akun ini berhasil diperbarui.");
   }));
  modal("Ubah Password Admin",body);
 }
 async function load(){
  if(busy)return;
  say("Memuat akun dari Firestore…");
  try{
   const users=await listSparkRoleAccounts();
   const table=n("table");const thead=n("thead"),tr=n("tr");
   ["Username","Peran","Tim","Status","Tindakan"].forEach(label=>tr.append(n("th",label)));
   thead.append(tr);const body=n("tbody");
   for(const a of users){
    const row=n("tr");
    const cells=[a.username,a.role==="ketua_tim"?"Ketua Tim":a.role==="admin"?"Admin":"Kepala BPS",
      (a.teamIds||[]).map(teamName).join(", ")||"—",a.active?"Aktif":"Nonaktif"];
    cells.forEach(x=>row.append(n("td",x)));
    const tools=n("td");tools.className="account-actions";
    if(a.role==="ketua_tim"){
     tools.append(button("Edit Tim",()=>openEdit(a)),
      button(a.active?"Nonaktifkan":"Aktifkan",()=>{
       const body=n("div");body.append(n("p","Ubah status akun "+a.username+"?"),
        button("Konfirmasi",()=>void action(()=>
         updateSparkAccount(a.uid,{teamIds:a.teamIds,active:!a.active}),
          "Status akun diperbarui.")));
       modal("Konfirmasi Status Akun",body);
      }));
    }else tools.append(n("span","Dikelola dari Firebase Console"));
    row.append(tools);body.append(row);
   }
   table.append(thead,body);listing.replaceChildren(table);
   say(users.length+" akun terdaftar · "+users.filter(a=>a.active).length+" aktif.");
  }catch(e){listing.replaceChildren();say("Tidak dapat memuat akun. Periksa hak Admin dan Firestore Rules Spark.");}
 }
 add.disabled=!safeTeams.length;
 if(!safeTeams.length)say("Daftar tim belum tersedia.");
 void load();
 return section;
}
