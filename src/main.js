import "./style.css";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase/client.js";

const root = document.getElementById("app");
const status = document.createElement("section");
status.className = "status";
const message = document.createElement("p");
const title = document.createElement("h2");
const userDetails = document.createElement("div");
const actions = document.createElement("div");
actions.className = "actions";
const loginButton = document.createElement("button");
loginButton.textContent = "Masuk dengan Google";
const logoutButton = document.createElement("button");
logoutButton.textContent = "Keluar";
logoutButton.className = "secondary";
const refreshButton = document.createElement("button");
refreshButton.textContent = "Periksa Akses";
refreshButton.className = "secondary";
actions.append(loginButton, refreshButton, logoutButton);
status.append(title, message, userDetails);
const eyebrow = document.createElement("div");
eyebrow.className = "eyebrow";
eyebrow.textContent = "LINGKUNGAN PENGUJIAN • BPS KABUPATEN BLORA";
const heading = document.createElement("h1");
heading.textContent = "Matriks Kinerja Pegawai";
const intro = document.createElement("p");
intro.textContent = "Hanya akun email BPS Blora yang telah disetujui Admin yang dapat memperoleh akses sesuai perannya. Halaman ini masih uji login; data matriks 2026/2027 belum tersedia.";
const footer = document.createElement("div");
footer.className = "meta";
footer.textContent = "Aplikasi pengujian. Jangan masukkan data pegawai asli sebelum persetujuan TI, aturan akses, dan audit selesai.";
const container = document.createElement("div");
container.className = "container";
container.append(eyebrow, heading, intro, status, actions, footer);
root.replaceChildren(container);

let current = null;
let sequence = 0;
function setStatus(heading, explanation, kind = "") {
  title.textContent = heading;
  message.textContent = explanation;
  message.className = kind;
}
function setButtons(loading = false) {
  loginButton.hidden = Boolean(current);
  refreshButton.hidden = !current;
  logoutButton.hidden = !current;
  loginButton.disabled = loading;
  refreshButton.disabled = loading;
  logoutButton.disabled = loading;
}
function showAccount(user) {
  userDetails.replaceChildren();
  if (!user) return;
  const userText = document.createElement("p");
  userText.textContent = "Akun Google: " + (user.email || "(tanpa email)");
  const uidText = document.createElement("p");
  const code = document.createElement("code");
  code.textContent = user.uid;
  uidText.append("UID Firebase: ", code);
  userDetails.append(userText, uidText);
}
// Login proves identity only. The client MUST NOT assign itself a role.
async function checkAccess(user) {
  const run = ++sequence;
  setButtons(true);
  setStatus("Memeriksa izin akun", "Aplikasi mencari profil izin pengguna yang disediakan administrator.");
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (run !== sequence || auth.currentUser?.uid !== user.uid) return;
    if (!snap.exists()) {
      setStatus("Belum terdaftar", "Identitas Google dikenali, tetapi email/UID ini belum disetujui Admin BPS Blora. Akses aplikasi tidak diberikan.");
    } else {
      const profile = snap.data();
      if (profile.active !== true) {
        setStatus("Akses belum aktif", "Akun ada, tetapi belum diaktifkan oleh administrator.");
      } else if (!["kepala", "admin", "ketua_tim", "pegawai"].includes(profile.role)) {
        setStatus("Peran belum valid", "Administrator perlu meninjau role pengguna ini.");
      } else {
        setStatus("Akun diizinkan untuk tahap pengujian", "Peran: " + profile.role + ". Modul matriks belum dibuka; akses operasional masih dalam pengembangan.");
      }
    }
  } catch (err) {
    if (run !== sequence || auth.currentUser?.uid !== user.uid) return;
    if (err?.code === "permission-denied") {
      setStatus("Akses Firestore masih ditutup", "Ini sesuai aturan keamanan awal (deny all). Jangan membuka akses secara umum. Setelah pengujian, administrator dapat menerapkan aturan baca profil sendiri yang terbatas.", "warning");
    } else {
      setStatus("Belum dapat memeriksa izin", "Periksa koneksi internet atau pengaturan Firebase. Kode: " + (err?.code || "tidak diketahui") + ".", "error");
    }
  } finally {
    if (run === sequence) setButtons(false);
  }
}

loginButton.addEventListener("click", async () => {
  loginButton.disabled = true;
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    setStatus("Login belum berhasil", err?.code === "auth/popup-closed-by-user" ? "Jendela login ditutup sebelum selesai." : "Periksa domain otorisasi Firebase dan akun Google. Kode: " + (err?.code || "tidak diketahui") + ".", "error");
    loginButton.disabled = false;
  }
});
logoutButton.addEventListener("click", async () => {
  await signOut(auth);
});
refreshButton.addEventListener("click", () => {
  if (auth.currentUser) void checkAccess(auth.currentUser);
});
onAuthStateChanged(auth, (user) => {
  current = user;
  ++sequence;
  showAccount(user);
  setButtons();
  if (user) void checkAccess(user);
  else setStatus("Masuk menggunakan akun Google", "Masuk dengan email resmi BPS Blora yang didaftarkan Admin. Setiap pegawai menggunakan identitas akunnya masing-masing; Gmail pengelola Firebase tidak dipakai bersama untuk masuk aplikasi.");
});
