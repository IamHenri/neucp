// Chargement des données, partagé par tous les indicateurs.
// Chaque fichier d'indicateur appelle NEUCP.loadData() : le fetch
// ne se fait qu'une seule fois, les appels suivants réutilisent le résultat.
window.NEUCP = window.NEUCP || {};

NEUCP.loadData = function (url) {
  url = url || "./tcn_historique.json";
  if (!NEUCP._dataPromise) {
    NEUCP._dataPromise = fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
  return NEUCP._dataPromise;
};

// Lit une variable de mise en forme définie dans dashboard.css (:root),
// pour que chaque graphique JS reste synchronisé avec le CSS sans
// dupliquer de couleurs en dur dans le code.
NEUCP.cssVar = function (name, fallback) {
  var v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim() : fallback;
};

// Petits utilitaires communs à tous les indicateurs.
NEUCP.groupBy = function (rows, keyFn) {
  var m = new Map();
  rows.forEach(function (r) {
    var k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  });
  return m;
};
NEUCP.sum = function (arr, f) {
  return arr.reduce(function (a, r) { return a + (f(r) || 0); }, 0);
};
NEUCP.uniq = function (rows, field) {
  return [...new Set(rows.map(function (r) { return r[field]; }).filter(function (v) { return v != null; }))].sort();
};
