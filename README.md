# Livre d'affaire

Application locale de suivi de revenus, dépenses et kilométrage pour travailleur
autonome au Québec, avec un module de suivi TPS/TVQ sur les factures.

Aucun compte, aucun cloud. Toutes les données vivent dans IndexedDB, dans ce
navigateur, sur cet appareil.

> ⚠️ Les taux TPS/TVQ affichés dans l'onglet Factures sont des outils de
> planification, pas des calculs officiels de l'ARC ou de Revenu Québec. Tant
> que `src/config/parametres-fiscaux.json` n'est pas rempli avec des taux
> vérifiés pour une valeur donnée, l'appli affiche « non configuré » plutôt
> qu'un chiffre inventé.

## Installation

```sh
npm install
```

## Lancer l'appli

```sh
npm run dev
```

Ouvre `http://localhost:5173`. Pour y accéder depuis ton téléphone sur le
même réseau : `npm run dev -- --host`.

## Paramètres fiscaux

`src/config/parametres-fiscaux.json` contient les taux et seuils utilisés par
l'appli (TPS 5 %, TVQ 9,975 %, seuil de petit fournisseur, taux de repère au
kilomètre). Les valeurs déjà stables sont préremplies ; tant qu'une valeur
manque, l'interface l'indique clairement plutôt que d'afficher un montant
faux.

## Sauvegarde — ton seul filet de sécurité

Toutes les données sont locales : pas de synchronisation, pas de cloud. Si le
navigateur perd ses données (réinstallation, changement d'appareil, purge du
stockage), **rien n'est récupérable sans une sauvegarde**.

- **Sur Chrome, Edge ou Opera (ordinateur)** : le bouton « 💾 Enregistrer », en
  haut de l'appli, écrit directement dans un fichier de sauvegarde choisi une
  seule fois (API File System Access). Chaque clic réécrit ce même fichier, et
  l'appli le relit automatiquement à l'ouverture.
- **Sur les autres navigateurs** (Firefox, Safari, mobile) : le bouton
  « Enregistrer » sauvegarde uniquement dans IndexedDB (ce navigateur, cet
  appareil) — pense à faire des copies via l'export de données (voir
  ci-dessous) avant de changer d'appareil ou de navigateur.
- **Restaurer une sauvegarde** — dans l'onglet Historique, « ⬆️ Restaurer une
  sauvegarde » relit un fichier de sauvegarde JSON et réécrit chaque clé dans
  IndexedDB. Une confirmation explicite est demandée avant restauration
  puisque l'opération remplace les données actuelles portant les mêmes clés.

Cette fonction est couverte par des tests automatisés dédiés
(`src/lib/backup.test.ts`, `src/lib/autoBackup.test.ts`), y compris un
aller-retour complet avec des images (données binaires), parce qu'une
sauvegarde qui ment est pire que pas de sauvegarde.

## Export pour le comptable

Dans l'onglet Historique, « 📦 Exporter les données » génère, pour le
contexte actif et la période choisie (Du/Au), un fichier .zip contenant un
classeur Excel (dépenses, factures, kilométrage, documents) et un dossier
avec les fichiers réels (photos de reçus, factures, documents).

## Tests

```sh
npm run test        # une fois
npm run test:watch  # en continu
```

La logique de sauvegarde complète et l'export comptable sont couverts par des
tests unitaires — ce sont les endroits où une erreur coûte cher.

## Build de production

```sh
npm run build     # compile dans dist/
npm run preview   # sert le build localement pour vérifier
```

C'est un site statique pur — aucun serveur à faire tourner en production.

## Version de bureau (.exe Windows)

L'appli peut être empaquetée en application Windows native (Tauri) — un
`.exe` installable, sans navigateur à ouvrir. Ça doit se compiler **sur une
machine Windows** (la compilation croisée depuis Linux/Mac n'est pas
supportée ici).

Prérequis sur la machine Windows qui compile :

1. [Rust](https://rustup.rs/) (via `rustup`)
2. [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   avec la charge de travail « Développement Desktop en C++ »
3. [Node.js](https://nodejs.org/) (déjà nécessaire pour le reste du projet)

WebView2 (le moteur d'affichage) est déjà installé par défaut sur Windows 10
et 11 — rien à installer côté utilisateur final.

```sh
npm install
npm run tauri:build
```

Le `.exe` d'installation se retrouve dans
`src-tauri/target/release/bundle/nsis/*.exe` — c'est ce fichier à envoyer à
l'usager ; il l'installe en double-cliquant, sans rien configurer.

Pour tester en local avant de compiler l'installateur final :

```sh
npm run tauri:dev
```

## Structure du projet

```
src/
  config/             paramètres fiscaux, catégories de dépenses
  lib/                logique métier pure (calculs, CSV, sauvegarde)
  hooks/              accès aux données (IndexedDB, config globale)
  components/         éléments d'interface partagés
  panels/             les onglets (Tableau de bord, Dépenses, Factures, Km, Documents, Historique)
src-tauri/            empaquetage en application de bureau Windows (voir plus haut)
```
