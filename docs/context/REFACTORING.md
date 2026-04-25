# TheBudge — Journal de refactorisation

Ce fichier documente la réorganisation du repo effectuée le 2026-02-24.
Il sert de référence pour le debug assisté par IA : si un fichier semble manquant, chercher ici son emplacement d'origine.

---

## Structure avant refactorisation

```
TheBudge/
├── App.tsx                          → src/App.tsx
├── index.tsx                        → src/index.tsx
├── types.ts                         → src/types.ts
├── components/                      → src/components/
├── contexts/                        → src/contexts/
├── navigation/                      → src/navigation/
├── screens/                         → src/screens/
├── services/                        → src/services/
├── utils/                           → src/utils/
├── assets cours/                    → src/assets/bears/
├── assets/chess.png                 → src/assets/chess.png
├── assets/chess-open.png            → src/assets/chess-open.png
├── assets/README.md                 → SUPPRIMÉ
├── capsules/                        → SUPPRIMÉ (doublon de public/capsules/)
├── knowledgebase/                   → backend/knowledgebase/
├── main.py                          → backend/main.py
├── cloud_run_main.py                → fusionné dans main.py par Pavel (commit d67da0e)
├── requirements.txt                 → backend/requirements.txt
├── phrases_felicitation.md          → SUPPRIMÉ (contenu hardcodé dans PhraseService.ts)
├── phrases_motivation.md            → SUPPRIMÉ (contenu hardcodé dans PhraseService.ts)
├── dist/                            → gitignored (non tracké)
├── docs/BLUEPRINT_USER_DATA.md      → SUPPRIMÉ (sprint 1 terminé)
├── docs/BLUEPRINT_LEAGUES.md        → SUPPRIMÉ (sprint 2a terminé)
├── docs/IMPLEMENTATION_SPRINT3.md   → SUPPRIMÉ (sprint 3 terminé)
├── docs/REFACTORING_LEARNING_PATH.md→ SUPPRIMÉ (done)
├── docs/OAUTH_IMPLEMENTATION.md     → fusionné dans docs/DEPLOYMENT.md
└── docs/CLOUD_RUN_UPDATE.md         → fusionné dans docs/DEPLOYMENT.md
```

## Changements de configuration

| Fichier | Avant | Après |
|---|---|---|
| `index.html` | `src="/index.tsx"` | `src="/src/index.tsx"` |
| `vite.config.ts` | `@` → `.` (racine) | `@` → `./src` |
| `tsconfig.json` | `@/*` → `./*`, pas de baseUrl | `@/*` → `src/*`, `baseUrl: "."` |

## Notes importantes

- `public/capsules/` est la source unique des capsules — ne pas créer de doublon
- `src/assets/bears/` contient les images importées statiquement par Vite (PhraseService.ts)
- `src/assets/` contient chess.png / chess-open.png (importés statiquement par LearningPathScreen.tsx)
- `public/bear_assets/` contient les images chargées dynamiquement via URL publique
- `backend/knowledgebase/` contient les notes de configuration Vertex AI Search
- `learning_path/` et `newsletter/` à la racine sont des **sous-modules git** (autres repos de l'équipe)
