import "./style.css";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithCustomToken, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase/client.js";

/*
 * Two-stage DEV authentication preview:
 * 1) Google office viewer: VIEW ONLY.
 * 2) Server-verified per-role password: another Firebase identity with scoped
 *    access (not yet implemented in firestore.rules). No editor permissions here.
 *
 * The project owner's Google account should NOT be a shared viewer account.
 * Never identify a user by a role button alone.
 */
const viewerUid = import.meta.env.VITE_VIEWER_GOOGLE_UID || "";
const roleLoginReady = import.meta.env.VITE_ROLE_AUTH_READY === "true";
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
googleText.textContent = "Tahap 1 — Masuk dengan akun Google khusus akses lihat.";
const googleButton = document.createElement("button");
googleButton.type = "button";
googleButton.textContent = "Masuk dengan Google BPS Blora";
googlePanel.append(googleText, googleButton);

const viewerPanel = document.createElement("section");
const viewerHeading = document.createElement("h2");
viewerHeading.textContent = "Mode Lihat";
const viewerText = document.createElement("p");
viewerText.textContent = "Akun Google dikenali. Hak akses hanya untuk melihat data yang disetujui. Data Matriks 2026/2027 belum dipindahkan ke Firestore.";
const viewerNote = document.createElement("p");
viewerNote.className = "warning";
viewerNote.textContent = "Mode Lihat belum aktif: Rules Firestore masih deny-all sampai diuji.";
viewerPanel.append(viewerHeading, viewerText, viewerNote);

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
privilegedPanel.append(privilegedHeading, privilegedText);
const status = document.createElement("section");
status.className = "status";
const statusHeading = document.createElement("h2");
const statusText = document.createElement("p");
status.append(statusHeading, statusText);
const exitButton = document.createElement("button");
exitButton.type = "button";
exitButton.className = "secondary";
exitButton.textContent = "Keluar";
const footer = document.createElement("div");
footer.className = "meta";
footer.textContent = "Simulasi keamanan DEV: belum ada akun peran aktif, database asli, maupun deployment. Login Google dan role tidak membuka akses Firestore sebelum pengujian Rules.";
container.append(badge, header, intro, googlePanel, viewerPanel, roleForm, privilegedPanel, status, exitButton, footer);
root.replaceChildren(container);

const roleLogin = httpsCallable(functions, "usernameSignIn", {timeout: 30000});
let signedMode = "none";
function report(title, detail, tone = "") {
  statusHeading.textContent = title;
  statusText.textContent = detail;
  statusText.className = tone;
}
function render(mode, busy = false) {
  signedMode = mode;
  googlePanel.hidden = mode !== "none";
  viewerPanel.hidden = mode !== "viewer";
  roleForm.hidden = mode !== "viewer";
  privilegedPanel.hidden = mode !== "role";
  exitButton.hidden = mode === "none";
  googleButton.disabled = busy;
  roleButton.disabled = busy || !roleLoginReady;
  exitButton.disabled = busy;
  if (mode === "viewer" && !roleLoginReady) {
    report("Mode Lihat (pengujian)", "Login peran masih dinonaktifkan sampai pengaturan backend dan Security Rules selesai.");
  } else if (mode === "role") {
    report("Sesi peran teridentifikasi", "Belum ada hak menulis; Firestore tetap ditutup sementara.");
  } else if (mode === "none") {
    report("Masuk melalui Google", "Akses lihat hanya diberikan ke satu akun Google yang disetujui kantor. Jangan gunakan akun pemilik proyek sebagai akun bersama.");
  }
}

googleButton.addEventListener("click", async () => {
  googleButton.disabled = true;
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    if (!viewerUid || result.user.uid !== viewerUid) {
      await signOut(auth);
      report("Akun belum diizinkan", "Akun Google ini belum ditetapkan sebagai akun akses lihat oleh pengelola Firebase.", "warning");
    }
  } catch (error) {
    report("Login Google belum berhasil", "Periksa akun Google dan domain otorisasi. Kode: " + (error?.code || "tidak diketahui"), "error");
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
    if (provider === "google.com" && viewerUid && user.uid === viewerUid) {
      render("viewer");
      return;
    }
    if (provider === "custom") {
      // A role session is a distinct Firebase UID; the backend only issues it
      // after a verified Google viewer signs in and supplies a valid password.
      render("role");
      privilegedText.textContent = "Peran telah masuk (UID: " + user.uid + "). Rincian izin akan diterapkan setelah pengujian Rules.";
      return;
    }
    await signOut(auth);
    report("Akses ditolak", "Identitas akun tidak sesuai dengan kebijakan akses kantor.", "warning");
  } catch {
    await signOut(auth).catch(() => {});
    report("Sesi belum dapat diverifikasi", "Silakan login kembali.", "error");
  }
});
