import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase/client.js";
import ref from "./data/reference2026.json";

export function createAccessAdminView(teams = []) {
  const el=document.createElement("section");
  el.className="admin-access";
  el.innerHTML='<h2>Kelola Akun Akses</h2><p>Admin dapat mengelola akun peran, username, password dan tim kerja.</p><div class="actions"><button id="aAdd">+ Tambah Akun</button><button id="aReload" class="secondary">Muat Ulang</button></div><p id="aMsg"></p><div id="aList" class="table-wrap"></div><dialog id="aDlg" class="account-dialog"></dialog>';
  const msg=el.querySelector("#aMsg"),list=el.querySelector("#aList"),dlg=el.querySelector("#aDlg");
  const api=name=>httpsCallable(functions,name,{timeout:30000});
  const calls={list:api("listAccessAccounts"),create:api("createAccessAccount"),update:api("updateAccessAccount"),reset:api("resetAccessPassword"),status:api("setAccessAccountStatus")};
  const E=(t,x)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;return n;};
  const B=(txt,fn)=>{const b=E("button",txt);b.type="button";b.onclick=fn;return b;};
  const L=(name,x)=>{const a=E("label",name);a.className="account-field";a.append(x);return a;};
  const P=()=>{const x=E("input");x.type="password";x.placeholder="Minimal 12 karakter";x.autocomplete="new-password";return x;};
  const modal=(title,body)=>{dlg.replaceChildren(E("h2",title),body,B("Batal",()=>dlg.close()));dlg.showModal();};
  async function save(fn,payload){try{await fn(payload);dlg.close();await load();}catch(e){msg.textContent=e.message||"Tindakan ditolak.";} }
  function form(a={}) {
    const body=E("div");body.className="account-fields";
    const name=E("input");name.value=a.username||"";name.maxLength=32;
    const role=E("select");
    [["ketua_tim","Ketua Tim"],["admin","Admin"],["kepala","Kepala BPS"]].forEach(([v,t])=>{const o=E("option",t);o.value=v;role.append(o);});
    role.value=a.role||"ketua_tim";
    const teamSelect=E("select");teamSelect.multiple=true;teamSelect.size=5;
    (Array.isArray(teams)&&teams.length ? teams : ref.teams).forEach(t=>{const o=E("option",t.name);o.value=t.id;o.selected=a.teamIds?.includes(t.id)||false;teamSelect.append(o);});
    body.append(L("Username",name),L("Peran",role),L("Tim (pilih beberapa dengan Ctrl+klik)",teamSelect));
    return {body,values:()=>({username:name.value.trim(),role:role.value,teamIds:[...teamSelect.selectedOptions].map(x=>x.value)})};
  }
  el.querySelector("#aAdd").onclick=()=>{const f=form(),pass=P();f.body.append(L("Password awal",pass),B("Buat Akun",()=>{const pw=pass.value;pass.value="";if(pw.length<12){msg.textContent="Password minimal 12 karakter";return;}void save(calls.create,{...f.values(),password:pw});}));modal("Tambah Akun Akses",f.body);};
  async function load(){msg.textContent="Memuat akun…";list.replaceChildren();
    try {const out=await calls.list({});const accounts=out.data?.accounts||[];
      const tbl=E("table"),h=E("tr");["Username","Peran","Tim","Status","Tindakan"].forEach(x=>h.append(E("th",x)));const head=E("thead");head.append(h);tbl.append(head);
      const body=E("tbody");
      for (const a of accounts){const row=E("tr");[a.username,a.role,(a.teamIds||[]).join(", ")||"—",a.active?"Aktif":"Nonaktif"].forEach(x=>row.append(E("td",String(x))));
        const cell=E("td");cell.className="account-actions";
        cell.append(B("Edit",()=>{const f=form(a);f.body.append(B("Simpan",()=>void save(calls.update,{uid:a.uid,...f.values()})));modal("Edit Akun",f.body);}),
          B("Reset Password",()=>{const p=P(),d=E("div");d.append(L("Password baru",p),B("Simpan",()=>{const pw=p.value;p.value="";if(pw.length<12)return;void save(calls.reset,{uid:a.uid,password:pw});}));modal("Reset Password",d);}),
          B(a.active?"Nonaktifkan":"Aktifkan",()=>{const d=E("div");d.append(E("p","Ubah status akun "+a.username+"?"),B("Konfirmasi",()=>void save(calls.status,{uid:a.uid,active:!a.active})));modal("Konfirmasi",d);}));
        row.append(cell);body.append(row);}
      tbl.append(body);list.replaceChildren(tbl);msg.textContent=accounts.length+" akun ditemukan.";
    }catch{msg.textContent="Backend akun belum aktif. Tidak ada data diubah.";}
  }
  el.querySelector("#aReload").onclick=()=>void load();void load();
  return el;
}
