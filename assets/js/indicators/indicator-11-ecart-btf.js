// Indicateur 11 — Écart aux BTF des taux d'émission NEU CP (3, 6 et 12 mois)
// Taux moyen pondéré à l'émission (Banque de France) moins le taux moyen des adjudications de BTF du mois
// (Agence France Trésor) pour la même maturité, en points de base.
// Valeur calculée : écart = taux NEU CP agrégé − taux BTF du mois, × 100.
// Le taux NEU CP agrégé suit la règle de l'indicateur 9 : Σ(taux × volume émis) ÷ Σ(volume émis) sur les
// combinaisons publiées retenues. Filtrable par catégorie d'émetteur et classe de notation (aucune case
// cochée = pas de restriction) et par maturité (3, 6 et 12 mois cochées par défaut).
(function () {
  var CONTAINER_ID = "indicator-11";
  var MATS = [
    { label: "3 mois", jours: 90 },
    { label: "6 mois", jours: 180 },
    { label: "12 mois", jours: 365 },
  ];
  var FALLBACK_COLORS = { 90: "#C9A227", 180: "#D1704F", 365: "#8A7BD1" };

  function fmt(v) {
    return Math.round(v).toLocaleString("fr-FR");
  }

  function fmtPb(v) {
    var s = v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return (v > 0 ? "+" : "") + s + " pb";
  }

  function fmtTaux(v) {
    return v.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " %";
  }

  function monthLabel(ym) {
    var p = ym.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
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

  // btf : Map "AAAA-MM|maturité" -> taux BTF moyen du mois (%). Pour chaque maturité, renvoie un tableau
  // aligné sur months de { pb, taux, btf, vol } (null si aucune combinaison NEU CP publiée ce mois-là pour
  // ce périmètre, ou pas de BTF de référence).
  function computeSpread(rows, btf, months, selCats, selClasses, mats) {
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
        var ref = btf.get(mo + "|" + m.label);
        if (!a || !(a.vol > 0) || ref == null) return null;
        var taux = a.pv / a.vol;
        return { pb: (taux - ref) * 100, taux: taux, btf: ref, vol: a.vol };
      }));
    });
    return out;
  }
  // fin computeSpread

  function render(container, raw, refRows) {
    var cats = NEUCP.uniq(raw, "categorie_emetteur");
    var classes = NEUCP.uniq(raw, "classe_notation");

    // Taux BTF moyen par mois et par maturité ; l'axe horizontal suit les mois où le BTF existe.
    var btf = new Map();
    var monthSet = new Set();
    refRows.forEach(function (r) {
      var mo = r.date_fin_periode.slice(0, 7);
      btf.set(mo + "|" + r.maturite_initiale, r.taux_moyen_pct);
      monthSet.add(mo);
    });
    var allMonths = [...monthSet].sort();
    var lastDate = raw.reduce(function (m, r) { return r.date_fin_periode > m ? r.date_fin_periode : m; }, "");

    container.innerHTML =
      "<h2>Écart aux BTF des NEU CP</h2>" +
      '<p class="indicator-sub">Écart, en points de base, entre le taux moyen pondéré à l\'émission des NEU CP et le taux moyen des BTF ' +
      "adjugés dans le mois, à maturité comparable (3, 6 et 12 mois). Aucune case cochée = pas de restriction.</p>" +
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
      "écart = taux NEU CP − taux BTF du mois, × 100 ; le taux NEU CP est la moyenne des taux publiés pondérée par les volumes émis ; " +
      "le taux BTF est la moyenne des taux moyens pondérés des adjudications du mois, pondérée par les volumes émis. " +
      "Lignes de BTF retenues : 11 à 15 semaines pour 3 mois, 20 à 28 semaines pour 6 mois, 44 à 52 semaines pour 12 mois. " +
      "Cet écart reflète à la fois les conditions propres aux émetteurs, la liquidité, le calendrier (adjudications du lundi, émissions réparties sur le mois) " +
      "et de petites différences de maturité résiduelle ; il ne constitue pas une mesure du risque de crédit.</p>" +
      '<p class="indicator-sub">Sources : Banque de France, taux moyens pondérés à l\'émission (NEU CP en euros, données arrêtées au ' +
      lastDate.slice(0, 10).split("-").reverse().join("/") + ") ; Agence France Trésor, résultats des adjudications de BTF. " +
      "Ces écarts sont calculés par tcndata.fr et ne constituent pas des taux de référence.</p>";

    var fCat = container.querySelector('[data-role="cats"]');
    var fClass = container.querySelector('[data-role="classes"]');
    var fMat = container.querySelector('[data-role="mats"]');

    addCheckboxes(fCat, cats, "cat");
    addCheckboxes(fClass, classes, "classe");
    addCheckboxes(fMat, MATS.map(function (m) { return m.label; }), "mat", function () { return true; });

    var chart = null;

    function draw() {
      var selCats = checkedValues(fCat);
      var selClasses = checkedValues(fClass);
      var selMats = checkedValues(fMat);
      var drawn = selMats.length ? MATS.filter(function (m) { return selMats.includes(m.label); }) : MATS;
      var series = computeSpread(raw, btf, allMonths, selCats, selClasses, drawn);

      var muted = NEUCP.cssVar("--muted", "#9AA1AC");
      var border = NEUCP.cssVar("--border", "rgba(255,255,255,.08)");
      var panel = NEUCP.cssVar("--panel", "#121B2E");
      var text = NEUCP.cssVar("--text", "#EDEFF3");

      var datasets = drawn.map(function (m) {
        var pts = series.get(m.label);
        var color = NEUCP.cssVar("--taux-" + m.jours, FALLBACK_COLORS[m.jours] || "#9AA1AC");
        return {
          label: m.label,
          data: pts.map(function (p) { return p ? p.pb : null; }),
          pts: pts,
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
                  var p = item.dataset.pts[item.dataIndex];
                  return item.dataset.label + " : " + fmtPb(item.parsed.y) +
                    "  (NEU CP " + fmtTaux(p.taux) + " · BTF " + fmtTaux(p.btf) + " · " + fmt(p.vol) + " M€ émis)";
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
              grace: "10%",
              title: { display: true, text: "Écart aux BTF (points de base)", color: muted },
              ticks: {
                color: muted,
                callback: function (v) { return (v > 0 ? "+" : "") + v.toLocaleString("fr-FR") + " pb"; },
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
    Promise.all([NEUCP.loadTaux(), NEUCP.loadRefBtf()])
      .then(function (res) { render(container, res[0], res[1]); })
      .catch(function (err) {
        container.innerHTML =
          '<p style="color:var(--muted)">Impossible de charger les données (' + err.message + ").</p>";
      });
  });
})();
