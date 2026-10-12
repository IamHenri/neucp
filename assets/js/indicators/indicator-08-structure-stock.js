// Indicateur — Structure du stock : catégories d'émetteurs et concentration
// Chaque mois, à partir de encours_eur_m :
//  - poids de chaque catégorie d'émetteur dans l'encours total (barres empilées, en %) ;
//  - part des TOP_N premiers émetteurs dans l'encours total (courbe, en %) ;
//  - nombre d'émetteurs actifs et indice de concentration (HHI), affichés dans l'infobulle et le résumé.
// Les émetteurs sont identifiés par leur code (code_emetteur).
// Filtrable par type_tcn (cases à cocher) et devise (liste, EUR par défaut).
(function () {
  var CONTAINER_ID = "indicator-08";
  var TOP_N = 10; // nombre d'émetteurs pris dans la « part des premiers émetteurs »

  function fmt(v) {
    return Math.round(v).toLocaleString("fr-FR");
  }

  function fmtPct(v) {
    return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %";
  }

  function monthLabel(ym) {
    var p = ym.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }

  function addCheckboxes(fieldset, values, name) {
    values.forEach(function (v, i) {
      var id = CONTAINER_ID + "-" + name + "-" + i;
      var label = document.createElement("label");
      label.className = "filter-check";
      label.setAttribute("for", id);
      var input = document.createElement("input");
      input.type = "checkbox";
      input.id = id;
      input.value = v;
      input.checked = true;
      var span = document.createElement("span");
      span.textContent = v;
      label.appendChild(input);
      label.appendChild(span);
      fieldset.appendChild(label);
    });
  }

  function checkedValues(fieldset) {
    return [...fieldset.querySelectorAll("input[type=checkbox]:checked")].map(
      function (el) { return el.value; }
    );
  }

  // Structure de l'encours sur les lignes d'un mois ; null quand l'encours total est nul.
  function stats(rows) {
    var total = 0;
    var byCat = {};
    var byIssuer = new Map();
    rows.forEach(function (r) {
      var v = r.encours_eur_m || 0;
      total += v;
      byCat[r.categorie_emetteur] = (byCat[r.categorie_emetteur] || 0) + v;
      if (r.code_emetteur != null) byIssuer.set(r.code_emetteur, (byIssuer.get(r.code_emetteur) || 0) + v);
    });
    if (total <= 0) return null;
    var amounts = [...byIssuer.values()]
      .filter(function (v) { return v > 0; })
      .sort(function (a, b) { return b - a; });
    var top = amounts.slice(0, TOP_N).reduce(function (a, b) { return a + b; }, 0);
    var hhi = amounts.reduce(function (a, v) { return a + Math.pow((v / total) * 100, 2); }, 0);
    return { total: total, byCat: byCat, top: (top / total) * 100, hhi: hhi, n: amounts.length };
  }

  function render(container, raw) {
    var types = NEUCP.uniq(raw, "type_tcn");
    var cats = NEUCP.uniq(raw, "categorie_emetteur");
    var devises = NEUCP.uniq(raw, "devise");
    var allMonths = [...new Set(raw.map(function (r) { return r.date_reporting.slice(0, 7); }))].sort();

    container.innerHTML =
      "<h2>Structure du stock : catégories et concentration</h2>" +
      '<p class="indicator-sub">Poids de chaque catégorie d\'émetteur dans l\'encours total (barres, en %) et part des ' +
      TOP_N + " premiers émetteurs (courbe, en %). Encours en équivalent euro.</p>" +
      '<div class="filters">' +
      '  <fieldset class="filter-group" data-role="types"><legend>Type de titre</legend></fieldset>' +
      '  <div class="filter-group">' +
      '    <label class="filter-label" for="' + CONTAINER_ID + '-devise">Devise</label>' +
      '    <select id="' + CONTAINER_ID + '-devise" class="filter-select"></select>' +
      "  </div>" +
      "</div>" +
      '<p class="indicator-sub" data-role="latest"></p>' +
      '<div class="chart-wrap chart-wrap-tall"><canvas></canvas></div>' +
      '<div style="text-align:right;margin-top:8px">' +
      '  <button type="button" data-role="reset-zoom" class="filter-select" style="cursor:pointer">Réinitialiser le zoom</button>' +
      "</div>" +
      '<p class="indicator-sub" style="margin-top:14px"><strong>Valeurs calculées</strong> — ' +
      "poids d'une catégorie = encours de la catégorie ÷ encours total ; " +
      "part des " + TOP_N + " premiers = somme des " + TOP_N + " plus gros encours d'émetteur ÷ encours total ; " +
      "indice de concentration (HHI) = somme des carrés des parts de chaque émetteur, exprimées en % (10 000 = un seul émetteur) ; " +
      "émetteurs actifs = émetteurs ayant un encours positif.</p>";

    var fType = container.querySelector('[data-role="types"]');
    var fDevise = container.querySelector("#" + CONTAINER_ID + "-devise");
    var elLatest = container.querySelector('[data-role="latest"]');

    addCheckboxes(fType, types, "type");

    fDevise.innerHTML =
      '<option value="__all__">Toutes devises</option>' +
      devises.map(function (d) { return '<option value="' + d + '">' + d + "</option>"; }).join("");
    if (devises.includes("EUR")) fDevise.value = "EUR";

    var chart = null;

    function draw() {
      var selTypes = checkedValues(fType);
      var selDevise = fDevise.value;

      var filtered = raw.filter(function (r) {
        return selTypes.includes(r.type_tcn) && (selDevise === "__all__" || r.devise === selDevise);
      });
      var byMonth = NEUCP.groupBy(filtered, function (r) { return r.date_reporting.slice(0, 7); });
      var series = allMonths.map(function (m) {
        var rs = byMonth.get(m);
        return rs ? stats(rs) : null;
      });

      // Résumé du dernier mois disponible pour le périmètre choisi.
      var lastIdx = -1;
      series.forEach(function (s, i) { if (s) lastIdx = i; });
      if (lastIdx >= 0) {
        var l = series[lastIdx];
        elLatest.textContent =
          monthLabel(allMonths[lastIdx]) + " : les " + TOP_N + " premiers émetteurs représentent " + fmtPct(l.top) +
          " de l'encours ; " + fmt(l.n) + " émetteurs actifs ; indice de concentration (HHI) " + fmt(l.hhi) + ".";
      } else {
        elLatest.textContent = "Aucune donnée pour cette sélection.";
      }

      var palette = [
        NEUCP.cssVar("--accent", "#C9A227"),
        NEUCP.cssVar("--accent2", "#2FA8A0"),
        NEUCP.cssVar("--accent3", "#8A7BD1"),
        NEUCP.cssVar("--accent4", "#D1704F"),
      ];
      var muted = NEUCP.cssVar("--muted", "#9AA1AC");
      var border = NEUCP.cssVar("--border", "rgba(255,255,255,.08)");
      var panel = NEUCP.cssVar("--panel", "#121B2E");
      var text = NEUCP.cssVar("--text", "#EDEFF3");

      var datasets = cats.map(function (c, i) {
        return {
          type: "bar",
          label: c,
          data: series.map(function (s) { return s ? ((s.byCat[c] || 0) / s.total) * 100 : null; }),
          backgroundColor: palette[i % palette.length],
          stack: "categories",
          barPercentage: 1,
          categoryPercentage: 0.92,
          order: 1,
        };
      });
      datasets.push({
        type: "line",
        label: "Part des " + TOP_N + " premiers émetteurs",
        data: series.map(function (s) { return s ? s.top : null; }),
        borderColor: text,
        backgroundColor: text,
        borderWidth: 2,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 4,
        stack: "top",
        order: 0,
      });

      // Vue par défaut : les 12 derniers mois ; on peut dézoomer jusqu'au début des données.
      var defaultStart = allMonths.length > 12 ? allMonths.length - 12 : 0;

      var ctx = container.querySelector("canvas");
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: "bar",
        data: { labels: allMonths, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: true, labels: { color: text } },
            tooltip: {
              backgroundColor: panel,
              titleColor: text,
              bodyColor: text,
              borderColor: border,
              borderWidth: 1,
              padding: 12,
              cornerRadius: 8,
              filter: function (item) { return item.parsed.y != null; },
              callbacks: {
                title: function (items) { return monthLabel(items[0].label); },
                label: function (item) { return item.dataset.label + " : " + fmtPct(item.parsed.y); },
                afterBody: function (items) {
                  var s = series[items[0].dataIndex];
                  if (!s) return [];
                  return [
                    "",
                    "Encours total : " + fmt(s.total) + " M€",
                    "Émetteurs actifs : " + fmt(s.n),
                    "Indice de concentration (HHI) : " + fmt(s.hhi),
                  ];
                },
              },
            },
            zoom: {
              limits: { x: { min: 0, max: allMonths.length - 1, minRange: 2 } },
              pan: { enabled: true, mode: "x" },
              zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
            },
          },
          scales: {
            x: {
              stacked: true,
              min: allMonths[defaultStart],
              max: allMonths[allMonths.length - 1],
              ticks: { color: muted, maxRotation: 0, autoSkip: true },
              grid: { display: false },
            },
            y: {
              stacked: true,
              min: 0,
              max: 100,
              title: { display: true, text: "Part de l'encours total (%)", color: muted },
              ticks: { color: muted, callback: function (v) { return v + " %"; } },
              grid: { color: border },
            },
          },
        },
      });

      var resetBtn = container.querySelector('[data-role="reset-zoom"]');
      if (resetBtn) resetBtn.onclick = function () { if (chart) chart.resetZoom(); };
    }

    container.addEventListener("change", draw);
    draw();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    NEUCP.loadData()
      .then(function (raw) { render(container, raw); })
      .catch(function (err) {
        container.innerHTML =
          '<p style="color:var(--muted)">Impossible de charger les données (' + err.message + ").</p>";
      });
  });
})();
