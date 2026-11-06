"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeUsername, credentialKey, passwordInputValid, isActiveProfile, isApprovedGoogleViewer } = require("./security.js");

test("canonical username normalization and validity", () => {
  assert.equal(normalizeUsername("  Petugas_01  "), "petugas_01");
  assert.equal(normalizeUsername("admin"), "admin");
  assert.equal(normalizeUsername("a"), null);
  assert.equal(normalizeUsername("a@bpsblora"), null);
  assert.equal(normalizeUsername("a b c"), null);
  assert.equal(normalizeUsername("../system"), null);
  assert.equal(normalizeUsername(null), null);
});
test("stable hashed credential lookup ids", () => {
  assert.equal(credentialKey("PETUGAS_01"), credentialKey(" petugas_01 "));
  assert.equal(credentialKey("petugas_01").length, 64);
  assert.notEqual(credentialKey("petugas_01"), credentialKey("petugas_02"));
});
test("password length bounds prevent bcrypt truncation", () => {
  assert.equal(passwordInputValid("kataSandiPanjang12"), true);
  assert.equal(passwordInputValid("abc"), false);
  assert.equal(passwordInputValid("a".repeat(73)), false);
  assert.equal(passwordInputValid(undefined), false);
});
test("profile only active and valid roles", () => {
  assert.equal(isActiveProfile({active:true,role:"pegawai"}),true);
  assert.equal(isActiveProfile({active:false,role:"admin"}),false);
  assert.equal(isActiveProfile({active:true,role:"owner"}),false);
  assert.equal(isActiveProfile(null),false);
});

test("role escalation only from approved verified Google viewer", () => {
 const uid = "example-viewer-uid-1234";
 const valid = {uid,token:{email_verified:true,firebase:{sign_in_provider:"google.com"}}};
 assert.equal(isApprovedGoogleViewer(valid,uid),true);
 assert.equal(isApprovedGoogleViewer({...valid,uid:"imposter"},uid),false);
 assert.equal(isApprovedGoogleViewer({...valid,token:{email_verified:false,firebase:{sign_in_provider:"google.com"}}},uid),false);
 assert.equal(isApprovedGoogleViewer({...valid,token:{email_verified:true,firebase:{sign_in_provider:"custom"}}},uid),false);
 assert.equal(isApprovedGoogleViewer(valid,""),false);
 assert.equal(isApprovedGoogleViewer(null,uid),false);
});
