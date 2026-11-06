import "./style.css";
import { onAuthStateChanged, signInWithCustomToken, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "./firebase/client.js";

// Tidak boleh ada password atau role Administrator yang disimpan di browser.
// Login tidak akan aktif sampai backend dan profil akun benar-benar siap.
const authReady = import.meta.env.VITE_USERNAME_AUTH_READY === "true";
const root = document.getElementById("app");
const wrap = document.createElement("main");
wrap.className = "container";
const eyebrow = document.createElement("div");
eyebrow.className = "eyebrow";
eyebrow.textContent = "BPS KABUPATEN BLORA • LINGKUNGAN DEV";
const heading = document.createElement("h1");
heading.textContent = "Matriks Kinerja Pegawai";
const intro = document.createElement("p");
intro.textContent = "Gunakan username dan password Matriks Pegawai yang diberikan Admin. Gmail kantor digunakan untuk mengelola Firebase, bukan sebagai akun bersama untuk login pegawai.";

const form = document.createElement("form");
form.className = "login-form";
const usernameLabel = document.createElement("label");
usernameLabel.textContent = "Username";
const usernameInput = document.createElement("input");
usernameInput.name = "username";
usernameInput.autocomplete = "username";
usernameInput.required = true;
usernameInput.minLength = 3;
usernameInput.maxLength = 32;
usernameInput.placeholder = "Misalnya: petugas_01";
usernameLabel.append(usernameInput);
const passwordLabel = document.createElement("label");
passwordLabel.textContent = "Password";
const passwordInput = document.createElement("input");
passwordInput.name = "password";
passwordInput.type = "password";
passwordInput.autocomplete = "current-password";
passwordInput.required = true;
passwordInput.placeholder = "Password dari Admin";
passwordLabel.append(passwordInput);
const loginButton = document.createElement("button");
loginButton.type = "submit";
loginButton.textContent = "Masuk ke Matriks";
loginButton.disabled = !authReady;
form.append(usernameLabel, passwordLabel, loginButton);
const status = document.createElement("section");
status.className = "status";
const title = document.createElement("h2");
const message = document.createElement("p");
status.append(title, message);
const details = document.createElement("p");
details.className = "meta";
const actions = document.createElement("div");
actions.className = "actions";
const refreshButton = document.createElement("button");
refreshButton.textContent = "Periksa Izin";
refreshButton.type = "button";
refreshButton.className = "secondary";
const logoutButton = document.createElement("button");
logoutButton.textContent = "Keluar";
logoutButton.type = "button";
logoutButton.className = "secondary";
actions.append(refreshButton, logoutButton);
const foot = document.createElement("div");
foot.className = "meta";
foot.textContent = "Halaman ini masih pengujian. Data pegawai asli belum dimasukkan, dan akses Firestore tetap tertutup sampai aturan peran diuji.";
wrap.append(eyebrow, heading, intro, form, status, details, actions, foot);
root.replaceChildren(wrap);

const callLogin = httpsCallable(functions, "usernameSignIn", { timeout: 30000 });
let currentUser = null;
let seq = 0;
function setStatus(head, body, tone = "") {
  title.textContent = head;
  message.textContent = body;
  message.className = tone;
}
function updateUI(busy = false) {
  form.hidden = Boolean(currentUser);
  actions.hidden = !currentUser;
  loginButton.disabled = busy || !authReady;
  refreshButton.disabled = busy;
  logoutButton.disabled = busy;
  details.textContent = currentUser ? "ID pengguna Firebase: " + currentUser.uid : "";
}

async function checkAccess(user) {
  const run = ++seq;
  updateUI(true);
  setStatus("Memeriksa izin", "Sistem sedang memeriksa status akun dan peran yang ditetapkan Admin.");
  try {
    const profileSnap = await getDoc(doc(db, "users", user.uid));
    if (run !== seq || auth.currentUser?.uid !== user.uid) return;
    const profile = profileSnap.exists() ? profileSnap.data() : null;
    if (!profile || profile.active !== true) {
      setStatus("Akses belum diberikan", "Admin Matriks belum mengaktifkan akun ini.");
    } else if (!["kepala", "admin", "ketua_tim", "pegawai"].includes(profile.role)) {
      setStatus("Peran belum sesuai", "Admin perlu memperbaiki peran pengguna.");
    } else {
      setStatus("Akun terverifikasi (DEV)", "Peran terdaftar: " + profile.role + ". Modul Matriks v2.6 masih dalam proses integrasi.");
    }
  } catch (error) {
    if (run !== seq || auth.currentUser?.uid !== user.uid) return;
    setStatus(
      error?.code === "permission-denied" ? "Akses database masih tertutup" : "Gagal memeriksa izin",
      error?.code === "permission-denied"
        ? "Firestore masih menggunakan aturan deny-all. Ini memang sengaja sampai pengujian keamanan selesai."
        : "Pemeriksaan izin belum tersedia. Coba lagi setelah pengaturan server selesai.",
      "warning"
    );
  } finally {
    if (run === seq) updateUI();
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authReady) return;
  loginButton.disabled = true;
  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  passwordInput.value = ""; // jangan menyimpan password di browser / penyimpanan lokal
  try {
    const result = await callLogin({username, password});
    if (typeof result?.data?.token !== "string") throw Error("missing-token");
    await signInWithCustomToken(auth, result.data.token);
  } catch {
    setStatus("Tidak dapat masuk", "Username/password salah, akun belum aktif, atau layanan login belum tersedia.", "error");
  } finally {
    updateUI();
  }
});

refreshButton.addEventListener("click", () => {
  if (auth.currentUser) void checkAccess(auth.currentUser);
});
logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch {
    setStatus("Gagal keluar", "Silakan coba kembali.", "error");
  }
});
onAuthStateChanged(auth, async (user) => {
  ++seq;
  // Aplikasi pegawai tidak memakai Google shared-login. Putuskan sesi lama.
  if (user) {
    try {
      const tokenResult = await user.getIdTokenResult();
      if (tokenResult.signInProvider !== "custom") {
        await signOut(auth);
        return;
      }
    } catch {
      await signOut(auth);
      return;
    }
  }
  currentUser = user;
  updateUI();
  if (user) void checkAccess(user);
  else setStatus(
    authReady ? "Masuk dengan akun Matriks" : "Login masih dalam persiapan",
    authReady
      ? "Masukkan username dan password individual dari Admin Matriks."
      : "Fondasi login telah dibuat, tetapi belum diaktifkan. Admin akan membuat akun setelah pengujian keamanan selesai."
  );
});
