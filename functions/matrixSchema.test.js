"use strict";
const t=require("node:test"),a=require("node:assert/strict");
const v=require("./matrixSchema");
t("validation whitelist and size",()=>{
 const x=v.validateRecord("activities","K2026-0005",{teamId:"T001",kroCode:"2886.EBD.961",description:"Rapat bulanan",annualVolume:4,standardHours:4});
 a.equal(x.teamId,"T001");
 a.throws(()=>v.validateRecord("activities","K2026-0005",{role:"admin"}));
 a.throws(()=>v.validateRecord("activities","K2026-0005",{teamId:"../../users"}));
 a.throws(()=>v.validateRecord("teams","T001",{name:""}));
 a.throws(()=>v.validateRecord("allocations","A1",{hours:4}));
});
t("meeting rule: per participant hours replicated, not divided",()=>{
 const members=["E001","E002","E003"];
 const rows=members.map(employeeId=>v.validateRecord("allocations",v.allocationId("K2026-0005",employeeId,11),
 {activityId:"K2026-0005",employeeId,teamId:"T001",month:11,hours:4,volume:1}));
 a.deepEqual(rows.map(x=>x.hours),[4,4,4]);
});
t("role/team server authorization",()=>{
 a.equal(v.canManage("ketua_tim",["T001"],"allocations","T001"),true);
 a.equal(v.canManage("ketua_tim",["T001"],"allocations","T002"),false);
 a.equal(v.canManage("ketua_tim",["T001"],"teams","T001"),false);
 a.equal(v.canManage("kepala",[],"activities","T001"),false);
 a.equal(v.canManage("admin",[],"activities","T002"),true);
 a.equal(v.accessible("ketua_tim",["T001"],"kros",{teamIds:["T001","T002"]}),true);
 a.equal(v.accessible("ketua_tim",["T001"],"kros",{teamIds:["T002"]}),false);
});
t("year boundaries and allocation IDs",()=>{
 a.equal(v.year(2026),"2026");
 a.throws(()=>v.year(2020));
 a.equal(v.allocationId("K2026-0010","E001",3),"K2026-0010__E001__3");
});

t("2027 KRO recommendations never automatically become team assignments",()=>{
 const k=v.validateRecord("kros","2896.BMA.004",{
   code:"2896.BMA.004",name:"KRO uji",teamIds:[],suggestedTeamIds:["T001","T002","T001"],active:true
 });
 a.deepEqual(k.teamIds,[]);
 a.deepEqual(k.suggestedTeamIds,["T001","T002"]);
 a.throws(()=>v.validateRecord("kros","2896.BMA.004",{suggestedTeamIds:["../users"]}));
});
t("viewer cannot write any type; head alone can finalize through role API",()=>{
 for(const k of v.TYPES)a.equal(v.canManage("viewer",[],k,"T001"),false);
 a.equal(v.canManage("kepala",[],"activities","T001"),false);
 a.equal(v.canManage("ketua_tim",["T001"],"activities","T001"),true);
 a.equal(v.canManage("ketua_tim",["T001"],"activities","T002"),false);
});
