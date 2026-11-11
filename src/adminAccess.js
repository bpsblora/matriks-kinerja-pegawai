import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase/client.js";
import ref from "./data/reference2026.json";

export function createAccessAdminView(teams = [], options = {}) {
  const el=document.createElement("section");
  el.className="admin-access";
  el.innerHTML='<div class="admin-access-heading"><div><span class="admin-access-eyebrow">PENGELOLAAN AKUN · KHUSUS ADMIN</span><h2>Kelola Akun Akses</h2><p>Buat akun Ketua Tim, tentukan tim, dan kelola status serta password. Semua perubahan diverifikasi server.</p></div><div class="actions"><button id="aAdd" type="button">+ Tambah Akun</button><button id="aReload" class="secondary" type="button">Muat Ulang</button></div></div><p id="aMsg" class="admin-access-message" role="status" aria-live="polite"></p><div id="aList" class="table-wrap"></div><dialog id="aDlg" class="account-dialog"></dialog>';
  const msg=el.querySelector("#aMsg"),list=el.querySelector("#aList"),dlg=el.querySelector("#aDlg");
  // In the GitHub Pages shell, the approved role session uses a separate
  // Firebase Auth instance; never send Admin calls with the Google viewer.
  const roleFunctions=options.functionsClient||functions;
  const api=name=>httpsCallable(roleFunctions,name,{timeout:30000});
  const calls={list:api("listAccessAccounts"),create:api("createAccessAccount"),update:api("updateAccessAccount"),reset:api("resetAccessPassword"),status:api("setAccessAccountStatus")};
  const E=(t,x)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;return n;};
  const B=(txt,fn)=>{const b=E("button",txt);b.type="button";b.onclick=fn;return b;};
  const L=(name,x)=>{const a=E("label",name);a.className="account-field";a.append(x);return a;};
  const P=()=>{const x=E("input");x.type="password";x.placeholder="12–72 byte, jangan gunakan password Google";x.autocomplete="new-password";x.required=true;return x;};
  const passwordOk=value=>{const bytes=new TextEncoder().encode(value).length;return bytes>=12&&bytes<=72;};
  const availableTeams=(Array.isArray(teams)&&teams.length?teams:ref.teams).filter(t=>t.active!==false)
   .slice().sort((a,b)=>a.name.localeCompare(b.name,"id"));
  const teamName=id=>availableTeams.find(t=>t.id===id)?.name||id;
  const modal=(title,body)=>{dlg.replaceChildren(E("h2",title),body,B("Batal",()=>dlg.close()));dlg.showModal();};
  async function save(fn,payload){
    msg.textContent="Menyimpan perubahan akun…";
    try{await fn(payload);dlg.close();msg.textContent="Perubahan akun tersimpan di server.";await load();}
    catch(e){msg.textContent="Gagal menyimpan: "+(e?.message||"Akses ditolak oleh server.");}
  }
  function validateAccount(values,password=null){
    if(!/^[a-z][a-z0-9._-]{2,31}$/.test(values.username))return "Username harus 3–32 karakter, dimulai huruf dan hanya berisi huruf, angka, titik, _ atau -.";
    if(values.role==="ketua_tim"&&values.teamIds.length===0)return "Pilih minimal satu tim untuk Ketua Tim.";
    if(password!==null&&!passwordOk(password))return "Password harus berukuran 12–72 byte.";
    return "";
  }
  function form(a={}) {
    const body=E("div");body.className="account-fields";
    const name=E("input");name.value=a.username||"";name.maxLength=32;
    name.minLength=3;name.required=true;name.autocomplete="off";
    name.placeholder="Contoh: katim_ppid";
    const role=E("select");
    // Initial Admin is bootstrapped by a trusted operator. Account manager
    // creates Ketua Tim; existing elevated profiles remain visible for editing
    // but cannot be promoted unless the server explicitly allows it.
    const roleOptions=a.role&&a.role!=="ketua_tim"?
     [[a.role,a.role==="admin"?"Admin":"Kepala BPS"],["ketua_tim","Ketua Tim"]]:
     [["ketua_tim","Ketua Tim"]];
    roleOptions.forEach(([v,t])=>{const o=E("option",t);o.value=v;role.append(o);});
    role.value=a.role||"ketua_tim";
    const teamGroup=E("div");teamGroup.className="account-team-checks";
    const selected=new Set(a.teamIds||[]);
    for(const t of availableTeams){
     const label=E("label");label.className="account-team-option";
     const check=E("input");check.type="checkbox";check.value=t.id;check.checked=selected.has(t.id);
     label.append(check,E("span",t.name));teamGroup.append(label);
    }
    const teamLabel=L("Tim yang Dikelola (centang)",teamGroup);
    const tip=E("p","Ketua Tim dapat memiliki lebih dari satu tim. Setiap tim membatasi akses data di backend.");
    tip.className="account-help";
    const syncRole=()=>{teamLabel.hidden=role.value!=="ketua_tim";tip.hidden=role.value!=="ketua_tim";};
    role.onchange=syncRole;syncRole();
    body.append(L("Username",name),L("Peran",role),teamLabel,tip);
    return {body,values:()=>({username:name.value.trim().toLowerCase(),role:role.value,teamIds:role.value==="ketua_tim"?[...teamGroup.querySelectorAll("input:checked")].map(x=>x.value):[]})};
  }
  el.querySelector("#aAdd").onclick=()=>{
    const f=form(),pass=P();
    f.body.append(L("Password Awal",pass),B("Buat Akun Ketua Tim",()=>{
      const values=f.values(),pw=pass.value,err=validateAccount(values,pw);
      if(err){msg.textContent=err;return;}
      pass.value="";void save(calls.create,{...values,password:pw});
    }));
    modal("Tambah Akun Ketua Tim",f.body);
  };
  async function load(){msg.textContent="Memuat akun…";list.replaceChildren();
    try {const out=await calls.list({});const accounts=out.data?.accounts||[];
      const tbl=E("table"),h=E("tr");["Username","Peran","Tim","Status","Tindakan"].forEach(x=>h.append(E("th",x)));const head=E("thead");head.append(h);tbl.append(head);
      const body=E("tbody");
      for (const a of accounts){const row=E("tr");[a.username,a.role,(a.teamIds||[]).map(teamName).join(", ")||"—",a.active?"Aktif":"Nonaktif"].forEach(x=>row.append(E("td",String(x))));
        const cell=E("td");cell.className="account-actions";
        cell.append(B("Edit",()=>{const f=form(a);f.body.append(B("Simpan Perubahan",()=>{const v=f.values(),err=validateAccount(v);if(err){msg.textContent=err;return;}void save(calls.update,{uid:a.uid,...v});}));modal("Edit Akun",f.body);}),
          B("Reset Password",()=>{const p=P(),d=E("div");d.append(L("Password baru",p),B("Simpan",()=>{const pw=p.value;p.value="";if(!passwordOk(pw)){msg.textContent="Password harus 12–72 byte.";return;}void save(calls.reset,{uid:a.uid,password:pw});}));modal("Reset Password",d);}),
          B(a.active?"Nonaktifkan":"Aktifkan",()=>{const d=E("div");d.append(E("p","Ubah status akun "+a.username+"?"),B("Konfirmasi",()=>void save(calls.status,{uid:a.uid,active:!a.active})));modal("Konfirmasi",d);}));
        row.append(cell);body.append(row);}
      tbl.append(body);list.replaceChildren(tbl);msg.textContent=accounts.length+" akun terdaftar · "+accounts.filter(a=>a.active).length+" aktif.";
    }catch{msg.textContent="Backend akun belum aktif. Tidak ada data diubah.";}
  }
  el.querySelector("#aReload").onclick=()=>void load();void load();
  return el;
}
