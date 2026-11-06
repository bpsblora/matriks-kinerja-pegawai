"use strict";
/**
 * PROTOTYPE AUTH SERVICE — DO NOT DEPLOY TO PRODUCTION.
 * All login requests fail closed unless AUTH_LOGIN_ENABLED=true is explicitly
 * configured by the project operator after a security and billing review.
 *
 * Firebase Admin SDK runs only on this trusted backend. Never put passwords,
 * hashes or admin service-account credentials in frontend/repository.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const bcrypt = require("bcryptjs");
const { normalizeUsername, credentialKey, passwordInputValid, isActiveProfile, isApprovedGoogleViewer } = require("./security.js");

initializeApp();
const db = getFirestore();
const WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_LIMIT = 5;
const DUMMY_HASH = bcrypt.hash("placeholder-password-no-matching-account", 12);

/**
 * Simple durable per-username throttle for DEV only.
 * A production release requires reviewed global/IP rate limits, App Check,
 * risk monitoring and safe account-recovery controls in addition to this.
 */
async function recordAttempt(key) {
  const ref = db.collection("authThrottle").doc(key);
  return db.runTransaction(async (tx) => {
    const now = Date.now();
    const snapshot = await tx.get(ref);
    const item = snapshot.exists ? snapshot.data() : null;
    const inWindow = item && typeof item.windowStart === "number" && now - item.windowStart < WINDOW_MS;
    const count = inWindow ? (item.count || 0) + 1 : 1;
    tx.set(ref, { windowStart: inWindow ? item.windowStart : now, count, updatedAt: now });
    return count <= ATTEMPT_LIMIT;
  });
}

exports.usernameSignIn = onCall({
  region: "us-central1", // DEV project database is nam5; PROD needs a separate Jakarta configuration.
  memory: "256MiB",
  timeoutSeconds: 30,
  maxInstances: 5,
  // App Check will be enforced after the app is registered and tested.
}, async (request) => {
  if (process.env.AUTH_LOGIN_ENABLED !== "true") {
    throw new HttpsError("failed-precondition", "Login aplikasi masih dalam tahap persiapan.");
  }

  // Require the Google viewer gate first: a password by itself is insufficient.
  // This value must be configured on the trusted backend, never supplied by UI.
  if (!isApprovedGoogleViewer(request.auth, process.env.VIEWER_GOOGLE_UID)) {
    throw new HttpsError("permission-denied", "Akun Google tidak diizinkan memasuki mode pengelola.");
  }

  const username = normalizeUsername(request.data?.username);
  const password = request.data?.password;
  if (!username || !passwordInputValid(password)) {
    throw new HttpsError("unauthenticated", "Username atau password tidak sesuai.");
  }

  const key = credentialKey(username);
  if (!(await recordAttempt(key))) {
    throw new HttpsError("resource-exhausted", "Terlalu banyak percobaan masuk. Coba kembali nanti.");
  }

  const credentialSnap = await db.collection("authCredentials").doc(key).get();
  const credential = credentialSnap.exists ? credentialSnap.data() : null;
  const hash = typeof credential?.passwordHash === "string" ? credential.passwordHash : await DUMMY_HASH;
  const valid = await bcrypt.compare(password, hash);

  if (!valid || typeof credential?.uid !== "string" || credential.disabled === true) {
    throw new HttpsError("unauthenticated", "Username atau password tidak sesuai.");
  }

  const profileSnap = await db.collection("users").doc(credential.uid).get();
  const profile = profileSnap.exists ? profileSnap.data() : null;
  if (!isActiveProfile(profile) || profile.username !== username) {
    throw new HttpsError("unauthenticated", "Username atau password tidak sesuai.");
  }

  const user = await getAuth().getUser(credential.uid).catch(() => null);
  if (!user || user.disabled) {
    throw new HttpsError("unauthenticated", "Username atau password tidak sesuai.");
  }

  // Role credentials represent a role account, not an identified human.
  // For ketua_tim, scope teamIds to the designated team(s) on the server.
  // Do not rely on generic all-teams "katim" credentials.
  // Never trust a role from the client. The profile is checked server-side.
  // A custom token gives the authenticated Firebase UID, not direct Admin rights.
  const token = await getAuth().createCustomToken(credential.uid);
  return { token };
});
