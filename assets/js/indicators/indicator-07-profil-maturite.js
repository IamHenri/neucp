// Indicateur — Profil de maturité par type de titre
// Pour chaque type (NEU CP, NEU MTN), deux moyennes pondérées calculées chaque mois, en jours :
//  - durée résiduelle de l'encours, pondérée par l'encours (encours_eur_m) ;
//  - durée initiale des émissions, pondérée par les émissions (emissions_eur).
// Le fichier Banque de France ne publie que des moyennes par ligne : on les pondère par le montant de la ligne.
// Filtrable par categorie_emetteur et zone_geographique (cases à cocher) et devise (liste, EUR par défaut).
(function () {
  var CONTAINER_ID = "indicator-07";

  function fmt(v) {
    return Math.round(v).toLocaleString("fr-FR");
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

  // Moyennes pondérées d'un type de titre sur les lignes d'un mois.
  // Les lignes sans durée renseignée sont ignorées pour la moyenne concernée.
  function stats(rows, type) {
    var sumR = 0, wR = 0, sumI = 0, wI = 0, stock = 0, em = 0;
    rows.forEach(function (r) {
      if (r.type_tcn !== type) return;
      stock += r.encours_eur_m || 0;
      em += r.emissions_eur || 0;
      if (r.duree_residuelle_jours != null && r.encours_eur_m > 0) {
        sumR += r.duree_residuelle_jours * r.encours_eur_m;
        wR += r.encours_eur_m;
      }
      if (r.duree_initiale_jours != null && r.emissions_eur > 0) {
        sumI += r.duree_initiale_jours * r.emissions_eur;
        wI += r.emissions_eur;
      }
    });
    return {
      resid: wR > 0 ? sumR / wR : null,
      init: wI > 0 ? sumI / wI : null,
      stock: stock,
      em: em,
    };
  }

  function render(container, raw) {
    // Un axe vertical par type de titre : les deux types n'ont pas du tout le même ordre de grandeur.
    var types = NEUCP.uniq(raw, "type_tcn").slice(0, 2);
    var cats = NEUCP.uniq(raw, "categorie_emetteur");
    var zones = NEUCP.uniq(raw, "zone_geographique");
    var devises = NEUCP.uniq(raw, "devise");
    var allMonths = [...new Set(raw.map(function (r) { return r.date_reporting.slice(0, 7); }))].sort();

    container.innerHTML =
      "<h2>Profil de maturité par type de titre</h2>" +
      '<p class="indicator-sub">Durée résiduelle moyenne de l\'encours et durée initiale moyenne des émissions, en jours, ' +
      "séparées par type de titre : chaque type se lit sur son propre axe, de la même couleur que ses courbes.</p>" +
      '<div class="filters">' +
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
      "durée résiduelle = Σ(durée résiduelle × encours) ÷ Σ encours ; " +
      "durée initiale = Σ(durée initiale × émissions) ÷ Σ émissions, sur les lignes où la durée est renseignée. " +
      "Le fichier ne donne que des moyennes par ligne : il ne permet pas d'afficher la répartition de l'encours par tranche d'échéance.</p>";

    var fCat = container.querySelector('[data-role="cats"]');
    var fZone = container.querySelector('[data-role="zones"]');
    var fDevise = container.querySelector("#" + CONTAINER_ID + "-devise");

    addCheckboxes(fCat, cats, "cat");
    addCheckboxes(fZone, zones, "zone");

    fDevise.innerHTML =
      '<option value="__all__">Toutes devises</option>' +
      devises.map(function (d) { return '<option value="' + d + '">' + d + "</option>"; }).join("");
    if (devises.includes("EUR")) fDevise.value = "EUR";

    var chart = null;

    function draw() {
      var selCats = checkedValues(fCat);
      var selZones = checkedValues(fZone);
      var selDevise = fDevise.value;

      var filtered = raw.filter(function (r) {
        return (
          selCats.includes(r.categorie_emetteur) &&
          selZones.includes(r.zone_geographique) &&
          (selDevise === "__all__" || r.devise === selDevise)
        );
      });
      var byMonth = NEUCP.groupBy(filtered, function (r) { return r.date_reporting.slice(0, 7); });

      // Une entrée par mois, puis par type ; null quand aucune ligne ne correspond au périmètre.
      var series = allMonths.map(function (m) {
        var rs = byMonth.get(m);
        if (!rs) return null;
        return types.map(function (t) { return stats(rs, t); });
      });
      function pick(typeIndex, key) {
        return series.map(function (s) { return s ? s[typeIndex][key] : null; });
      }

      var palette = [NEUCP.cssVar("--accent", "#C9A227"), NEUCP.cssVar("--accent2", "#2FA8A0")];
      var muted = NEUCP.cssVar("--muted", "#9AA1AC");
      var border = NEUCP.cssVar("--border", "rgba(255,255,255,.08)");
      var panel = NEUCP.cssVar("--panel", "#121B2E");
      var text = NEUCP.cssVar("--text", "#EDEFF3");

      var datasets = [];
      types.forEach(function (t, ti) {
        var axis = ti === 0 ? "y" : "y2";
        var common = {
          borderColor: palette[ti],
          backgroundColor: palette[ti],
          borderWidth: 2,
          tension: 0.2,
          spanGaps: false,
          pointRadius: 2,
          pointHoverRadius: 5,
          yAxisID: axis,
        };
        datasets.push(Object.assign({ label: t + " — durée résiduelle", data: pick(ti, "resid") }, common));
        datasets.push(Object.assign({ label: t + " — durée initiale", data: pick(ti, "init"), borderDash: [6, 4] }, common));
      });

      // Vue par défaut : les 12 derniers mois ; on peut dézoomer jusqu'au début des données.
      var defaultStart = allMonths.length > 12 ? allMonths.length - 12 : 0;

      var scales = {
        x: {
          min: allMonths[defaultStart],
          max: allMonths[allMonths.length - 1],
          ticks: { color: muted, maxRotation: 0, autoSkip: true },
          grid: { display: false },
        },
        y: {
          position: "left",
          beginAtZero: true,
          title: { display: true, text: types[0] + " (jours)", color: palette[0] },
          ticks: { color: palette[0] },
          grid: { color: border },
        },
      };
      if (types.length > 1) {
        scales.y2 = {
          position: "right",
          beginAtZero: true,
          title: { display: true, text: types[1] + " (jours)", color: palette[1] },
          ticks: { color: palette[1] },
          grid: { drawOnChartArea: false },
        };
      }

      var ctx = container.querySelector("canvas");
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: "line",
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
                label: function (item) { return item.dataset.label + " : " + fmt(item.parsed.y) + " j"; },
                // Les montants qui servent de pondération : une moyenne reposant sur de faibles émissions est moins stable.
                afterBody: function (items) {
                  var s = series[items[0].dataIndex];
                  if (!s) return [];
                  var lines = ["", "Base de calcul"];
                  types.forEach(function (t, ti) {
                    lines.push(t + " : encours " + fmt(s[ti].stock) + " M€, émissions " + fmt(s[ti].em) + " M€");
                  });
                  return lines;
                },
              },
            },
            zoom: {
              limits: { x: { min: 0, max: allMonths.length - 1, minRange: 2 } },
              pan: { enabled: true, mode: "x" },
              zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
            },
          },
          scales: scales,
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
