"use strict";
// Trusted server validators. Never use client-supplied roles or free-form paths.
const TYPES = Object.freeze(["teams","employees","kros","activities","allocations","annualAllocations","standards","schedules","targets","workflow"]);
const FIELDS = Object.freeze({
  teams:["name","leaderId","memberIds","active","notes"],
  employees:["name","active","type","position"],
  kros:["code","name","teamIds","active","notes"],
  activities:["teamId","kroCode","group","description","unit","standardHours","annualVolume","calculationMode","active"],
  allocations:["activityId","employeeId","teamId","month","hours","volume","notes"],
  annualAllocations:["activityId","employeeId","teamId","hours","volume","notes"],
  standards:["group","name","hours","unit","active"],
  schedules:["teamId","activityId","startDate","endDate","notes","active"],
  targets:["teamId","activityId","month","volume","notes"],
  workflow:["teamId","stage","status","notes"]
});
const TEAM = /^T\d{3}$/;
const EMPLOYEE = /^E\d{3,5}$/;
const KRO = /^\d{4}\.[A-Z0-9]+\.\d{3,4}$/;
const DOC_ID = /^[a-zA-Z0-9._-]{2,120}$/;
const DATE = /^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MAX_TEXT = 500;

function assert(ok,msg){if(!ok)throw new Error(msg);}
function cleanText(value,max=MAX_TEXT,required=false){
  assert(typeof value==="string", "Teks harus berupa string.");
  const s=value.trim().replace(/\s+/g," ");
  assert(s.length <= max && (!required||s.length>0), "Panjang teks tidak sesuai.");
  return s;
}
function number(value,min,max){
  const n=Number(value);
  assert(value!==null && value!=="" && Number.isFinite(n) && n>=min && n<=max,"Angka di luar batas.");
  return n;
}
function ids(value,pattern,max=50){
  assert(Array.isArray(value)&&value.length<=max,"Daftar ID tidak sesuai.");
  const unique=[...new Set(value)];
  assert(unique.every(s=>typeof s==="string"&&pattern.test(s)),"Format ID tidak valid.");
  return unique;
}
function validateRecord(kind,id,input){
  assert(TYPES.includes(kind),"Jenis data tidak dikenal.");
  assert(typeof id==="string"&&DOC_ID.test(id)&&!id.startsWith("__"),"ID dokumen tidak sesuai.");
  assert(input&&typeof input==="object"&&!Array.isArray(input),"Objek data tidak valid.");
  const allowed=FIELDS[kind];
  const keys=Object.keys(input);
  assert(keys.length>0&&keys.every(k=>allowed.includes(k)), "Ada field yang tidak diizinkan.");
  const out={};
  for(const [k,v] of Object.entries(input)){
    if (["name","group","description","unit","notes","position","type","calculationMode","stage","status"].includes(k))
      out[k]=cleanText(v,k==="description"?600:200,["name","description"].includes(k));
    else if(k==="leaderId"||k==="employeeId") {assert(typeof v==="string"&&EMPLOYEE.test(v),"ID pegawai tidak valid.");out[k]=v;}
    else if(k==="teamId"){assert(typeof v==="string"&&TEAM.test(v),"ID tim tidak valid.");out[k]=v;}
    else if(k==="activityId"){assert(typeof v==="string"&&DOC_ID.test(v),"ID kegiatan tidak valid.");out[k]=v;}
    else if(k==="kroCode"||k==="code"){assert(typeof v==="string"&&(v===""||KRO.test(v)),"Kode KRO tidak valid.");out[k]=v;}
    else if(k==="memberIds")out[k]=ids(v,EMPLOYEE,80);
    else if(k==="teamIds")out[k]=ids(v,TEAM,35);
    else if(k==="active") {assert(typeof v==="boolean","Status harus boolean.");out[k]=v;}
    else if(k==="month")out[k]=number(v,1,12);
    else if(k==="hours"||k==="standardHours")out[k]=number(v,0,1000);
    else if(k==="annualVolume"||k==="volume")out[k]=number(v,0,100000000);
    else if(k==="startDate"||k==="endDate"){assert(typeof v==="string"&&DATE.test(v),"Format tanggal YYYY-MM-DD.");out[k]=v;}
  }
  if(kind==="allocations"){
    const match=/^([a-zA-Z0-9.-]+)__([A-Z]\d{3,5})__(\d{1,2})$/.exec(id);
    assert(match,"Gunakan ID alokasi activity__employee__month.");
    if(out.activityId)assert(match[1]===out.activityId,"Kegiatan tidak sesuai ID.");
    if(out.employeeId)assert(match[2]===out.employeeId,"Pegawai tidak sesuai ID.");
    if(out.month)assert(Number(match[3])===out.month,"Bulan tidak sesuai ID.");
  }
  return out;
}
function canManage(role,teamIds,kind,teamId){
  if(role==="admin")return TYPES.includes(kind);
  if(role==="kepala")return false;
  if(role!=="ketua_tim")return false;
  return ["activities","allocations","annualAllocations","schedules","targets","workflow"].includes(kind)
    &&typeof teamId==="string"&&teamIds.includes(teamId);
}
function accessible(role,teamIds,kind,row){
  if(role==="admin"||role==="kepala")return true;
  if(role!=="ketua_tim")return false;
  if(kind==="teams")return teamIds.includes(row.id);
  if(kind==="employees")return true; // Employee picker by ID, not password/profile.
  if(kind==="standards")return true;
  if(kind==="kros")return Array.isArray(row.teamIds)&&row.teamIds.some(x=>teamIds.includes(x));
  return teamIds.includes(row.teamId);
}
function year(value){const y=Number(value);assert(Number.isInteger(y)&&y>=2026&&y<=2035,"Tahun tidak valid.");return String(y);}
function allocationId(activityId,employeeId,month){return activityId+"__"+employeeId+"__"+month;}
module.exports={TYPES,FIELDS,validateRecord,canManage,accessible,year,allocationId,TEAM,EMPLOYEE,KRO,DOC_ID};
