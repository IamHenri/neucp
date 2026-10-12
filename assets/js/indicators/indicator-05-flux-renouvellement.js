// Indicateur 5 — Flux d'émission et taux de renouvellement
// Données Banque de France additionnées par mois : émissions, tombées, rachats (M€, équivalent euro).
// Valeurs calculées : émission nette, résidu et taux de renouvellement (formules affichées sous le graphe).
// Filtrable par type_tcn, categorie_emetteur, zone_geographique (cases à cocher) et devise (liste, EUR par défaut).
(function () {
  var CONTAINER_ID = "indicator-05";

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

  function render(container, raw) {
    var types = NEUCP.uniq(raw, "type_tcn");
    var cats = NEUCP.uniq(raw, "categorie_emetteur");
    var zones = NEUCP.uniq(raw, "zone_geographique");
    var devises = NEUCP.uniq(raw, "devise");

    // Axe horizontal : tous les mois présents dans les données, pour que les
    // mois sans ligne après filtrage restent visibles comme des vides.
    var allMonths = [...new Set(raw.map(function (r) { return r.date_reporting.slice(0, 7); }))].sort();

    container.innerHTML =
      "<h2>Flux d'émission et taux de renouvellement</h2>" +
      '<p class="indicator-sub">Émissions, tombées et rachats du mois (M€, équivalent euro), additionnés sur le périmètre choisi. ' +
      "Les tombées et les rachats sont des sorties : ils figurent en négatif, comme dans le fichier Banque de France.</p>" +
      '<div class="filters">' +
      '  <fieldset class="filter-group" data-role="types"><legend>Type de titre</legend></fieldset>' +
      '  <fieldset class="filter-group" data-role="cats"><legend>Catégorie d\'émetteur</legend></fieldset>' +
      '  <fieldset class="filter-group" data-role="zones"><legend>Zone géographique</legend></fieldset>' +
      '  <div class="filter-group">' +
      '    <label class="filter-label" for="' + CONTAINER_ID + '-devise">Devise</label>' +
      '    <select id="' + CONTAINER_ID + '-devise" class="filter-select"></select>' +
      "  </div>" +
      "</div>" +
      '<div class="chart-wrap chart-wrap-tall"><canvas></canvas></div>' +
      '<div style="text-align:right;margin-top:8px">' +
      '  <button type="button" data-role="reset-zoom" class="filter-select" style="cursor:pointer">Réinitialiser le zoom</button>' +
      "</div>" +
      '<p class="indicator-sub" style="margin-top:14px"><strong>Valeurs calculées</strong> — ' +
      "émission nette = émissions + tombées + rachats ; " +
      "taux de renouvellement = |tombées| ÷ encours du mois précédent ; " +
      "résidu = variation d'encours − émission nette (écart non expliqué par les flux déclarés).</p>";

    var fType = container.querySelector('[data-role="types"]');
    var fCat = container.querySelector('[data-role="cats"]');
    var fZone = container.querySelector('[data-role="zones"]');
    var fDevise = container.querySelector("#" + CONTAINER_ID + "-devise");

    addCheckboxes(fType, types, "type");
    addCheckboxes(fCat, cats, "cat");
    addCheckboxes(fZone, zones, "zone");

    fDevise.innerHTML =
      '<option value="__all__">Toutes devises</option>' +
      devises.map(function (d) { return '<option value="' + d + '">' + d + "</option>"; }).join("");
    if (devises.includes("EUR")) fDevise.value = "EUR";

    var chart = null;

    function draw() {
      var selTypes = checkedValues(fType);
      var selCats = checkedValues(fCat);
      var selZones = checkedValues(fZone);
      var selDevise = fDevise.value;

      var filtered = raw.filter(function (r) {
        return (
          selTypes.includes(r.type_tcn) &&
          selCats.includes(r.categorie_emetteur) &&
          selZones.includes(r.zone_geographique) &&
          (selDevise === "__all__" || r.devise === selDevise)
        );
      });
      var byMonth = NEUCP.groupBy(filtered, function (r) { return r.date_reporting.slice(0, 7); });

      // Une entrée par mois ; null quand aucune ligne ne correspond au périmètre.
      var series = allMonths.map(function (m) {
        var rs = byMonth.get(m);
        if (!rs) return null;
        var em = NEUCP.sum(rs, function (r) { return r.emissions_eur; });
        var tb = NEUCP.sum(rs, function (r) { return r.tombees_eur; });
        var rc = NEUCP.sum(rs, function (r) { return r.rachats_eur; });
        var stock = NEUCP.sum(rs, function (r) { return r.encours_eur_m; });
        var stockPrev = NEUCP.sum(rs, function (r) { return r.encours_eur_m1; });
        var net = em + tb + rc;
        return {
          em: em,
          tb: tb,
          rc: rc,
          net: net,
          delta: stock - stockPrev,
          resid: stock - stockPrev - net,
          ratio: stockPrev > 0 ? (Math.abs(tb) / stockPrev) * 100 : null,
        };
      });
      function pick(key) {
        return series.map(function (s) { return s ? s[key] : null; });
      }

      var cEmis = NEUCP.cssVar("--accent", "#C9A227");
      var cTomb = NEUCP.cssVar("--accent2", "#2FA8A0");
      var cRach = NEUCP.cssVar("--accent3", "#8A7BD1");
      var cRatio = NEUCP.cssVar("--accent4", "#D1704F");
      var muted = NEUCP.cssVar("--muted", "#9AA1AC");
      var border = NEUCP.cssVar("--border", "rgba(255,255,255,.08)");
      var panel = NEUCP.cssVar("--panel", "#121B2E");
      var text = NEUCP.cssVar("--text", "#EDEFF3");

      // Vue par défaut : les 12 derniers mois ; on peut dézoomer jusqu'au début des données.
      var defaultStart = allMonths.length > 12 ? allMonths.length - 12 : 0;

      var ctx = container.querySelector("canvas");
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: allMonths,
          datasets: [
            { type: "bar", label: "Émissions", data: pick("em"), backgroundColor: cEmis, stack: "flux", order: 1 },
            { type: "bar", label: "Tombées", data: pick("tb"), backgroundColor: cTomb, stack: "flux", order: 1 },
            { type: "bar", label: "Rachats", data: pick("rc"), backgroundColor: cRach, stack: "flux", order: 1 },
            {
              type: "line", label: "Émission nette", data: pick("net"),
              borderColor: text, backgroundColor: text, borderWidth: 2, tension: 0.2,
              pointRadius: 0, pointHoverRadius: 4, stack: "net", yAxisID: "y", order: 0,
            },
            {
              type: "line", label: "Taux de renouvellement", data: pick("ratio"),
              borderColor: cRatio, backgroundColor: cRatio, borderWidth: 2, borderDash: [5, 4], tension: 0.2,
              pointRadius: 0, pointHoverRadius: 4, yAxisID: "y2", order: 0,
            },
          ],
        },
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
                label: function (item) {
                  if (item.dataset.yAxisID === "y2") return item.dataset.label + " : " + fmtPct(item.parsed.y);
                  return item.dataset.label + " : " + fmt(item.parsed.y) + " M€";
                },
                afterBody: function (items) {
                  var s = series[items[0].dataIndex];
                  if (!s) return [];
                  return ["", "Variation d'encours : " + fmt(s.delta) + " M€", "Résidu : " + fmt(s.resid) + " M€"];
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
              title: { display: true, text: "Flux mensuels (M€)", color: muted },
              ticks: { color: muted },
              grid: {
                color: function (c) { return c.tick && c.tick.value === 0 ? muted : border; },
              },
            },
            y2: {
              position: "right",
              beginAtZero: true,
              title: { display: true, text: "Taux de renouvellement (%)", color: muted },
              ticks: { color: muted, callback: function (v) { return v + " %"; } },
              grid: { drawOnChartArea: false },
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
