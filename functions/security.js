"use strict";
const { createHash } = require("node:crypto");

/**
 * Username is not an email address. Keep the canonical representation stable.
 * Format: starts with letter, 3-32 chars, lower-case a-z, digits, dot, _ or -.
 */
function normalizeUsername(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().normalize("NFKC").toLowerCase();
  return /^[a-z][a-z0-9._-]{2,31}$/.test(normalized) ? normalized : null;
}

function credentialKey(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  return createHash("sha256").update("matriks-username-v1:" + normalized).digest("hex");
}

// bcrypt's maximum password input is 72 bytes; reject ambiguous/truncated input.
function passwordInputValid(value) {
  if (typeof value !== "string") return false;
  const bytes = Buffer.byteLength(value, "utf8");
  return bytes >= 12 && bytes <= 72;
}

const ROLES = Object.freeze(["kepala", "admin", "ketua_tim", "pegawai"]);
function isActiveProfile(profile) {
  return Boolean(profile && profile.active === true && ROLES.includes(profile.role));
}

module.exports = { normalizeUsername, credentialKey, passwordInputValid, isActiveProfile, ROLES };
