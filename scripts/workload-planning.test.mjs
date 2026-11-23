import assert from "node:assert/strict";
import { test } from "node:test";
import { zipSync, strToU8 } from "fflate";
import { personHourTotals, xlsxRows } from "../src/workloadPlanning.js";

test("rapat lima jam dengan delapan peserta sama dengan 40 orang-jam",()=>{
 const x=personHourTotals(5,3,5);
 assert.deepEqual(x,{organic:25,partner:15,total:40});
});
test("kegiatan lain memakai rumus yang sama dengan rapat",()=>{
 const x=personHourTotals(4,6,2.5);
 assert.deepEqual(x,{organic:10,partner:15,total:25});
});
test("impor XLSX sheet 2027 mempertahankan kolom volume, jam organik, dan jam mitra",async()=>{
 const labels=["Kode Tim","Tim Kerja","Kegiatan","Uraian Kegiatan","Vol","Satuan","Waktu per Satuan","Total Jam","Jam Organik","Jam Mitra"];
 const values=["1","Statistik Produksi","Rapat Koordinasi","Rapat petugas (8 orang)","8","O-Keg","5","40","25","15"];
 const columns="ABCDEFGHIJ".split("");
 const row=(n,items)=>'<row r="'+n+'">'+items.map((value,i)=>'<c r="'+columns[i]+n+'" t="inlineStr"><is><t>'+value+'</t></is></c>').join("")+'</row>';
 const parts={
  "xl/workbook.xml":'<workbook><sheets><sheet name="2027" sheetId="1" r:id="rId1"/></sheets></workbook>',
  "xl/_rels/workbook.xml.rels":'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
  "xl/worksheets/sheet1.xml":'<worksheet><sheetData>'+row(2,labels)+row(3,values)+'</sheetData></worksheet>'
 };
 const entries=Object.fromEntries(Object.entries(parts).map(([name,content])=>[name,strToU8(content)]));
 const file=new File([zipSync(entries)],"uji.xlsx",{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
 const result=await xlsxRows(file,2027);
 assert.equal(result.length,1);
 assert.equal(result[0].group,"Statistik Produksi");
 assert.equal(result[0].volume,8);
 assert.equal(result[0].standard,5);
 assert.equal(result[0].reported,40);
 assert.equal(result[0].organic,25);
 assert.equal(result[0].partner,15);
});
test("impor gagal jelas jika sheet tahun dimaksud tidak ditemukan",async()=>{
 const entries={
  "xl/workbook.xml":strToU8('<workbook><sheets><sheet name="2026" sheetId="1" r:id="rId1"/></sheets></workbook>'),
  "xl/_rels/workbook.xml.rels":strToU8("<Relationships/>")
 };
 const file=new File([zipSync(entries)],"uji.xlsx");
 await assert.rejects(()=>xlsxRows(file,2027),/Sheet 2027/);
});
