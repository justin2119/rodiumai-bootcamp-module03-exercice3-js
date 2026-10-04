# Exercice 3 — RodiumAI (JavaScript / Node.js)

Ce projet propose un parcours interactif en trois étapes pour découvrir l’API RodiumAI : conversation, génération d’image, puis génération de vidéo. À chaque étape, vous pouvez revenir à l’étape précédente, refaire l’étape actuelle ou passer à la suite.

## Prérequis

Node.js récent et une clé API RodiumAI.

## Installation

```bash
npm install
```

## Configuration

Copiez `.env.example` vers `.env`, puis remplacez `your_rodiumai_api_key_here` par votre clé API. Les modèles sont configurables avec `RODIUMAI_CHAT_MODEL`, `RODIUMAI_IMAGE_MODEL` et `RODIUMAI_VIDEO_MODEL`. Ne partagez jamais `.env` ni votre clé.

## Lancement

```bash
node main.js
```

Ou utilisez `npm start`.

## Parcours

1. **Chat** — saisissez un message et consultez la réponse.
2. **Image** — décrivez l’image ; le fichier est enregistré dans `outputs/` si l’API retourne des données image ou une URL téléchargeable.
3. **Vidéo** — décrivez la vidéo ; le résultat est enregistré dans `outputs/` lorsque l’API fournit une URL.

Après chaque étape, choisissez exactement l’une de ces options :

1. Revenir à l’étape précédente
2. Refaire l’étape actuelle
3. Passer à la suite

À la première étape, revenir recommence le chat ; à la dernière, passer à la suite termine le parcours. Les erreurs sont signalées sans interrompre les autres possibilités de navigation. Les méthodes et formats disponibles peuvent varier selon la version du SDK et les capacités du compte RodiumAI.
