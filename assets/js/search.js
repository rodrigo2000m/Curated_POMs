/* global lunr */
(async () => {
  const res  = await fetch('{{ "/_data/Curated_POMs.json" | relative_url }}');
  const data = await res.json();                   // keyed by POM_ID

  // --- 1. Prepare docs for lunr & collect filters --------------------------
  const labelSet   = new Set();
  const elementSet = new Set();
  const docs       = [];

  for (const [id, d] of Object.entries(data)) {
    // gather unique labels & elements
    (d.Labels || []).forEach(l => labelSet.add(l));
    Object.keys(d['Contains Elements']).forEach(el => elementSet.add(el));

    docs.push({
      id,
      formula   : d['POM Formula'],
      molecular : d['Molecular Formula'],
      labels    : (d.Labels || []).join(' '),
      elements  : Object.keys(d['Contains Elements']).join(' '),
      materials : Object
        .values(d['POM Material'] || {})
        .map(m => m['Material Formula'])
        .join(' ')
    });
  }

  // --- 2. Build lunr index --------------------------------------------------
  const idx = lunr(function () {
    this.ref('id');
    this.field('formula',   { boost: 10 });
    this.field('molecular');
    this.field('labels');
    this.field('elements');
    this.field('materials');

    docs.forEach(doc => this.add(doc));
  });

  // --- 3. Build filter UI ---------------------------------------------------
  const buildToggles = (set, targetId, cssClass) => {
    const wrap = document.getElementById(targetId);
    [...set].sort().forEach(val => {
      const btn = document.createElement('button');
      btn.textContent = val;
      btn.dataset.value = val;
      btn.className = cssClass;
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        runSearch();
      });
      wrap.appendChild(btn);
    });
  };
  buildToggles(labelSet,   'label-filters',   'label-btn');
  buildToggles(elementSet, 'element-filters', 'element-btn');

  const qInput = document.getElementById('q');
  const list   = document.getElementById('results');
  qInput.addEventListener('input', runSearch);

  // --- 4. Search + filter ---------------------------------------------------
  function runSearch () {
    list.innerHTML = '';
    const qStr = qInput.value.trim();
    const labelON   = [...document.querySelectorAll('.label-btn.active')]
                        .map(b => b.dataset.value);
    const elementON = [...document.querySelectorAll('.element-btn.active')]
                        .map(b => b.dataset.value);

    // start with either all docs or a lunr result set
    let hits = qStr.length < 2
      ? docs.map(d => ({ ref: d.id }))          // no query → every record
      : idx.search(qStr);

    hits.forEach(hit => {
      const d = data[hit.ref];

      // mandatory label filter?
      if (labelON.length && !labelON.some(l => d.Labels?.includes(l))) return;
      // mandatory element filter?
      if (elementON.length &&
          !elementON.some(el => Object.keys(d['Contains Elements']).includes(el)))
        return;

      // --- build result card ----------------------------------------------
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${d['POM Formula']}</strong>
        <small>${hit.ref}</small><br/>
        ${d['Molecular Mass']} amu &nbsp; charge ${d.Charge}<br/>
        <em>${(d.Labels || []).join(', ')}</em><br/>
        ${Object.values(d['POM Material'] || {})
                 .map(m => `<a href="https://doi.org/${m.DOI}" target="_blank">${m['Material Formula']}</a>`)
                 .join('<br/>')}
      `;
      list.appendChild(li);
    });

    if (!list.childElementCount) {
      list.innerHTML = '<li><em>No matches.</em></li>';
    }
  }

  // initial render (shows everything)
  runSearch();
})();
