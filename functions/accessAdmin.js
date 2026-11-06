"use strict";

// Server-only administration of role credentials, not accessible to Firestore SDK.
// Kept OFF until TI approval, Cloud Functions deployment and security tests.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const bcrypt = require("bcryptjs");
const {
  normalizeUsername, credentialKey, passwordInputValid, isActiveProfile
} = require("./security.js");

const region = "us-central1";
const options = {region, memory:"256MiB", timeoutSeconds:30, maxInstances:5};
const db = () => getFirestore();
const ROLE_SET = new Set(["ketua_tim", "admin", "kepala"]);
function fail(code, message) { throw new HttpsError(code, message); }
function isElevated(role) { return role === "admin" || role === "kepala"; }
function validTeams(value) {
  if (!Array.isArray(value) || value.length > 25) return null;
  const list = [...new Set(value)];
  return list.every(s => typeof s === "string" && /^[A-Z][0-9]{3}$/.test(s)) ? list : null;
}
function checkRole(role, teams) {
  if (!ROLE_SET.has(role)) fail("invalid-argument", "Peran belum valid.");
  if (isElevated(role) && process.env.ALLOW_ELEVATED_ROLE_MANAGEMENT !== "true")
    fail("permission-denied", "Perubahan akun Kepala/Admin memerlukan persetujuan pengelola.");
  if (role === "ketua_tim" && teams.length === 0)
    fail("invalid-argument", "Akun Ketua Tim wajib ditautkan ke tim.");
}
async function requireAdmin(request) {
  if (process.env.ACCESS_ADMIN_ENABLED !== "true")
    fail("failed-precondition", "Pengelolaan akun belum diaktifkan.");
  if (!request.auth || request.auth.token?.firebase?.sign_in_provider !== "custom")
    fail("permission-denied", "Masuk menggunakan akun peran Admin.");
  const uid = request.auth.uid;
  const userRecord = await getAuth().getUser(uid).catch(() => null);
  if (!userRecord || userRecord.disabled) fail("permission-denied", "Akun tidak aktif.");
  const profileSnap = await db().collection("users").doc(uid).get();
  const profile = profileSnap.exists ? profileSnap.data() : null;
  if (!isActiveProfile(profile) || profile.role !== "admin" || profile.accessAccount !== true)
    fail("permission-denied", "Hanya Admin Matriks berwenang mengelola akun.");
  return {uid, profile};
}
function cleanPublicProfile(doc) {
  const data = doc.data();
  return {
    uid:doc.id,
    username:data.username,
    role:data.role,
    teamIds:Array.isArray(data.teamIds) ? data.teamIds : [],
    active:data.active === true,
    updatedAt:data.updatedAt?.toDate?.()?.toISOString?.() || null
  };
}

exports.getAccessContext = onCall(options, async (req) => {
  if (!req.auth) fail("unauthenticated", "Silakan login.");
  const provider = req.auth.token?.firebase?.sign_in_provider;
  if (provider === "google.com"
      && process.env.VIEWER_GOOGLE_UID
      && req.auth.uid === process.env.VIEWER_GOOGLE_UID
      && req.auth.token?.email_verified === true) {
    return {mode:"viewer",role:"viewer",teamIds:[],active:true};
  }
  if (provider !== "custom") fail("permission-denied", "Sesi tidak sesuai.");
  const profileSnap = await db().collection("users").doc(req.auth.uid).get();
  const profile = profileSnap.exists ? profileSnap.data() : null;
  const firebaseUser = await getAuth().getUser(req.auth.uid).catch(()=>null);
  if (!firebaseUser || firebaseUser.disabled || !isActiveProfile(profile) || profile.accessAccount !== true)
    fail("permission-denied", "Akun belum diizinkan.");
  return {
    mode:"role",role:profile.role,
    teamIds:Array.isArray(profile.teamIds)?profile.teamIds:[],
    active:true,username:profile.username
  };
});

exports.listAccessAccounts = onCall(options, async (req) => {
  await requireAdmin(req);
  const result = await db().collection("users").where("accessAccount","==",true).limit(100).get();
  return {accounts:result.docs.map(cleanPublicProfile)};
});

exports.createAccessAccount = onCall(options, async (req) => {
  const actor = await requireAdmin(req);
  const username = normalizeUsername(req.data?.username);
  const password = req.data?.password;
  const role = req.data?.role;
  const teamIds = validTeams(req.data?.teamIds || []);
  if (!username || !passwordInputValid(password) || teamIds === null)
    fail("invalid-argument", "Username, password, atau tim tidak sesuai.");
  checkRole(role,teamIds);
  const key = credentialKey(username);
  const credRef = db().collection("authCredentials").doc(key);
  if ((await credRef.get()).exists) fail("already-exists", "Username sudah digunakan.");
  const hash = await bcrypt.hash(password, 12);
  const record = await getAuth().createUser({disabled:false,displayName:"Akun Matriks: " + username});
  const profileRef = db().collection("users").doc(record.uid);
  const auditRef = db().collection("auditLogs").doc();
  try {
    await db().runTransaction(async tx => {
      if ((await tx.get(credRef)).exists) fail("already-exists", "Username sudah digunakan.");
      const stamp = FieldValue.serverTimestamp();
      tx.create(credRef,{uid:record.uid,passwordHash:hash,disabled:false,createdAt:stamp,updatedAt:stamp});
      tx.create(profileRef,{username,role,teamIds,active:true,accessAccount:true,createdAt:stamp,updatedAt:stamp});
      tx.create(auditRef,{actorUid:actor.uid,action:"account.create",targetUid:record.uid,role,teamIds,at:stamp});
    });
  } catch(err) {
    await getAuth().deleteUser(record.uid).catch(()=>{});
    throw err;
  }
  return {uid:record.uid,username,role,teamIds,active:true};
});

exports.updateAccessAccount = onCall(options, async (req) => {
  const actor = await requireAdmin(req);
  const uid = req.data?.uid;
  if (typeof uid !== "string" || uid.length < 5 || uid === actor.uid)
    fail("invalid-argument","Akun sasaran tidak dapat diubah.");
  const profileRef=db().collection("users").doc(uid);
  const existing=await profileRef.get();
  if (!existing.exists || existing.data().accessAccount !== true) fail("not-found","Akun tidak ditemukan.");
  const old=existing.data();
  const newUsername=normalizeUsername(req.data?.username);
  const newRole=req.data?.role;
  const teamIds=validTeams(req.data?.teamIds||[]);
  if (!newUsername || teamIds===null) fail("invalid-argument","Username atau tim tidak valid.");
  if (isElevated(old.role) && process.env.ALLOW_ELEVATED_ROLE_MANAGEMENT!=="true")
    fail("permission-denied","Akun Admin/Kepala hanya dapat diubah oleh pengelola.");
  checkRole(newRole,teamIds);
  const oldRef=db().collection("authCredentials").doc(credentialKey(old.username));
  const newRef=db().collection("authCredentials").doc(credentialKey(newUsername));
  const auditRef=db().collection("auditLogs").doc();
  await db().runTransaction(async tx=>{
    const reads=await Promise.all([tx.get(profileRef),tx.get(oldRef),...(old.username!==newUsername?[tx.get(newRef)]:[])]);
    const [p,c,n]=reads;
    if (!p.exists||p.data().username!==old.username||!c.exists||c.data().uid!==uid) fail("failed-precondition","Akun telah berubah, muat ulang.");
    if (n?.exists) fail("already-exists","Username sudah digunakan.");
    const stamp=FieldValue.serverTimestamp();
    if (old.username!==newUsername) {
      tx.create(newRef,{...c.data(),updatedAt:stamp});
      tx.delete(oldRef);
    }
    tx.update(profileRef,{username:newUsername,role:newRole,teamIds,updatedAt:stamp});
    tx.create(auditRef,{actorUid:actor.uid,action:"account.update",targetUid:uid,oldRole:old.role,role:newRole,at:stamp});
  });
  await getAuth().revokeRefreshTokens(uid).catch(()=>{});
  return {success:true};
});

exports.resetAccessPassword = onCall(options, async (req) => {
  const actor=await requireAdmin(req);
  const uid=req.data?.uid;
  const password=req.data?.password;
  if (typeof uid!=="string" || uid===actor.uid || !passwordInputValid(password))
    fail("invalid-argument","Akun atau password tidak sesuai.");
  const profileSnap=await db().collection("users").doc(uid).get();
  if (!profileSnap.exists||profileSnap.data().accessAccount!==true) fail("not-found","Akun tidak ditemukan.");
  const p=profileSnap.data();
  if (isElevated(p.role) && process.env.ALLOW_ELEVATED_ROLE_MANAGEMENT!=="true")
    fail("permission-denied","Reset akun Kepala/Admin memerlukan persetujuan tambahan.");
  const ref=db().collection("authCredentials").doc(credentialKey(p.username));
  const hash=await bcrypt.hash(password,12);
  const audit=db().collection("auditLogs").doc();
  await db().runTransaction(async tx=>{
    const cred=await tx.get(ref);
    if (!cred.exists||cred.data().uid!==uid) fail("not-found","Kredensial tidak ditemukan.");
    const stamp=FieldValue.serverTimestamp();
    tx.update(ref,{passwordHash:hash,updatedAt:stamp});
    tx.create(audit,{actorUid:actor.uid,targetUid:uid,action:"account.reset-password",at:stamp});
  });
  await getAuth().revokeRefreshTokens(uid);
  return {success:true};
});

exports.setAccessAccountStatus=onCall(options,async req=>{
  const actor=await requireAdmin(req);
  const uid=req.data?.uid;
  const active=req.data?.active;
  if (typeof uid!=="string" || uid===actor.uid || typeof active!=="boolean")
    fail("invalid-argument","Status akun tidak sesuai.");
  const ref=db().collection("users").doc(uid);
  const snap=await ref.get();
  if (!snap.exists||snap.data().accessAccount!==true) fail("not-found","Akun tidak ditemukan.");
  if (isElevated(snap.data().role) && process.env.ALLOW_ELEVATED_ROLE_MANAGEMENT!=="true")
    fail("permission-denied","Perubahan akun Kepala/Admin perlu persetujuan tambahan.");
  const credRef=db().collection("authCredentials").doc(credentialKey(snap.data().username));
  const audit=db().collection("auditLogs").doc();
  // Mark inactive in Firestore first, before modifying Firebase Auth state.
  await db().runTransaction(async tx=>{
    const credential=await tx.get(credRef);
    if(!credential.exists||credential.data().uid!==uid) fail("not-found","Kredensial akun tidak ditemukan.");
    const stamp=FieldValue.serverTimestamp();
    tx.update(ref,{active,updatedAt:stamp});
    tx.update(credRef,{disabled:!active,updatedAt:stamp});
    tx.create(audit,{actorUid:actor.uid,targetUid:uid,action:active?"account.enable":"account.disable",at:stamp});
  });
  await getAuth().updateUser(uid,{disabled:!active});
  await getAuth().revokeRefreshTokens(uid);
  return {success:true};
});
