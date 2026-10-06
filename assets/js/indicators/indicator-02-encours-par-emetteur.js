// Indicateur 1 – Encours total du marché
// Somme de encours_eur_m, tous émetteurs, par mois.
// Filtrable par type_tcn (cases à cocher), categorie_emetteur (cases à cocher),
// zone_geographique (cases à cocher) et devise (liste déroulante).
(function () {
  var CONTAINER_ID = "indicator-01";

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

  function formatMonthLabel(monthStr) {
    var months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    var parts = monthStr.split("-");
    var year = parts[0];
    var month = parseInt(parts[1], 10) - 1;
    return months[month] + " " + year;
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
      '  <div class="filter-group">' +
      '    <label class="filter-label" for="f-period">Période</label>' +
      '    <select id="f-period" class="filter-select">' +
      '      <option value="12m">12 derniers mois</option>' +
      '      <option value="6m">6 derniers mois</option>' +
      '      <option value="3m">3 derniers mois</option>' +
      '      <option value="all">Tout l\'historique</option>' +
      '    </select>' +
      "  </div>" +
      "</div>" +
      '<div class="chart-wrap"><canvas id="chart-encours-total"></canvas></div>';

    var fType = container.querySelector("#f-type");
    var fCat = container.querySelector("#f-cat");
    var fZone = container.querySelector("#f-zone");
    var fDevise = container.querySelector("#f-devise");
    var fPeriod = container.querySelector("#f-period");

    addCheckboxes(fType, types, "type");
    addCheckboxes(fCat, cats, "cat");
    addCheckboxes(fZone, zones, "zone");

    fDevise.innerHTML =
      '<option value="__all__">Toutes devises</option>' +
      devises.map(function (d) { return '<option value="' + d + '">' + d + "</option>"; }).join("");

    // Sélectionner EUR par défaut
    var eurOption = fDevise.querySelector('option[value="EUR"]');
    if (eurOption) {
      fDevise.value = "EUR";
    }

    var chart = null;
    var allData = null;

    function getDateRange(filteredData, period) {
      if (filteredData.length === 0) return { min: null, max: null };

      var dates = filteredData.map(function (r) { return r.date_reporting; });
      var sortedDates = dates.sort();
      var maxDate = sortedDates[sortedDates.length - 1];

      if (period === "all") {
        return { min: sortedDates[0], max: maxDate };
      }

      var max = new Date(maxDate);
      var min = new Date(max.getTime());
      var monthsToSubtract = period === "12m" ? 12 : (period === "6m" ? 6 : 3);
      min.setMonth(min.getMonth() - monthsToSubtract);

      return {
        min: min.toISOString().split("T")[0],
        max: maxDate
      };
    }

    function draw() {
      var selTypes = checkedValues(fType);
      var selCats = checkedValues(fCat);
      var selZones = checkedValues(fZone);
      var selDevise = fDevise.value;
      var selPeriod = fPeriod.value;

      var filtered = raw.filter(function (r) {
        return (
          selTypes.includes(r.type_tcn) &&
          selCats.includes(r.categorie_emetteur) &&
          selZones.includes(r.zone_geographique) &&
          (selDevise === "__all__" || r.devise === selDevise)
        );
      });

      var dateRange = getDateRange(filtered, selPeriod);

      var filteredByDate = filtered.filter(function (r) {
        if (!dateRange.min) return true;
        return r.date_reporting >= dateRange.min && r.date_reporting <= dateRange.max;
      });

      var byMonth = NEUCP.groupBy(filteredByDate, function (r) { return r.date_reporting.slice(0, 7); });
      var months = [...byMonth.keys()].sort();
      var totals = months.map(function (m) { return NEUCP.sum(byMonth.get(m), function (r) { return r.encours_eur_m; }); });

      allData = {
        months: months,
        totals: totals,
        filtered: filteredByDate
      };

      var accent = NEUCP.cssVar("--accent", "#C9A227");
      var muted = NEUCP.cssVar("--muted", "#9AA1AC");
      var border = NEUCP.cssVar("--border", "rgba(255,255,255,.08)");

      var ctx = document.getElementById("chart-encours-total");
      if (chart) chart.destroy();

      chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: months.map(formatMonthLabel),
          datasets: [{
            label: "Encours total (M€)",
            data: totals,
            borderColor: accent,
            backgroundColor: "transparent",
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: accent,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              mode: "index",
              intersect: false,
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              titleColor: "#fff",
              bodyColor: "#fff",
              padding: 12,
              cornerRadius: 6,
              displayColors: false,
              callbacks: {
                label: function (context) {
                  return "Encours: " + context.parsed.y.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " M€";
                },
                title: function (context) {
                  return formatMonthLabel(months[context[0].dataIndex]);
                }
              }
            }
          },
          scales: {
            x: {
              ticks: { color: muted, maxRotation: 0, autoSkip: true },
              grid: { color: border }
            },
            y: {
              ticks: {
                color: muted,
                callback: function (value) {
                  return value.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " M€";
                }
              },
              grid: { color: border },
              title: {
                display: true,
                text: "Montant (M€)",
                color: muted
              }
            },
          },
        },
      });
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