import "./style.css";
import "./liveMatrix.css";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithCustomToken, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase/client.js";
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
exitButton.textContent = "Keluar";
const footer = document.createElement("div");
footer.className = "meta";
footer.textContent = "Firebase Preview: login Google terverifikasi · Data referensi anonim. Firestore langsung tetap ditutup; database peran baru digunakan setelah backend server disiapkan dan diaktifkan.";
container.append(badge, header, intro, googlePanel, viewerPanel, roleForm, privilegedPanel, status, exitButton, footer);
const publicDemo = document.createElement("a");
publicDemo.className = "demo-link";
publicDemo.href = "./demo.html";
publicDemo.textContent = "Lihat referensi Matriks 2026 tanpa login (data anonim)";
container.insertBefore(publicDemo, status);
root.replaceChildren(container);

const roleLogin = httpsCallable(functions, "usernameSignIn", {timeout: 30000});
const getAccessContext = httpsCallable(functions, "getAccessContext", {timeout: 30000});
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
roleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!roleLoginReady || signedMode !== "viewer" || auth.currentUser?.uid !== viewerUid) return;
  const chosenUsername = username.value.trim().toLowerCase();
  const enteredPassword = password.value;
  password.value = "";
  roleButton.disabled = true;
  try {
    const response = await roleLogin({username:chosenUsername, password:enteredPassword});
    if (typeof response?.data?.token !== "string") throw new Error("missing-token");
    await signInWithCustomToken(auth, response.data.token);
  } catch {
    report("Login peran ditolak", "Username/password tidak sesuai atau layanan pengelola belum tersedia.", "error");
  } finally {
    roleButton.disabled = !roleLoginReady;
  }
});
exitButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    // Google viewer login and the role session are separate; logout requires
    // authenticating again through the Google gate.
  } catch {
    report("Gagal keluar", "Silakan coba kembali.", "error");
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    render("none");
    return;
  }
  try {
    const token = await user.getIdTokenResult();
    if (auth.currentUser?.uid !== user.uid) return;
    const provider = token.signInProvider;
    if (provider === "google.com") {
      if (viewerUid && user.uid === viewerUid && token.claims?.email_verified === true) {
        render("viewer");
      } else {
        showPendingGoogle(user);
      }
      return;
    }
    if (provider === "custom" && roleLoginReady) {
      // Frontend never trusts its own role buttons or a custom token alone.
      // Only the trusted backend can validate an active role and team scope.
      const response = await getAccessContext({});
      if (auth.currentUser?.uid !== user.uid) return;
      const profile = response?.data;
      if (profile?.mode !== "role" || !profile.active) throw Error("role-not-authorized");
      render("role");
      privilegedText.textContent = "Akun peran: " + profile.username + " · Peran: " + profile.role + " · Tim: " + (profile.teamIds||[]).join(", ");
      liveWorkspace.replaceChildren(createLiveMatrixWorkspace({
        role: profile.role, teamIds: profile.teamIds || [], username: profile.username || "akun_peran"
      }));
      return;
    }
    await signOut(auth);
    report("Akses ditolak", "Identitas akun tidak sesuai dengan kebijakan akses kantor.", "warning");
  } catch {
    await signOut(auth).catch(() => {});
    report("Sesi belum dapat diverifikasi", "Silakan login kembali.", "error");
  }
});
