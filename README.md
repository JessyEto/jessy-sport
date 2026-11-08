# Jessy Sport

Mini app iPhone (web app installable) pour suivre ses séances de sport.

## Fonctions

- **Programmes** : créer des séances types avec leurs exercices et le nombre de séries.
- **3 types d'exercices** : Musculation (reps + kg), Durée (secondes), Cardio (minutes + km).
- **Séance en cours** : chrono, saisie de chaque série, case à cocher quand la série est faite.
  - Les valeurs de la dernière séance sont pré-remplies et affichées sous chaque exercice.
  - Valider une série recopie ses valeurs dans les séries suivantes encore vides.
  - Ajout ou retrait d'exercices et de séries pendant la séance.
- **Historique** : durée, nombre de séries et tonnage de chaque séance.
- **Sauvegarde** : export / import d'un fichier JSON.
- Fonctionne hors ligne une fois installée. Données stockées sur le téléphone uniquement.

## Installer sur iPhone

1. Activer GitHub Pages sur ce dépôt : *Settings → Pages → Source : Deploy from a branch*,
   choisir la branche `main` (ou la branche de travail) et le dossier `/ (root)`.
2. Ouvrir l'URL fournie (`https://<compte>.github.io/jessy-sport/`) dans **Safari** sur l'iPhone.
3. Bouton Partager → **Sur l'écran d'accueil**.

## Tester en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Fichiers

- `index.html` : page principale
- `app.js` : logique de l'app
- `styles.css` : style (thème clair / sombre automatique)
- `sw.js` : cache hors ligne (incrémenter `VERSION` après chaque modification)
- `manifest.json`, `icons/` : installation sur l'écran d'accueil
