/* global lunr */
(async () => {
  // 1 ─ fetch dataset --------------------------------------------------------
  const res = await fetch(window.POM_JSON_PATH);
  const data = await res.json();

  // 2 ─ flatten records + collect filter vocab ------------------------------
  const docs = [], labelSet = new Set(), elemSet = new Set();
  for (const [id, d] of Object.entries(data)) {
    (d.Labels || []).forEach(l => labelSet.add(l));
    Object.keys(d["Contains Elements"]).forEach(e => elemSet.add(e));

    docs.push({
      id,
      formula   : d["POM Formula"],
      labelsArr : d.Labels || [],
      labels    : (d.Labels || []).join(" "),
      elements  : Object.keys(d["Contains Elements"]).join(" "),
      mass      : +d["Molecular Mass"],
      charge    : +d["Charge"],
      mats      : Object.values(d["POM Material Formula"] || {})
    });
  }

  // 3 ─ build lunr index -----------------------------------------------------
  const idx = lunr(function () {
    this.ref("id");
    this.field("formula", { boost: 10 });
    this.field("labels");
    this.field("elements");
    this.field("materials");

    docs.forEach(doc => this.add({
      id: doc.id,
      formula: doc.formula,
      labels: doc.labels,
      elements: doc.elements,
      materials: doc.mats.map(m => m["POM Material Formula"]).join(" ")
    }));
  });

  // 4 ─ build filter buttons -------------------------------------------------
  const makeBtns = (set, host, cls) => {
    [...set].sort().forEach(v => {
      const b = document.createElement("button");
      b.textContent = v;
      b.dataset.v = v;
      b.className = cls;
      b.onclick = () => { b.classList.toggle("on"); run(); };
      host.appendChild(b);
    });
  };
  makeBtns(labelSet,  document.getElementById("label-filters"),   "lbl");
  makeBtns(elemSet,   document.getElementById("element-filters"), "el");

  // 5 ─ wire all inputs ------------------------------------------------------
  const byId = id => document.getElementById(id);
  ["q","mass-min","mass-max","charge-min","charge-max"].forEach(
    id => byId(id).addEventListener("input", run)
  );

  const tbody = document.querySelector("#results tbody");

  // 6 ─ main render ----------------------------------------------------------
  function run () {
    tbody.innerHTML = "";

    const q     = byId("q").value.trim();
    const mMin  = parseFloat(byId("mass-min").value);
    const mMax  = parseFloat(byId("mass-max").value);
    const cMin  = parseFloat(byId("charge-min").value);
    const cMax  = parseFloat(byId("charge-max").value);
    const lblON = [...document.querySelectorAll(".lbl.on")].map(b => b.dataset.v);
    const elON  = [...document.querySelectorAll(".el.on") ].map(b => b.dataset.v);

    let hits = q ? idx.search(q) : docs.map(d => ({ ref: d.id }));

    hits.forEach(h => {
      const d = docs.find(x => x.id === h.ref);   // local flattened record

      if (lblON.length && !lblON.some(l => d.labelsArr.includes(l))) return;
      if (elON.length && !elON.some(e => d.elements.split(" ").includes(e))) return;

      if (!isNaN(mMin) && d.mass < mMin) return;
      if (!isNaN(mMax) && d.mass > mMax) return;
      if (!isNaN(cMin) && d.charge < cMin) return;
      if (!isNaN(cMax) && d.charge > cMax) return;

      // ----- build table row ------------------------------------------------
      const tr = tbody.insertRow();
      tr.insertCell().textContent = d.id;
      tr.insertCell().textContent = d.formula;
      tr.insertCell().textContent = d.mass.toFixed(3);
      tr.insertCell().textContent = d.charge;
      tr.insertCell().textContent = d.labelsArr.join(", ");

      const matsCell = tr.insertCell();
      matsCell.innerHTML =
        d.mats.map(m => `<a href="https://doi.org/${m.DOI}" target="_blank">${m["POM Material Formula"]}</a>`)
              .join("<br>");
    });

    if (!tbody.rows.length) {
      const tr = tbody.insertRow();
      const td = tr.insertCell();
      td.colSpan = 6;
      td.innerHTML = "<em>No matches.</em>";
    }
  }

  run(); // initial load
})();
