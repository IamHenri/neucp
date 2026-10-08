// Indicateur 3 — Encours par émetteur
// Encours (M€, équivalent euro) de l'émetteur sélectionné dans la liste, par mois.
// Filtrable par type_tcn (cases à cocher) et devise (liste déroulante, EUR par défaut).
// La catégorie et la zone géographique de l'émetteur sont affichées en libellé.
(function () {
  var CONTAINER_ID = "indicator-04";

  function setText(el, value) {
    el.textContent = value != null ? value : "—";
  }

  function fillTypes(fieldset, values) {
    fieldset.querySelectorAll("label.filter-check").forEach(function (el) { el.remove(); });
    values.forEach(function (v, i) {
      var id = CONTAINER_ID + "-type-" + i;
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

  function fillDevises(select, devises) {
    select.innerHTML = "";
    var all = document.createElement("option");
    all.value = "__all__";
    all.textContent = "Toutes devises";
    select.appendChild(all);
    devises.forEach(function (d) {
      var o = document.createElement("option");
      o.value = d;
      o.textContent = d;
      select.appendChild(o);
    });
    select.value = devises.includes("EUR") ? "EUR" : "__all__";
  }

  function checkedValues(fieldset) {
    return [...fieldset.querySelectorAll("input[type=checkbox]:checked")].map(
      function (el) { return el.value; }
    );
  }

  function render(container, raw) {
    // Tous les mois présents dans les données : sert d'axe horizontal, pour que
    // les mois sans ligne pour cet émetteur apparaissent comme des vides et non
    // comme des mois sautés.
    var allMonths = [...new Set(raw.map(function (r) { return r.date_reporting.slice(0, 7); }))].sort();
    var lastMonth = allMonths[allMonths.length - 1];

    // Un élément par émetteur, identifié par son code (plus stable que le nom).
    var rows = raw.filter(function (r) { return r.code_emetteur != null; });
    var issuers = new Map();
    NEUCP.groupBy(rows, function (r) { return r.code_emetteur; }).forEach(function (issuerRows, code) {
      var latest = issuerRows.reduce(function (a, r) { return r.date_reporting > a.date_reporting ? r : a; }, issuerRows[0]);
      issuers.set(code, { code: code, name: latest.denomination_emetteur || code, latest: latest, rows: issuerRows });
    });
    var list = [...issuers.values()].sort(function (a, b) { return a.name.localeCompare(b.name, "fr"); });

    // Émetteur affiché à l'ouverture : celui dont l'encours est le plus élevé au dernier mois.
    var initial = list[0];
    var initialValue = -1;
    list.forEach(function (it) {
      var v = NEUCP.sum(
        it.rows.filter(function (r) { return r.date_reporting.slice(0, 7) === lastMonth; }),
        function (r) { return r.encours_eur_m; }
      );
      if (v > initialValue) { initialValue = v; initial = it; }
    });

    container.innerHTML =
      "<h2>Encours par émetteur</h2>" +
      '<p class="indicator-sub">Encours (M€, équivalent euro) de l\'émetteur sélectionné, par mois. ' +
      "Donnée Banque de France, non retraitée — la sélection ci-dessous change seulement le périmètre additionné.</p>" +
      '<div class="filters">' +
      '  <div class="filter-group">' +
      '    <label class="filter-label" for="' + CONTAINER_ID + '-issuer">Émetteur</label>' +
      '    <select id="' + CONTAINER_ID + '-issuer" class="filter-select filter-select-wide"></select>' +
      "  </div>" +
      '  <div class="filter-group"><span class="filter-label">Catégorie</span><span class="filter-value" data-info="cat">—</span></div>' +
      '  <div class="filter-group"><span class="filter-label">Zone géographique</span><span class="filter-value" data-info="zone">—</span></div>' +
      '  <div class="filter-group"><span class="filter-label">Code émetteur</span><span class="filter-value" data-info="code">—</span></div>' +
      '  <fieldset class="filter-group" data-role="types"><legend>Type de titre</legend></fieldset>' +
      '  <div class="filter-group">' +
      '    <label class="filter-label" for="' + CONTAINER_ID + '-devise">Devise</label>' +
      '    <select id="' + CONTAINER_ID + '-devise" class="filter-select"></select>' +
      "  </div>" +
      "</div>" +
      '<div class="chart-wrap"><canvas></canvas></div>' +
      '<div style="text-align:right;margin-top:8px">' +
      '  <button type="button" data-role="reset-zoom" class="filter-select" style="cursor:pointer">Réinitialiser le zoom</button>' +
      "</div>";

    var elIssuer = container.querySelector("#" + CONTAINER_ID + "-issuer");
    var elDevise = container.querySelector("#" + CONTAINER_ID + "-devise");
    var fType = container.querySelector('[data-role="types"]');
    var infoCat = container.querySelector('[data-info="cat"]');
    var infoZone = container.querySelector('[data-info="zone"]');
    var infoCode = container.querySelector('[data-info="code"]');

    list.forEach(function (it) {
      var o = document.createElement("option");
      o.value = it.code;
      o.textContent = it.name;
      elIssuer.appendChild(o);
    });
    elIssuer.value = initial.code;

    var current = initial;
    var chart = null;

    // Met à jour les libellés et les filtres selon l'émetteur choisi :
    // seuls les types de titre et les devises qu'il a réellement utilisés sont proposés.
    function selectIssuer() {
      current = issuers.get(elIssuer.value);
      setText(infoCat, current.latest.categorie_emetteur);
      setText(infoZone, current.latest.zone_geographique);
      setText(infoCode, current.code);
      fillTypes(fType, NEUCP.uniq(current.rows, "type_tcn"));
      fillDevises(elDevise, NEUCP.uniq(current.rows, "devise"));
    }

    function draw() {
      var selTypes = checkedValues(fType);
      var selDevise = elDevise.value;

      var filtered = current.rows.filter(function (r) {
        return selTypes.includes(r.type_tcn) && (selDevise === "__all__" || r.devise === selDevise);
      });
      var byMonth = NEUCP.groupBy(filtered, function (r) { return r.date_reporting.slice(0, 7); });
      // null = aucune ligne ce mois-là pour cet émetteur : la courbe s'interrompt.
      var totals = allMonths.map(function (m) {
        var monthRows = byMonth.get(m);
        return monthRows ? NEUCP.sum(monthRows, function (r) { return r.encours_eur_m; }) : null;
      });

      var accent = NEUCP.cssVar("--accent", "#C9A227");
      var muted = NEUCP.cssVar("--muted", "#9AA1AC");
      var border = NEUCP.cssVar("--border", "rgba(255,255,255,.08)");
      var panel = NEUCP.cssVar("--panel", "#121B2E");
      var text = NEUCP.cssVar("--text", "#EDEFF3");

      // Vue par défaut : les 12 derniers mois ; on peut dézoomer jusqu'au début des données.
      var defaultStart = allMonths.length > 12 ? allMonths.length - 12 : 0;

      var ctx = container.querySelector("canvas");
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: allMonths,
          datasets: [{
            label: "Encours",
            data: totals,
            borderColor: accent,
            backgroundColor: "transparent",
            borderWidth: 2,
            tension: 0.2,
            spanGaps: false,
            pointRadius: 2,
            pointBackgroundColor: accent,
            pointHoverRadius: 5,
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
                  return "Encours : " + Math.round(item.parsed.y).toLocaleString("fr-FR") + " M€";
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
              min: allMonths[defaultStart],
              max: allMonths[allMonths.length - 1],
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

      var resetBtn = container.querySelector('[data-role="reset-zoom"]');
      if (resetBtn) resetBtn.onclick = function () { if (chart) chart.resetZoom(); };
    }

    container.addEventListener("change", function (e) {
      if (e.target === elIssuer) selectIssuer();
      draw();
    });

    selectIssuer();
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
