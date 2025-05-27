/* global lunr */
(async () => {
  // 1. Load the dataset Jekyll has copied to _site/_data
  const res   = await fetch('{{ "/_data/Curated_POMs.json" | relative_url }}');
  const data  = await res.json();              // keys = POM ids

  // 2. Flatten each record into fields Lunr can index
  const docs = Object.entries(data).map(([id, d]) => ({
    id,
    formula   : d['POM Formula'],
    molecular : d['Molecular Formula'],
    labels    : (d.Labels || []).join(' '),
    elements  : Object.keys(d['Contains Elements']).join(' ')
  }));

  // 3. Build the index
  const idx = lunr(function () {
    this.ref('id');
    this.field('formula',   { boost: 10 });
    this.field('molecular');
    this.field('labels');
    this.field('elements');

    docs.forEach(doc => this.add(doc));
  });

  // 4. Wire up the UI
  const box  = document.getElementById('search-box');
  const list = document.getElementById('results');

  box.addEventListener('input', () => {
    list.innerHTML = '';
    const q   = box.value.trim();
    if (q.length < 2) return;                 // debounce tiny queries
    idx.search(q).forEach(hit => {
      const d = data[hit.ref];
      const li = document.createElement('li');
      li.innerHTML =
        `<strong>${d['POM Formula']}</strong> (${hit.ref}) – `
      + `${d['Molecular Mass']} amu, charge ${d.Charge}`;
      list.appendChild(li);
    });
  });
})();
