// Indicateur 9 — Taux moyens pondérés à l'émission (NEU CP, euro)
// Données Banque de France (fichier mensuel des taux moyens pondérés à l'émission) : un taux (%) et un volume
// émis (M€) par mois, catégorie d'émetteur, classe de notation à l'émission et maturité initiale.
// Valeur calculée : quand plusieurs combinaisons sont retenues, taux = Σ(taux × volume émis) ÷ Σ(volume émis),
// sur les seules combinaisons publiées (formule affichée sous le graphe).
// Filtrable par catégorie d'émetteur et classe de notation (cases à cocher : aucune case cochée = pas de
// restriction) et par maturité initiale (1, 3, 6 et 12 mois cochées par défaut ; aucune case = toutes).
(function () {
  var CONTAINER_ID = "indicator-09";
  var DEFAULT_MATS = ["1 mois", "3 mois", "6 mois", "12 mois"];

  // Couleurs de repli ; les vraies valeurs viennent de dashboard.css (--taux-<jours>).
  var FALLBACK_COLORS = {
    1: "#6F7F96", 7: "#4C93C3", 14: "#2FA8A0", 30: "#58B77F", 60: "#9DBF55",
    90: "#C9A227", 120: "#D98A3D", 180: "#D1704F", 270: "#C25E86", 365: "#8A7BD1",
  };

  function fmt(v) {
    return Math.round(v).toLocaleString("fr-FR");
  }

  function fmtTaux(v) {
    return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";
  }

  function monthLabel(ym) {
    var p = ym.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }

  function dateLabel(iso) {
    var p = iso.slice(0, 10).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
    });
  }

  function addCheckboxes(fieldset, values, name, isChecked) {
    values.forEach(function (v, i) {
      var id = CONTAINER_ID + "-" + name + "-" + i;
      var label = document.createElement("label");
      label.className = "filter-check";
      label.setAttribute("for", id);
      var input = document.createElement("input");
      input.type = "checkbox";
      input.id = id;
      input.value = v;
      input.checked = isChecked ? isChecked(v) : false;
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

  // Taux agrégé par mois et par maturité sur le périmètre choisi.
  // rows : lignes du JSON ; months : mois "AAAA-MM" de l'axe ; mats : [{ jours, label }] à tracer.
  // Renvoie une Map label de maturité -> tableau aligné sur months de { taux, vol } (null si aucune
  // combinaison publiée pour ce mois et ce périmètre).
  function computeSeries(rows, months, selCats, selClasses, mats) {
    var wanted = new Set(mats.map(function (m) { return m.label; }));
    var acc = new Map();
    rows.forEach(function (r) {
      if (!wanted.has(r.maturite_initiale)) return;
      if (selCats.length && !selCats.includes(r.categorie_emetteur)) return;
      if (selClasses.length && !selClasses.includes(r.classe_notation)) return;
      var k = r.date_fin_periode.slice(0, 7) + "|" + r.maturite_initiale;
      var a = acc.get(k);
      if (!a) { a = { pv: 0, vol: 0 }; acc.set(k, a); }
      a.pv += r.taux_moyen_pondere_pct * r.volume_emis_meur;
      a.vol += r.volume_emis_meur;
    });
    var out = new Map();
    mats.forEach(function (m) {
      out.set(m.label, months.map(function (mo) {
        var a = acc.get(mo + "|" + m.label);
        return a && a.vol > 0 ? { taux: a.pv / a.vol, vol: a.vol } : null;
      }));
    });
    return out;
  }
  // fin computeSeries

  function render(container, raw) {
    var cats = NEUCP.uniq(raw, "categorie_emetteur");
    var classes = NEUCP.uniq(raw, "classe_notation");

    // Maturités triées par durée croissante.
    var seen = new Map();
    raw.forEach(function (r) { if (!seen.has(r.maturite_initiale)) seen.set(r.maturite_initiale, r.maturite_jours); });
    var mats = [...seen.entries()]
      .map(function (e) { return { label: e[0], jours: e[1] }; })
      .sort(function (a, b) { return a.jours - b.jours; });

    // Axe horizontal : tous les mois présents dans les données (les mois sans publication restent des vides).
    var allMonths = [...new Set(raw.map(function (r) { return r.date_fin_periode.slice(0, 7); }))].sort();
    var lastDate = raw.reduce(function (m, r) { return r.date_fin_periode > m ? r.date_fin_periode : m; }, "");

    container.innerHTML =
      "<h2>Taux moyens pondérés à l'émission</h2>" +
      '<p class="indicator-sub">Taux moyen pondéré des NEU CP émis en euro, par mois et par maturité initiale. ' +
      "Plusieurs catégories ou classes peuvent être combinées : aucune case cochée = pas de restriction.</p>" +
      '<div class="filters">' +
      '  <fieldset class="filter-group" data-role="cats"><legend>Catégorie d\'émetteur</legend></fieldset>' +
      '  <fieldset class="filter-group" data-role="classes"><legend>Classe de notation à l\'émission</legend></fieldset>' +
      '  <fieldset class="filter-group" data-role="mats"><legend>Maturité initiale</legend></fieldset>' +
      "</div>" +
      '<div class="chart-wrap chart-wrap-tall"><canvas></canvas></div>' +
      '<div style="text-align:right;margin-top:8px">' +
      '  <button type="button" data-role="reset-zoom" class="filter-select" style="cursor:pointer">Réinitialiser le zoom</button>' +
      "</div>" +
      '<p class="indicator-sub" style="margin-top:14px"><strong>Valeurs calculées</strong> — ' +
      "avec plusieurs combinaisons, taux affiché = Σ(taux × volume émis) ÷ Σ(volume émis), sur les combinaisons publiées uniquement ; " +
      "avec une seule combinaison, c'est la valeur Banque de France. " +
      "Un agrégat dépend aussi de la répartition des volumes entre catégories et classes : pour comparer des mois à périmètre constant, " +
      "restreindre à une catégorie et une classe.</p>" +
      '<p class="indicator-sub">Source : Banque de France, taux moyens pondérés à l\'émission (données arrêtées au ' + dateLabel(lastDate) + "). " +
      "Une combinaison n'est publiée que si au moins trois émetteurs y figurent. Ces taux ne constituent pas des taux de référence.</p>";

    var fCat = container.querySelector('[data-role="cats"]');
    var fClass = container.querySelector('[data-role="classes"]');
    var fMat = container.querySelector('[data-role="mats"]');

    addCheckboxes(fCat, cats, "cat");
    addCheckboxes(fClass, classes, "classe");
    addCheckboxes(fMat, mats.map(function (m) { return m.label; }), "mat",
      function (v) { return DEFAULT_MATS.includes(v); });

    var chart = null;

    function draw() {
      var selCats = checkedValues(fCat);
      var selClasses = checkedValues(fClass);
      var selMats = checkedValues(fMat);
      var drawn = selMats.length ? mats.filter(function (m) { return selMats.includes(m.label); }) : mats;
      var series = computeSeries(raw, allMonths, selCats, selClasses, drawn);

      var muted = NEUCP.cssVar("--muted", "#9AA1AC");
      var border = NEUCP.cssVar("--border", "rgba(255,255,255,.08)");
      var panel = NEUCP.cssVar("--panel", "#121B2E");
      var text = NEUCP.cssVar("--text", "#EDEFF3");

      var datasets = drawn.map(function (m) {
        var pts = series.get(m.label);
        var color = NEUCP.cssVar("--taux-" + m.jours, FALLBACK_COLORS[m.jours] || "#9AA1AC");
        return {
          label: m.label,
          data: pts.map(function (p) { return p ? p.taux : null; }),
          vols: pts.map(function (p) { return p ? p.vol : null; }),
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          tension: 0.15,
          spanGaps: false,
          pointRadius: 2,
          pointHoverRadius: 5,
        };
      });

      // Vue par défaut : les 12 derniers mois ; on peut dézoomer jusqu'au début des données.
      var defaultStart = allMonths.length > 12 ? allMonths.length - 12 : 0;

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
                label: function (item) {
                  var vol = item.dataset.vols[item.dataIndex];
                  return item.dataset.label + " : " + fmtTaux(item.parsed.y) + "  (" + fmt(vol) + " M€ émis)";
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
              grid: { display: false },
            },
            y: {
              grace: "8%",
              title: { display: true, text: "Taux moyen pondéré à l'émission (%)", color: muted },
              ticks: {
                color: muted,
                callback: function (v) { return v.toLocaleString("fr-FR", { minimumFractionDigits: 1 }) + " %"; },
              },
              grid: {
                color: function (c) { return c.tick && c.tick.value === 0 ? muted : border; },
              },
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
    NEUCP.loadTaux()
      .then(function (raw) { render(container, raw); })
      .catch(function (err) {
        container.innerHTML =
          '<p style="color:var(--muted)">Impossible de charger les données (' + err.message + ").</p>";
      });
  });
})();
