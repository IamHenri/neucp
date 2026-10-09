// Indicateur 4 — Plus gros encours par émetteur
// Histogramme des TOP_N émetteurs ayant le plus fort encours au mois choisi
// (dernier mois par défaut), avec une barre par type de titre (type_tcn).
// Axe horizontal triable (par montant ou ordre alphabétique) ; filtres par zone
// géographique et catégorie d'émetteur : aucune case cochée = pas de restriction.
(function () {
  var CONTAINER_ID = "indicator-05";
  var TOP_N = 12; // nombre d'émetteurs affichés

  function fmt(v) {
    return Math.round(v).toLocaleString("fr-FR");
  }

  function monthLabel(ym) {
    var p = ym.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }

  // Coupe un nom d'émetteur sur plusieurs lignes (3 maximum) pour l'axe horizontal.
  function wrapLabel(name, max) {
    var lines = [];
    var line = "";
    name.split(" ").forEach(function (word) {
      if (line && (line + " " + word).length > max) {
        lines.push(line);
        line = word;
      } else {
        line = line ? line + " " + word : word;
      }
    });
    if (line) lines.push(line);
    if (lines.length > 3) {
      lines = lines.slice(0, 3);
      lines[2] = lines[2].slice(0, max - 1) + "…";
    }
    return lines;
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
    var zones = NEUCP.uniq(raw, "zone_geographique");
    var cats = NEUCP.uniq(raw, "categorie_emetteur");
    var byMonth = NEUCP.groupBy(raw, function (r) { return r.date_reporting.slice(0, 7); });
    var months = [...byMonth.keys()].sort().reverse(); // plus récent en premier

    container.innerHTML =
      "<h2>Les " + TOP_N + " plus gros encours</h2>" +
      '<p class="indicator-sub">Encours (M€, équivalent euro, toutes devises) au mois sélectionné, une barre par type de titre. ' +
      "Montants Banque de France additionnés par émetteur et type de titre ; le classement est établi sur la somme des types. " +
      "Aucune case cochée dans un filtre = pas de restriction sur ce critère.</p>" +
      '<div class="filters">' +
      '  <div class="filter-group">' +
      '    <label class="filter-label" for="' + CONTAINER_ID + '-month">Mois</label>' +
      '    <select id="' + CONTAINER_ID + '-month" class="filter-select"></select>' +
      "  </div>" +
      '  <fieldset class="filter-group" data-role="sort"><legend>Tri de l\'axe horizontal</legend>' +
      '    <label class="filter-check" for="' + CONTAINER_ID + '-sort-amount"><input type="radio" name="' + CONTAINER_ID + '-sort" id="' + CONTAINER_ID + '-sort-amount" value="amount" checked><span>Par montant</span></label>' +
      '    <label class="filter-check" for="' + CONTAINER_ID + '-sort-alpha"><input type="radio" name="' + CONTAINER_ID + '-sort" id="' + CONTAINER_ID + '-sort-alpha" value="alpha"><span>Ordre alphabétique</span></label>' +
      "  </fieldset>" +
      '  <fieldset class="filter-group" data-role="zones"><legend>Zone géographique</legend></fieldset>' +
      '  <fieldset class="filter-group" data-role="cats"><legend>Catégorie d\'émetteur</legend></fieldset>' +
      "</div>" +
      '<p class="indicator-sub" data-role="empty" style="display:none">Aucun émetteur pour cette sélection.</p>' +
      '<div class="chart-wrap chart-wrap-tall"><canvas></canvas></div>';

    var elMonth = container.querySelector("#" + CONTAINER_ID + "-month");
    var fSort = container.querySelector('[data-role="sort"]');
    var fZone = container.querySelector('[data-role="zones"]');
    var fCat = container.querySelector('[data-role="cats"]');
    var elEmpty = container.querySelector('[data-role="empty"]');

    months.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m;
      o.textContent = monthLabel(m);
      elMonth.appendChild(o);
    });
    elMonth.value = months[0]; // dernière date par défaut

    addCheckboxes(fZone, zones, "zone");
    addCheckboxes(fCat, cats, "cat");

    // Affiche les montants au sommet de chaque barre.
    var valueLabels = {
      id: "valueLabels",
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        var family = (window.Chart && Chart.defaults && Chart.defaults.font && Chart.defaults.font.family) || "sans-serif";
        ctx.save();
        ctx.font = "10px " + family;
        ctx.fillStyle = NEUCP.cssVar("--text", "#EDEFF3");
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        chart.data.datasets.forEach(function (ds, i) {
          var meta = chart.getDatasetMeta(i);
          if (meta.hidden) return;
          meta.data.forEach(function (bar, j) {
            var v = ds.data[j];
            if (v == null || !bar) return;
            ctx.fillText(fmt(v), bar.x, bar.y - 4);
          });
        });
        ctx.restore();
      },
    };

    var chart = null;

    function draw() {
      var month = elMonth.value;
      var selZones = checkedValues(fZone);
      var selCats = checkedValues(fCat);
      var sortMode = fSort.querySelector("input:checked").value;

      var rows = (byMonth.get(month) || []).filter(function (r) {
        return (
          r.code_emetteur != null &&
          (selZones.length === 0 || selZones.includes(r.zone_geographique)) &&
          (selCats.length === 0 || selCats.includes(r.categorie_emetteur))
        );
      });

      var items = [];
      NEUCP.groupBy(rows, function (r) { return r.code_emetteur; }).forEach(function (issuerRows, code) {
        var byType = {};
        var total = 0;
        types.forEach(function (t) {
          var s = NEUCP.sum(
            issuerRows.filter(function (r) { return r.type_tcn === t; }),
            function (r) { return r.encours_eur_m; }
          );
          byType[t] = s > 0 ? s : null; // pas de barre quand il n'y a pas d'encours
          total += s;
        });
        items.push({
          name: issuerRows[0].denomination_emetteur || code,
          cat: issuerRows[0].categorie_emetteur,
          zone: issuerRows[0].zone_geographique,
          byType: byType,
          total: total,
        });
      });

      // Les TOP_N plus gros (par somme des types), puis tri d'affichage choisi.
      items.sort(function (a, b) { return b.total - a.total; });
      items = items.slice(0, TOP_N);
      if (sortMode === "alpha") {
        items.sort(function (a, b) { return a.name.localeCompare(b.name, "fr"); });
      }

      elEmpty.style.display = items.length ? "none" : "block";

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

      var ctx = container.querySelector("canvas");
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: "bar",
        plugins: [valueLabels],
        data: {
          labels: items.map(function (it) { return wrapLabel(it.name, 16); }),
          datasets: types.map(function (t, i) {
            return {
              label: t,
              data: items.map(function (it) { return it.byType[t]; }),
              backgroundColor: palette[i % palette.length],
              borderRadius: 3,
              barPercentage: 0.95,
              categoryPercentage: 0.85,
            };
          }),
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
                title: function (tipItems) { return items[tipItems[0].dataIndex].name; },
                label: function (item) { return item.dataset.label + " : " + fmt(item.parsed.y) + " M€"; },
                afterBody: function (tipItems) {
                  var it = items[tipItems[0].dataIndex];
                  return ["", "Catégorie : " + it.cat, "Zone : " + it.zone];
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { color: muted, autoSkip: false, maxRotation: 50, minRotation: 0, font: { size: 11 } },
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              grace: "10%", // laisse la place aux montants au-dessus de la plus haute barre
              title: { display: true, text: "Encours (M€)", color: muted },
              ticks: { color: muted },
              grid: { color: border },
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
