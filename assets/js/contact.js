// Affiche les adresses e-mail sans les écrire d'un bloc dans le HTML.
// Un élément portant data-mail-user et data-mail-domain :
//  - un lien <a> reçoit un href « mailto: » (son texte reste inchangé) ;
//  - tout autre élément est remplacé par un lien « mailto: » qui affiche l'adresse.
// Sans JavaScript, le texte de l'élément reste visible (par exemple « contact [arobase] domaine [point] fr »).
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-mail-user][data-mail-domain]").forEach(function (el) {
      var address = el.getAttribute("data-mail-user") + "@" + el.getAttribute("data-mail-domain");
      if (el.tagName === "A") {
        el.setAttribute("href", "mailto:" + address);
        return;
      }
      var link = document.createElement("a");
      link.href = "mailto:" + address;
      link.textContent = address;
      el.replaceWith(link);
    });
  });
})();
