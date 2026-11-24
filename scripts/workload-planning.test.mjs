import assert from "node:assert/strict";
import { test } from "node:test";
import { zipSync, strToU8 } from "fflate";
import { personHourTotals, xlsxRows, xlsxSheets, xlsxSheetInfo, previousYearDraft } from "../src/workloadPlanning.js";

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
 await assert.rejects(()=>xlsxRows(file,2027),/2027.*tidak ditemukan/);
});


test("pemilihan sheet dan rentang baris memuat hanya baris yang diminta",async()=>{
 const cols="ABCDEFGHIJ".split("");
 const row=(n,items)=>'<row r="'+n+'">'+items.map((v,i)=>'<c r="'+cols[i]+n+'" t="inlineStr"><is><t>'+v+'</t></is></c>').join("")+'</row>';
 const header=["Kode Tim","Tim Kerja","Kegiatan","Uraian Kegiatan","Vol","Satuan","Waktu per Satuan","Total Jam","Jam Organik","Jam Mitra"];
 const a=["01","Produksi","IMK","Pemeriksaan","2","Dokumen","4","8","8","0"];
 const b=["01","Produksi","IMK","Rapat 5 jam x 8 orang","8","O-Keg","5","40","25","15"];
 const sheet='<worksheet><sheetData>'+row(2,header)+row(3,a)+row(4,b)+'</sheetData></worksheet>';
 const entries={
  "xl/workbook.xml":strToU8('<workbook><sheets><sheet name="Rekap Tim" sheetId="1" r:id="rId1"/><sheet name="2027" sheetId="2" r:id="rId2"/></sheets></workbook>'),
  "xl/_rels/workbook.xml.rels":strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>'),
  "xl/worksheets/sheet1.xml":strToU8('<worksheet><sheetData></sheetData></worksheet>'),
  "xl/worksheets/sheet2.xml":strToU8(sheet)
 };
 const file=new File([zipSync(entries)],"matriks.xlsx");
 assert.deepEqual(await xlsxSheets(file),["Rekap Tim","2027"]);
 const info=await xlsxSheetInfo(file,"2027");
 assert.deepEqual(info,{headerRow:2,firstRow:3,lastRow:4});
 const selected=await xlsxRows(file,2027,{sheetName:"2027",startRow:4,endRow:4});
 assert.equal(selected.length,1);assert.equal(selected[0].description,"Rapat 5 jam x 8 orang");
 assert.equal(selected[0].organic,25);assert.equal(selected[0].partner,15);
 await assert.rejects(()=>xlsxRows(file,2027,{sheetName:"2027",startRow:2,endRow:4}),/Baris awal minimal 3/);
 await assert.rejects(()=>xlsxRows(file,2027,{sheetName:"Rekap Tim",startRow:3,endRow:4}),/Format kolom/);
});
test("salin tahun sebelumnya tidak mengubah data sumber dan reset pembagian personel",()=>{
 const before=[{id:"T-1",group:"Produksi",description:"Rapat",organic:25,partner:15,volume:8,standard:5}];
 const result=previousYearDraft(before,2028);
 assert.equal(result[0].id,"REK-2028-0");
 assert.equal(result[0].organic,null);assert.equal(result[0].partner,null);
 assert.equal(result[0].volume,8);assert.equal(result[0].standard,5);
 assert.equal(before[0].organic,25);
});
