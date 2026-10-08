// Indicateur 1 — Encours total du marché
// Somme de encours_eur_m, tous émetteurs, par mois.
// Filtrable par type_tcn (cases à cocher), categorie_emetteur (cases à cocher),
// zone_geographique (cases à cocher) et devise (liste déroulante).
(function () {
  var CONTAINER_ID = "indicator-03";

  function addCheckboxes(fieldset, values, name) {
    values.forEach(function (v, i) {
      var id = name + "-" + i;
      var label = document.createElement("label");
      label.className = "filter-check";
      label.setAttribute("for", id);
      label.innerHTML =
        '<input type="checkbox" id="' + id + '" value="' + v + '" checked>' +
        "<span>" + v + "</span>";
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

    container.innerHTML =
      "<h2>Encours total du marché</h2>" +
      '<p class="indicator-sub">Somme de l\'encours (M€), tous émetteurs, par mois. ' +
      "Donnée Banque de France, non retraitée — seule la sélection de segments ci-dessous " +
      "change le périmètre additionné.</p>" +
      '<div class="filters">' +
      '  <fieldset class="filter-group" id="f-type"><legend>Type de titre</legend></fieldset>' +
      '  <fieldset class="filter-group" id="f-cat"><legend>Catégorie d\'émetteur</legend></fieldset>' +
      '  <fieldset class="filter-group" id="f-zone"><legend>Zone géographique</legend></fieldset>' +
      '  <div class="filter-group">' +
      '    <label class="filter-label" for="f-devise">Devise</label>' +
      '    <select id="f-devise" class="filter-select"></select>' +
      "  </div>" +
      "</div>" +
      '<div class="chart-wrap"><canvas id="chart-encours-total"></canvas></div>' +
      '<div style="text-align:right;margin-top:8px">' +
      '  <button type="button" id="btn-reset-zoom" class="filter-select" style="cursor:pointer">Réinitialiser le zoom</button>' +
      "</div>";

    var fType = container.querySelector("#f-type");
    var fCat = container.querySelector("#f-cat");
    var fZone = container.querySelector("#f-zone");
    var fDevise = container.querySelector("#f-devise");

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
      var months = [...byMonth.keys()].sort();
      var totals = months.map(function (m) { return NEUCP.sum(byMonth.get(m), function (r) { return r.encours_eur_m; }); });

      var accent = NEUCP.cssVar("--accent", "#C9A227");
      var muted = NEUCP.cssVar("--muted", "#9AA1AC");
      var border = NEUCP.cssVar("--border", "rgba(255,255,255,.08)");
      var panel = NEUCP.cssVar("--panel", "#121B2E");
      var text = NEUCP.cssVar("--text", "#EDEFF3");

      // Vue par défaut : les 12 derniers mois. L'historique complet reste
      // chargé — dézoomer (molette, pincement, ou glisser) remonte jusqu'au
      // début des données disponibles, sans jamais recharger de données.
      var defaultStart = months.length > 12 ? months.length - 12 : 0;

      var ctx = container.querySelector("canvas");
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: months,
          datasets: [{
            label: "Encours total",
            data: totals,
            borderColor: accent,
            backgroundColor: "transparent",
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: accent,
            pointHitRadius: 10,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "nearest", axis: "x", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: panel,
              titleColor: text,
              bodyColor: text,
              borderColor: border,
              borderWidth: 1,
              padding: 12,
              cornerRadius: 8,
              displayColors: false,
              callbacks: {
                label: function (item) {
                  return "Encours total : " + Math.round(item.parsed.y).toLocaleString("fr-FR") + " M€";
                },
              },
            },
            zoom: {
              limits: { x: { min: 0, max: months.length - 1, minRange: 2 } },
              pan: { enabled: true, mode: "x" },
              zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
            },
          },
          scales: {
            x: {
              min: months[defaultStart],
              max: months[months.length - 1],
              ticks: { color: muted, maxRotation: 0, autoSkip: true },
              grid: { color: border },
            },
            y: {
              title: { display: true, text: "Encours (M€)", color: muted },
              ticks: { color: muted },
              grid: { color: border },
            },
          },
        },
      });

      var resetBtn = container.querySelector("#btn-reset-zoom");
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
