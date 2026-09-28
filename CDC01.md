


# neucp

Site de présentation — tableaux de bord de trésorerie NEU CP / NEU MTN.

## Développement local

```bash
bundle install
bundle exec jekyll serve
```

Le site est servi sur `http://localhost:4000/neucp/`.

## Déploiement

Le site est prévu pour GitHub Pages depuis ce repo (`IamHenri/neucp`).
Dans les réglages du repo → Pages, choisir la branche `main` (dossier racine)
comme source. Vérifier `url` et `baseurl` dans `_config.yml` si le site est
servi depuis un domaine personnalisé.

## Structure

```
_config.yml           configuration du site
_layouts/default.html gabarit commun aux deux pages
assets/css/style.css  feuille de style
assets/images/        graphiques d'exemple (ACOSS)
index.md              page d'accueil
dashboard-exemple.md  page d'exemple de tableau de bord
```

## À faire avant mise en ligne

- Remplacer `contact@example.com` par l'adresse de contact réelle dans
  `_layouts/default.html`, `index.md` et `dashboard-exemple.md`.
- Vérifier `url` dans `_config.yml` si un domaine personnalisé est utilisé.


# neucp
Plateforme de diffusion des stat de la BDF sur les NEU CP

# Historique 
Disponible depuis 04/2023


# Site web 
le site neucp.fr est la landign page du service de consultations des informations liées au NEU CP tels que diffusés par la Banque de France. 

# Abonnements
neucp.fr permet de souscrire à des abonnements au flux de données et tableaux de bords
