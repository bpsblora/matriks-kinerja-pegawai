import reference from "./data/reference2026.json";

// Anonymous development reference only. Real employee records stay in Firestore,
// protected by server-enforced security rules and institutional approval.
export function createReference2026View() {
  const container = document.createElement("section");
  container.className = "reference-view";
  const heading = document.createElement("div");
  heading.className = "reference-head";
  const title = document.createElement("h2");
  title.textContent = "Referensi Matriks 2026";
  const caption = document.createElement("p");
  caption.textContent = "Data acuan dari prototipe 2026. Identitas pegawai disamarkan; 22 kegiatan hanyalah contoh. Tidak ada perubahan yang dikirim ke database.";
  heading.append(title, caption);

  const stats = document.createElement("div");
  stats.className = "reference-stats";
  const cards = [
    ["Tim Kerja", reference.teams.length],
    ["Pegawai (Anonim)", reference.employees.length],
    ["KRO Teridentifikasi", reference.kros.length],
    ["Kegiatan Sumber 2026", reference.meta.originalActivityCount]
  ];
  for (const [label, value] of cards) {
    const card = document.createElement("div");
    card.className = "reference-stat";
    const small = document.createElement("span");
    small.textContent = label;
    const big = document.createElement("strong");
    big.textContent = new Intl.NumberFormat("id-ID").format(value);
    card.append(small, big);
    stats.append(card);
  }

  const filters = document.createElement("div");
  filters.className = "reference-filters";
  const year = document.createElement("span");
  year.className = "year-mark";
  year.textContent = "2026 · DATA ACUAN";
  const teamSelect = document.createElement("select");
  teamSelect.setAttribute("aria-label", "Filter tim kerja");
  const every = document.createElement("option");
  every.value = "";
  every.textContent = "Seluruh Tim";
  teamSelect.append(every);
  reference.teams.forEach((team) => {
    const opt = document.createElement("option");
    opt.value = team.id;
    opt.textContent = team.name;
    teamSelect.append(opt);
  });
  const search = document.createElement("input");
  search.placeholder = "Cari KRO atau uraian kegiatan…";
  search.setAttribute("aria-label", "Cari KRO atau kegiatan");
  filters.append(year, teamSelect, search);

  const teamSection = document.createElement("section");
  const teamHeading = document.createElement("h3");
  teamHeading.textContent = "Daftar Tim Kerja";
  const teamGrid = document.createElement("div");
  teamGrid.className = "team-grid";
  teamSection.append(teamHeading, teamGrid);

  const kroSection = document.createElement("section");
  const kroHeading = document.createElement("h3");
  kroHeading.textContent = "Daftar Induk KRO dan Tim Pengampu";
  const kroTable = document.createElement("div");
  kroTable.className = "table-wrap";
  kroSection.append(kroHeading, kroTable);

  const activitySection = document.createElement("section");
  const activityHeading = document.createElement("h3");
  activityHeading.textContent = "Contoh Uraian Kegiatan 2026";
  const activityTable = document.createElement("div");
  activityTable.className = "table-wrap";
  activitySection.append(activityHeading, activityTable);

  const info = document.createElement("p");
  info.className = "warning";
  info.textContent = "Catatan: kegiatan contoh bukan daftar lengkap 1.412 kegiatan; satuan dan jadwal harus diverifikasi kembali sebelum dipakai operasional.";
  container.append(heading, stats, filters, teamSection, kroSection, activitySection, info);

  const th = (value) => {const el = document.createElement("th");el.textContent = value;return el;};
  const td = (value) => {const el = document.createElement("td");el.textContent = String(value);return el;};
  const table = (cols, rows) => {
    const el = document.createElement("table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    cols.forEach(v => headRow.append(th(v)));
    head.append(headRow);
    const body = document.createElement("tbody");
    for (const values of rows) {
      const tr = document.createElement("tr");
      values.forEach(v => tr.append(td(v)));
      body.append(tr);
    }
    if (!rows.length) {
      const tr = document.createElement("tr");
      const cell = td("Tidak ada data yang sesuai filter.");
      cell.colSpan = cols.length;
      tr.append(cell);
      body.append(tr);
    }
    el.append(head, body);
    return el;
  };

  function redraw() {
    const tid = teamSelect.value;
    const query = search.value.trim().toLocaleLowerCase("id-ID");
    teamGrid.replaceChildren();
    const selected = reference.teams.filter(t => (!tid || t.id === tid) && (!query || (t.name + " " + t.id).toLocaleLowerCase("id-ID").includes(query)));
    selected.forEach(t => {
      const c = document.createElement("article");
      c.className = "team-card";
      const h = document.createElement("strong");
      h.textContent = t.name;
      const details = document.createElement("p");
      details.textContent = "Ketua: " + (t.leadId || "—") + " · " + t.memberIds.length + " Anggota";
      const source = document.createElement("small");
      source.textContent = (t.summary?.activities || 0) + " Kegiatan Tercatat pada Rekap Sumber 2026";
      c.append(h, details, source);
      teamGrid.append(c);
    });
    const kroRows = reference.kros
      .filter(k => (!tid || k.teamIds.includes(tid)) && (!query || (k.code + " " + k.name).toLocaleLowerCase("id-ID").includes(query)))
      .map(k => [k.code, k.name, k.teamIds.map(id => reference.teams.find(t => t.id === id)?.name || id).join(", ")]);
    kroTable.replaceChildren(table(["Kode KRO", "Nama KRO", "Tim Pengampu (Acuan)"], kroRows));
    const activityRows = reference.sampleActivities
      .filter(a => (!tid || a.teamId === tid) && (!query || (a.title + " " + a.kroCode).toLocaleLowerCase("id-ID").includes(query)))
      .map(a => [a.id, reference.teams.find(t => t.id === a.teamId)?.name || a.teamId, a.title, a.volume + " " + a.unit, a.kroCode]);
    activityTable.replaceChildren(table(["ID", "Tim", "Uraian", "Volume", "KRO"], activityRows));
  }
  teamSelect.addEventListener("change", redraw);
  search.addEventListener("input", redraw);
  redraw();
  return container;
}
