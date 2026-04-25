# Design — Réorganisation complète du repo TheBudge

**Date :** 2026-02-24
**Contexte :** Hackathon noté par des professeurs. Objectif : repo propre, professionnel, bonnes pratiques.

---

## Structure cible

```
TheBudge/
├── src/
│   ├── components/
│   ├── contexts/
│   ├── navigation/
│   ├── screens/
│   ├── services/
│   ├── utils/
│   ├── types.ts
│   ├── App.tsx
│   └── index.tsx
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── knowledgebase/
├── supabase/
│   └── schema.sql
├── public/
│   ├── capsules/
│   ├── bear_assets/
│   └── assets/
├── docs/
│   ├── CONTEXT.md
│   ├── DEPLOYMENT.md
│   ├── BUG_TO_FIX.md
│   └── REFACTORING.md
├── .env.local.example
├── .gitignore
├── index.html
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Décisions

- Migration vers `src/` : standard React, attendu par les profs
- `backend/` : séparation claire frontend/backend
- `knowledgebase/` dans `backend/` : lié au RAG Vertex AI, pas au frontend
- `dist/` : retiré du git + ajouté au `.gitignore`
- README : `docs/README.md` devient le README racine (anglais uniquement, avec Mermaid)
- `docs/` réduit à 4 fichiers max
- `docs/REFACTORING.md` : trace de l'avant/après pour debug IA assisté

## Fichiers supprimés

- `docs/BLUEPRINT_USER_DATA.md`, `BLUEPRINT_LEAGUES.md`, `IMPLEMENTATION_SPRINT3.md`, `REFACTORING_LEARNING_PATH.md`, `OAUTH_IMPLEMENTATION.md`, `CLOUD_RUN_UPDATE.md`, `docs/README.md`
- `cloud_run_main.py` (contenu intégré dans `backend/main.py`)
- `capsules/` racine (doublon de `public/capsules/`)
- `assets cours/` racine (doublon dans `public/bear_assets/`)
- `assets/README.md`, `public/assets/README.md` (placeholders vides)
- `phrases_felicitation.md`, `phrases_motivation.md` → déplacés dans `public/`
