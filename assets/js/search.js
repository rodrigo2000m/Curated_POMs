/* global lunr */
(async () => {
  // -------------------------------------------------------------------------
  // 1. Load dataset
  // -------------------------------------------------------------------------
  const res  = await fetch(window.POM_JSON_PATH);
  const data = await res.json();                 // keys = POM_IDs

  // -------------------------------------------------------------------------
  // 2. Flatten records for Lunr + collect filter vocabularies
  // -------------------------------------------------------------------------
  const labels   = new Set();
  const elements = new Set();
  const docs     = [];

  for (const [id, d] of Object.entries(data)) {
    (d.Labels || []).forEach(l => labels.add(l));
    Object.keys(d["Contains Elements"]).forEach(e => elements.add(e));

    docs.push({
      id,
      formula   : d["POM Formula"],
      molecular : d["Molecular Formula"],
      labels    : (d.Labels || []).join(" "),
      elements  : Object.keys(d["Contains Elements"]).join(" "),
      mass      : parseFloat(d["Molecular Mass"]),
      charge    : parseFloat(d["Charge"]),
      materials : Object
                   .values(d["POM Material Formula"] || {})
                   .map(m => m["POM Material Formula"])
                   .join(" ")
    });
  }

  // -------------------------------------------------------------------------
  // 3. Build Lunr index
  // -------------------------------------------------------------------------
  const idx = lunr(function () {
    this.ref("id");
    this.field("formula",   { boost: 10 });
    this.field("molecular");
    this.field("labels");
    this.field("elements");
    this.field("materials");

    docs.forEach(doc => this.add(doc));
  });

  // -------------------------------------------------------------------------
  // 4. Build filter buttons
  // -------------------------------------------------------------------------
  function makeToggles(set, hostId, css) {
    const host = document.getElementById(hostId);
    [...set].sort().forEach(val => {
      const b = document.createElement("button");
      b.textContent  = val;
      b.dataset.val  = val;
      b.className    = css;
      b.onclick = () => { b.classList.toggle("on"); run(); };
      host.appendChild(b);
    });
  }
  makeToggles(labels,   "label-filters",   "lbl");
  makeToggles(elements, "element-filters", "el");

  // -------------------------------------------------------------------------
  // 5. Hook UI events
  // -------------------------------------------------------------------------
  const qIn      = document.getElementById("q");
  const resList  = document.getElementById("results");

  ["input", "change"].forEach(ev => {
    qIn.addEventListener(ev, run);
    document.getElementById("mass-min").addEventListener(ev, run);
    document.getElementById("mass-max").addEventListener(ev, run);
    document.getElementById("charge-min").addEventListener(ev, run);
    document.getElementById("charge-max").addEventListener(ev, run);
  });

  // -------------------------------------------------------------------------
  // 6. Search + filter
  // -------------------------------------------------------------------------
  function run () {
    resList.innerHTML = "";

    const query      = qIn.value.trim();
    const massMin    = parseFloat(document.getElementById("mass-min").value);
    const massMax    = parseFloat(document.getElementById("mass-max").value);
    const chMin      = parseFloat(document.getElementById("charge-min").value);
    const chMax      = parseFloat(document.getElementById("charge-max").value);
    const lblON      = [...document.querySelectorAll(".lbl.on")].map(b => b.dataset.val);
    const elON       = [...document.querySelectorAll(".el.on") ].map(b => b.dataset.val);

    // base set: all docs or text-search subset
    let hits = !query
      ? docs.map(d => ({ ref: d.id }))
      : idx.search(query);

    hits.forEach(h => {
      const d = data[h.ref];

      // label filter
      if (lblON.length && !lblON.some(l => d.Labels?.includes(l))) return;
      // element filter
      if (elON.length && !elON.some(e => d["Contains Elements"][e])) return;
      // mass filter
      const mass = parseFloat(d["Molecular Mass"]);
      if (!isNaN(massMin) && mass < massMin) return;
      if (!isNaN(massMax) && mass > massMax) return;
      // charge filter
      const ch = parseFloat(d["Charge"]);
      if (!isNaN(chMin) && ch < chMin) return;
      if (!isNaN(chMax) && ch > chMax) return;

      // ---- render card -----------------------------------------------------
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${d["POM Formula"]}</strong>
        <small>(${h.ref})</small><br>
        ${mass.toFixed(3)} amu &nbsp; charge ${ch}<br>
        <em>${(d.Labels || []).join(", ")}</em><br>
        ${
          Object.values(d["POM Material Formula"] || {})
                .map(m => `<a href="https://doi.org/${m.DOI}" target="_blank">${m["POM Material Formula"]}</a>`)
                .join("<br>")
        }
      `;
      resList.appendChild(li);
    });

    if (!resList.childElementCount) {
      resList.innerHTML = "<li><em>No matches.</em></li>";
    }
  }

  // initial load
  run();
})();
