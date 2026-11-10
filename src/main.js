import "./style.css";
import "./liveMatrix.css";
import "./adminAccess.css";
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signInWithCustomToken, signOut } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth, functions } from "./firebase/client.js";
import { createAccessAdminView } from "./adminAccess.js";
import ref from "./data/reference2026.json";
import { createReference2026View } from "./reference2026.js";
import { createLiveMatrixWorkspace } from "./liveMatrix.js";

/*
 * Two-stage DEV authentication preview:
 * 1) Google office viewer: VIEW ONLY.
 * 2) Server-verified per-role password: another Firebase identity with scoped
 *    access (not yet implemented in firestore.rules). No editor permissions here.
 *
 * Current requested single-office-account model is documented as HIGH RISK:
 * sharing the Firebase owner's Google password grants access outside the app.
 * This is a DISABLED DEV preview; cannot be treated as production approval.
 * Never identify a user by a role button alone.
 */
const viewerUid = import.meta.env.VITE_VIEWER_GOOGLE_UID || "";
const roleLoginReady = import.meta.env.VITE_ROLE_AUTH_READY === "true";
const matrixBackendReady = import.meta.env.VITE_MATRIX_BACKEND_READY === "true";
const accountsReady = roleLoginReady && import.meta.env.VITE_ACCESS_ADMIN_READY === "true";
const roleApp = roleLoginReady ? initializeApp(app.options,"matriks-role-session") : null;
const roleAuth = roleApp ? getAuth(roleApp) : null;
const roleFunctions = roleApp ? getFunctions(roleApp,import.meta.env.VITE_FIREBASE_FUNCTION_REGION||"us-central1") : null;
const root = document.querySelector("#app");
const container = document.createElement("main");
container.className = "container";
const badge = document.createElement("div");
badge.className = "eyebrow";
badge.textContent = "BPS KABUPATEN BLORA · LINGKUNGAN PENGUJIAN";
const header = document.createElement("h1");
header.textContent = "Matriks Kinerja Pegawai";
const intro = document.createElement("p");
intro.textContent = "Masuk dengan akun Google yang ditentukan kantor untuk melihat data. Untuk mengelola matriks, diperlukan akun peran tambahan.";

const googlePanel = document.createElement("section");
const googleText = document.createElement("p");
googleText.textContent = "Tahap 1 — Masuk menggunakan Gmail BPS Blora untuk Mode Lihat.";
const googleButton = document.createElement("button");
googleButton.type = "button";
googleButton.textContent = "Masuk dengan Google BPS Blora";
const googleWarning = document.createElement("p");
googleWarning.className = "warning";
googleWarning.textContent = "Catatan: akun Gmail ini juga mengelola Firebase. Membagikan sandinya dapat memberi akses ke layanan Google dan cloud di luar website. Untuk saat ini Mode Lihat belum diaktifkan bagi data asli.";
googlePanel.append(googleText, googleButton, googleWarning);

const viewerPanel = document.createElement("section");
const viewerHeading = document.createElement("h2");
viewerHeading.textContent = "Mode Lihat";
const viewerText = document.createElement("p");
viewerText.textContent = "Tampilan referensi Matriks 2026 tersedia dalam bentuk anonim. Data operasional belum dimigrasikan ke Firestore.";
const viewerNote = document.createElement("p");
viewerNote.className = "warning";
viewerNote.textContent = "Mode Lihat belum aktif: Rules Firestore masih deny-all sampai diuji.";
const viewerReference = createReference2026View();
const viewerMatrix = document.createElement("div");
viewerMatrix.className = "mx-workspace";
viewerPanel.append(viewerHeading, viewerText, viewerNote, viewerReference, viewerMatrix);

const roleForm = document.createElement("form");
roleForm.className = "login-form";
const roleHeading = document.createElement("h2");
roleHeading.textContent = "Masuk untuk Mengelola";
const roleInfo = document.createElement("p");
roleInfo.textContent = "Gunakan username/password peran dari Admin (misalnya ketua tim tertentu, admin, atau kepala).";
const userLabel = document.createElement("label");
userLabel.textContent = "Username peran";
const username = document.createElement("input");
username.required = true;
username.minLength = 3;
username.maxLength = 32;
username.autocomplete = "username";
username.placeholder = "Misalnya: katim_neraca";
userLabel.append(username);
const passLabel = document.createElement("label");
passLabel.textContent = "Password peran";
const password = document.createElement("input");
password.type = "password";
password.required = true;
password.autocomplete = "current-password";
password.placeholder = "Password yang ditetapkan Admin";
passLabel.append(password);
const roleButton = document.createElement("button");
roleButton.type = "submit";
roleButton.textContent = "Masuk dengan Peran";
roleForm.append(roleHeading, roleInfo, userLabel, passLabel, roleButton);

const privilegedPanel = document.createElement("section");
const privilegedHeading = document.createElement("h2");
privilegedHeading.textContent = "Sesi Peran";
const privilegedText = document.createElement("p");
const liveWorkspace = document.createElement("div");
liveWorkspace.className = "mx-workspace";
privilegedPanel.append(privilegedHeading, privilegedText, liveWorkspace);
const status = document.createElement("section");
status.className = "status";
const statusHeading = document.createElement("h2");
const statusText = document.createElement("p");
const accountInfo = document.createElement("div");
accountInfo.className = "auth-account-info";
status.append(statusHeading, statusText, accountInfo);
const exitButton = document.createElement("button");
exitButton.type = "button";
exitButton.className = "secondary";
exitButton.textContent = "Keluar Google";
const exitRoleButton = document.createElement("button");
exitRoleButton.type="button";
exitRoleButton.className="secondary";
exitRoleButton.textContent="Keluar Peran · Kembali ke Mode Lihat";
const footer = document.createElement("div");
footer.className = "meta";
footer.textContent = "Firebase Preview: login Google terverifikasi · Data referensi anonim. Firestore langsung tetap ditutup; database peran baru digunakan setelah backend server disiapkan dan diaktifkan.";
container.append(badge, header, intro, googlePanel, viewerPanel, roleForm, privilegedPanel, status, exitRoleButton, exitButton, footer);
const publicDemo = document.createElement("a");
publicDemo.className = "demo-link";
publicDemo.href = "./demo.html";
publicDemo.textContent = "Lihat referensi Matriks 2026 tanpa login (data anonim)";
container.insertBefore(publicDemo, status);
root.replaceChildren(container);

const roleLogin = httpsCallable(functions, "usernameSignIn", {timeout: 30000});
const getAccessContext = roleFunctions ? httpsCallable(roleFunctions, "getAccessContext", {timeout: 30000}) : null;
let signedMode = "none";
function report(title, detail, tone = "") {
  statusHeading.textContent = title;
  statusText.textContent = detail;
  statusText.className = tone;
  accountInfo.replaceChildren();
}
function showPendingGoogle(user) {
  render("pending");
  report(
    "Akun Google berhasil diverifikasi",
    "Identitas Google sudah terhubung ke Firebase Authentication. Agar akun BPS Blora ini dapat memasuki Mode Lihat, pengelola perlu menetapkan UID sebagai akun viewer."
  );
  const label = document.createElement("p");
  label.className = "meta";
  label.textContent = "Email terdeteksi: " + (user.email || "tidak tersedia");
  const uid = document.createElement("code");
  uid.textContent = user.uid;
  const detail = document.createElement("p");
  detail.className = "meta";
  detail.textContent = "UID Firebase: ";
  detail.append(uid);
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "secondary";
  copy.textContent = "Salin UID";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(user.uid);
      copy.textContent = "UID Disalin";
    } catch {
      copy.textContent = "Pilih teks UID untuk menyalin";
    }
  });
  const guide = document.createElement("p");
  guide.className = "meta";
  guide.textContent = "UID bukan password atau token. Akun selain UID yang disetujui tidak mendapatkan akses Mode Lihat. Login peran tetap belum aktif.";
  accountInfo.append(label, detail, copy, guide);
}
function mountViewerMatrix() {
  viewerMatrix.replaceChildren();
  viewerReference.hidden = matrixBackendReady;
  if (matrixBackendReady) {
    viewerText.textContent = "Matriks bersama dibaca melalui layanan server Firebase. Akun Google hanya dapat melihat.";
    viewerNote.textContent = "Mode Lihat: tidak mempunyai izin tambah, ubah, hapus, atau finalisasi.";
    viewerMatrix.append(createLiveMatrixWorkspace({role:"viewer",teamIds:[],username:"Mode Lihat"}));
  } else {
    viewerText.textContent = "Data referensi 2026 masih anonim; database operasional belum diaktifkan.";
    viewerNote.textContent = "Sementara tersedia tampilan referensi. Pengaktifan data bersama harus melalui pemeriksaan backend dan persetujuan pengelola.";
  }
}
function render(mode, busy = false) {
  signedMode = mode;
  container.classList.toggle("live-expanded", mode === "role");
  if (mode !== "role") liveWorkspace.replaceChildren();
  if (mode === "viewer") mountViewerMatrix();
  else viewerMatrix.replaceChildren();
  googlePanel.hidden = mode !== "none";
  viewerPanel.hidden = mode !== "viewer";
  roleForm.hidden = mode !== "viewer";
  privilegedPanel.hidden = mode !== "role";
  exitButton.hidden = mode === "none";
  exitRoleButton.hidden = mode !== "role";
  exitRoleButton.disabled=busy;
  googleButton.disabled = busy;
  roleButton.disabled = busy || !roleLoginReady;
  exitButton.disabled = busy;
  if (mode === "viewer" && !roleLoginReady) {
    report("Google masuk — Mode Lihat", matrixBackendReady ? "Data bersama hanya dapat dibaca. Untuk mengelola matriks diperlukan akun peran terverifikasi." : "Referensi anonim 2026 tersedia. Backend bersama dan login peran belum diaktifkan.");
  } else if (mode === "role") {
    report("Sesi peran terverifikasi", "Hak akses setiap menu ditentukan server berdasarkan akun, tim, dan status tahun. Firestore langsung tetap tertutup.");
  } else if (mode === "none") {
    report("Masuk melalui Google", "Khusus pengujian: satu akun Google BPS Blora. Gunakan data fiktif; berbagi Gmail pemilik Firebase membawa risiko akses cloud di luar aplikasi.");
  }
}

googleButton.addEventListener("click", async () => {
  googleButton.disabled = true;
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    if (!viewerUid || result.user.uid !== viewerUid) {
      showPendingGoogle(result.user);
    }
  } catch (error) {
    const reason = error?.code === "auth/unauthorized-domain"
      ? "Alamat preview Firebase belum masuk Authorized domains. Tambahkan hostname preview di Firebase Console → Authentication → Settings → Authorized domains."
      : error?.code === "auth/popup-blocked"
      ? "Browser memblokir pop-up Google. Izinkan pop-up untuk alamat preview ini."
      : "Periksa akun Google dan konfigurasi Authentication. Kode: " + (error?.code || "tidak diketahui");
    report("Login Google belum berhasil", reason, "error");
  } finally {
    googleButton.disabled = false;
  }
});
// Google BPS Blora always remains the view identity, even after a role login.
// Admin/Ketua sessions live in a separate Firebase Auth instance.
function approvedGoogle(){
 return !!viewerUid && auth.currentUser?.uid===viewerUid;
}
async function mountVerifiedRole(){
 if(!approvedGoogle()||!roleAuth?.currentUser||!getAccessContext)return false;
 try{
  const reply=await getAccessContext({});
  const profile=reply?.data;
  if(profile?.mode!=="role"||profile?.active!==true||!["admin","ketua_tim","kepala"].includes(profile.role))
   throw new Error("Akun peran tidak valid.");
  if(profile.role==="ketua_tim"&&(!Array.isArray(profile.teamIds)||!profile.teamIds.length))
   throw new Error("Akun Ketua Tim tidak memiliki tim.");
  render("role");
  privilegedHeading.textContent="Login Sesuai Peran";
  privilegedText.textContent="Username: "+profile.username+" · Peran: "+profile.role+
   " · Tim: "+(profile.teamIds||[]).join(", ");
  if(matrixBackendReady) {
   liveWorkspace.replaceChildren(createLiveMatrixWorkspace({
    role:profile.role,teamIds:profile.teamIds||[],username:profile.username
   },{functionsClient:roleFunctions}));
  }else if(profile.role==="admin"&&accountsReady){
   // Account creation is independent of the future shared Matrix database.
   liveWorkspace.replaceChildren(createAccessAdminView(ref.teams,{functionsClient:roleFunctions}));
  }else{
   const note=document.createElement("p");
   note.className="warning";
   note.textContent="Akun peran terverifikasi. Database matriks bersama belum diaktifkan oleh pengelola.";
   liveWorkspace.replaceChildren(note);
  }
  return true;
 }catch{
  await signOut(roleAuth).catch(()=>{});
  render("viewer");
  report("Sesi peran belum diizinkan","Gunakan akun peran aktif sesuai tim yang telah ditetapkan Admin.","error");
  return false;
 }
}
roleForm.addEventListener("submit", async event=>{
 event.preventDefault();
 if(!roleLoginReady||signedMode!=="viewer"||!approvedGoogle()||!roleAuth)return;
 const chosenUsername=username.value.trim().toLowerCase();
 const enteredPassword=password.value;
 password.value="";
 roleButton.disabled=true;
 try{
  const response=await roleLogin({username:chosenUsername,password:enteredPassword});
  if(typeof response?.data?.token!=="string")throw new Error("Login peran belum tersedia.");
  await signInWithCustomToken(roleAuth,response.data.token);
  if(!await mountVerifiedRole())throw new Error("Peran belum terdaftar.");
 }catch{
  render("viewer");
  report("Login peran ditolak","Username/password tidak cocok, atau layanan pengelola belum aktif.","error");
 }finally{roleButton.disabled=!roleLoginReady;}
});
exitRoleButton.addEventListener("click",async()=>{
 if(roleAuth)await signOut(roleAuth).catch(()=>{});
 render("viewer");
});
exitButton.addEventListener("click",async()=>{
 if(roleAuth)await signOut(roleAuth).catch(()=>{});
 await signOut(auth).catch(()=>{});
 render("none");
});
onAuthStateChanged(auth,async user=>{
 if(!user){
  if(roleAuth)await signOut(roleAuth).catch(()=>{});
  render("none");return;
 }
 try{
  const token=await user.getIdTokenResult();
  if(auth.currentUser?.uid!==user.uid)return;
  if(token.signInProvider!=="google.com"||!viewerUid||user.uid!==viewerUid||
     token.claims?.email_verified!==true){
   if(roleAuth)await signOut(roleAuth).catch(()=>{});
   showPendingGoogle(user);return;
  }
  if(roleAuth)await roleAuth.authStateReady();
  if(!roleAuth?.currentUser||!await mountVerifiedRole())render("viewer");
 }catch{
  if(roleAuth)await signOut(roleAuth).catch(()=>{});
  render("viewer");
 }
});
