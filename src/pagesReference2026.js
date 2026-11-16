function updateSeed(html,id,patch){
 const opening='<script id="'+id+'" type="application/json">';
 const start=html.indexOf(opening);
 const end=html.indexOf("</script>",start+opening.length);
 if(start<0||end<0)throw Error("Acuan matriks 2026 tidak lengkap.");
 const offset=start+opening.length;
 const updated={...JSON.parse(html.slice(offset,end)),...patch};
 const serialized=JSON.stringify(updated).replaceAll("<","\\u003c");
 return html.slice(0,offset)+serialized+html.slice(end);
}

export function withOriginalReference2026(html,reference){
 const {meta,employees,official_roster,extra_teams_in_roster}=reference;
 const withPeople=updateSeed(html,"seed",{meta:{...meta,originalWorkbookNames:true},employees});
 return updateSeed(withPeople,"kroSeed",{official_roster,extra_teams_in_roster});
}
