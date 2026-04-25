# Réorganisation complète du repo TheBudge

> **Note 2026-02-24 post-pull :** Nous travaillons sur la branche `dev-vincent`. dist/ est déjà gitignored. Les assets/Im1-Im14 racine ont déjà été supprimés par le commit c1e62fc.


> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructurer le repo pour un hackathon noté — séparation frontend/backend, migration vers `src/`, nettoyage docs et git.

**Architecture:** Tout le code React migre dans `src/`. Le backend Flask va dans `backend/`. Les docs sont réduits à 4 fichiers. `dist/` est retiré du git.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CDN, Supabase, Python/Flask (Cloud Run)

**Pas de tests automatisés** — validation via `npm run build` à chaque checkpoint.

---

## Ordre d'exécution — important

Respecter cet ordre strict :
1. Git cleanup (dist/) → 2. Migration src/ → 3. Config Vite/TS → 4. Build OK → 5. Backend → 6. Assets → 7. Orphelins → 8. Docs → 9. README → 10. Commit final

---

## Task 1 : Vérifier .gitignore — déjà fait

**dist/ est déjà dans .gitignore et non tracké (vérifié). Aucune action requise.**

Vérification rapide :
\nExpected : aucun output (non tracké).

Passer directement à Task 2.

---

## Task 2 : Créer la structure src/ et migrer le code source

**Files:**
- Create: `src/` (dossier)
- Move: `components/`, `contexts/`, `navigation/`, `screens/`, `services/`, `utils/`, `types.ts`, `App.tsx`, `index.tsx` → `src/`

**Step 1 : Créer le dossier src/**

```bash
mkdir src
```

**Step 2 : Déplacer les dossiers source**

```bash
git mv components src/components
git mv contexts src/contexts
git mv navigation src/navigation
git mv screens src/screens
git mv services src/services
git mv utils src/utils
```

**Step 3 : Déplacer les fichiers racine**

```bash
git mv App.tsx src/App.tsx
git mv index.tsx src/index.tsx
git mv types.ts src/types.ts
```

**Step 4 : Vérifier la structure**

```bash
ls src/
```
Expected : `App.tsx  components  contexts  index.tsx  navigation  screens  services  types.ts  utils`

**Step 5 : Vérifier git status**

```bash
git status
```
Expected : tous les fichiers apparaissent comme `renamed: X → src/X`

---

## Task 3 : Migrer les assets bears (assets cours/ → src/assets/bears/)

**Contexte critique :** `PhraseService.ts` (maintenant `src/services/PhraseService.ts`) importe les images bear via des imports Vite statiques depuis `../assets cours/`. Ces images doivent migrer dans `src/assets/bears/` pour :
1. Éviter le `..` qui remonterait hors de `src/`
2. Supprimer les espaces dans le chemin

**Files:**
- Create: `src/assets/bears/`
- Move: `assets cours/*` → `src/assets/bears/`
- Modify: `src/services/PhraseService.ts`

**Step 1 : Créer le dossier cible**

```bash
mkdir -p src/assets/bears
```

**Step 2 : Copier les fichiers (git mv ne supporte pas les espaces dans les noms facilement)**

```bash
cp "assets cours/arbre a sous.png" "src/assets/bears/arbre a sous.png"
cp "assets cours/assis sur l'argent.png" "src/assets/bears/assis sur l'argent.png"
cp "assets cours/bear_words_logo-1-Photoroom.png" "src/assets/bears/bear_words_logo-1-Photoroom.png"
cp "assets cours/inviting_bear-1-Photoroom.png" "src/assets/bears/inviting_bear-1-Photoroom.png"
cp "assets cours/jumping_bear-1-Photoroom.png" "src/assets/bears/jumping_bear-1-Photoroom.png"
cp "assets cours/loving_bear-1-Photoroom.png" "src/assets/bears/loving_bear-1-Photoroom.png"
cp "assets cours/ours avec des livres.png" "src/assets/bears/ours avec des livres.png"
cp "assets cours/shia_bear-1-Photoroom.png" "src/assets/bears/shia_bear-1-Photoroom.png"
cp "assets cours/singing_bear-1-Photoroom.png" "src/assets/bears/singing_bear-1-Photoroom.png"
```

**Step 3 : Mettre à jour les imports dans PhraseService.ts**

Dans `src/services/PhraseService.ts`, remplacer tous les imports `'../assets cours/...'` par `'../assets/bears/...'` :

```ts
// Avant
import arbreASous from '../assets cours/arbre a sous.png';
import assisSurArgent from "../assets cours/assis sur l'argent.png";
import bearWords from '../assets cours/bear_words_logo-1-Photoroom.png';
import invitingBear from '../assets cours/inviting_bear-1-Photoroom.png';
import jumpingBear from '../assets cours/jumping_bear-1-Photoroom.png';
import lovingBear from '../assets cours/loving_bear-1-Photoroom.png';
import oursAvecLivres from '../assets cours/ours avec des livres.png';
import shiaBear from '../assets cours/shia_bear-1-Photoroom.png';
import singingBear from '../assets cours/singing_bear-1-Photoroom.png';

// Après
import arbreASous from '../assets/bears/arbre a sous.png';
import assisSurArgent from "../assets/bears/assis sur l'argent.png";
import bearWords from '../assets/bears/bear_words_logo-1-Photoroom.png';
import invitingBear from '../assets/bears/inviting_bear-1-Photoroom.png';
import jumpingBear from '../assets/bears/jumping_bear-1-Photoroom.png';
import lovingBear from '../assets/bears/loving_bear-1-Photoroom.png';
import oursAvecLivres from '../assets/bears/ours avec des livres.png';
import shiaBear from '../assets/bears/shia_bear-1-Photoroom.png';
import singingBear from '../assets/bears/singing_bear-1-Photoroom.png';
```

**Step 4 : Ajouter les nouveaux fichiers au staging**

```bash
git add src/assets/bears/
git add src/services/PhraseService.ts
```

---

## Task 4 : Mettre à jour la config Vite, TypeScript et index.html

**Files:**
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`
- Modify: `index.html`

**Step 1 : Mettre à jour vite.config.ts**

Changer l'alias `@` pour pointer vers `src/` au lieu de la racine :

```ts
// vite.config.ts — remplacer le bloc resolve.alias
resolve: {
  alias: {
    '@': path.resolve(__dirname, 'src'),
  }
},
```

**Step 2 : Mettre à jour tsconfig.json**

Changer le path `@/*` pour pointer vers `src/` :

```json
"paths": {
  "@/*": ["src/*"]
}
```

Ajouter `"baseUrl": "."` dans `compilerOptions` si absent.

**Step 3 : Mettre à jour index.html**

Changer le script d'entrée :

```html
<!-- Avant -->
<script type="module" src="/index.tsx"></script>

<!-- Après -->
<script type="module" src="/src/index.tsx"></script>
```

**Step 4 : Vérifier tous les imports internes dans src/**

Les imports relatifs entre fichiers de `src/` ne changent pas (ex: `screens/` → `../services/` reste valide car les deux sont dans `src/`). Vérifier rapidement qu'aucun import ne remonte au-dessus de `src/` sauf pour les assets (déjà corrigés en Task 3) :

```bash
grep -r "from '\.\./\.\." src/ --include="*.ts" --include="*.tsx"
```

Expected : aucun résultat (ou uniquement les imports d'assets bears déjà corrigés)

**Step 5 : Stage les changements**

```bash
git add vite.config.ts tsconfig.json index.html
```

---

## Task 5 : Vérifier le build — checkpoint critique

**Step 1 : Lancer le build**

```bash
npm run build
```

Expected : `✓ built in X.XXs` sans erreur TypeScript ni Vite.

**Si erreur :** lire le message et corriger avant de continuer. Les erreurs les plus probables :
- Import introuvable → chemin relatif incorrect
- Type error → aucun changement de types effectué, improbable

**Step 2 : Commit de la migration src/**

```bash
git add -A
git commit -m "refactor: migration code source vers src/, assets bears vers src/assets/bears/"
```

---

## Task 6 : Séparer le backend

**Files:**
- Create: `backend/`
- Move: `cloud_run_main.py` → `backend/main.py` (version améliorée qui remplace main.py)
- Move: `requirements.txt` → `backend/requirements.txt`
- Move: `knowledgebase/` → `backend/knowledgebase/`
- Delete: `main.py` (racine), `cloud_run_main.py` (déjà renommé)

**Contexte :** `cloud_run_main.py` est la version améliorée de `main.py` (gestion d'erreurs RAG, fallback sans Vertex AI). C'est elle qui devient `backend/main.py`.

**Step 1 : Créer le dossier backend/**

```bash
mkdir backend
```

**Step 2 : Déplacer et renommer cloud_run_main.py**

```bash
cp cloud_run_main.py backend/main.py
git add backend/main.py
git rm cloud_run_main.py
```

**Step 3 : Déplacer requirements.txt**

```bash
git mv requirements.txt backend/requirements.txt
```

**Step 4 : Déplacer knowledgebase/**

```bash
git mv knowledgebase backend/knowledgebase
```

**Step 5 : Supprimer l'ancien main.py racine**

```bash
git rm main.py
```

**Step 6 : Vérifier**

```bash
ls backend/
```
Expected : `knowledgebase  main.py  requirements.txt`

**Step 7 : Commit**

```bash
git add -A
git commit -m "refactor: séparation backend Flask dans backend/"
```

---

## Task 7 : Supprimer les fichiers orphelins et doublons

**Files à supprimer :**
- `assets cours/` (racine) — migré dans `src/assets/bears/`
- `capsules/` (racine) — doublon de `public/capsules/`
- `phrases_felicitation.md`, `phrases_motivation.md` — phrases hardcodées dans PhraseService.ts, fichiers .md non utilisés
- `LANCER_APP_VITE.bat` — **garder** à la racine (utile pour Windows)
- `assets/README.md`, `public/assets/README.md` — placeholders vides

**Vérifier avant de supprimer** que `assets/chess.png` et `assets/chess-open.png` ne sont pas référencés dans le code :

```bash
grep -r "chess" src/ --include="*.ts" --include="*.tsx"
```

Si résultat → adapter. Si vide → supprimer.

**Step 1 : Supprimer assets cours/ racine**

```bash
git rm -r "assets cours/"
```

**Step 2 : Supprimer assets/ racine**

```bash
git rm -r assets/
```

**Step 3 : Supprimer capsules/ racine (doublon)**

```bash
git rm -r capsules/
```

**Step 4 : Supprimer fichiers orphelins**

```bash
git rm phrases_felicitation.md phrases_motivation.md
git rm public/assets/README.md
```

**Step 5 : Vérifier que public/capsules/ est intact**

```bash
ls public/capsules/
```
Expected : `capsule1.md capsule2.md ... capsule9.md`

**Step 6 : Commit**

```bash
git add -A
git commit -m "chore: suppression fichiers orphelins et doublons"
```

---

## Task 8 : Nettoyer /docs — supprimer les fichiers obsolètes

**Fichiers à supprimer :**
- `docs/BLUEPRINT_USER_DATA.md` — sprints terminés, contenu dans README
- `docs/BLUEPRINT_LEAGUES.md` — sprint terminé
- `docs/IMPLEMENTATION_SPRINT3.md` — sprint terminé
- `docs/REFACTORING_LEARNING_PATH.md` — done
- `docs/OAUTH_IMPLEMENTATION.md` — sera fusionné dans DEPLOYMENT.md (Task 9)
- `docs/CLOUD_RUN_UPDATE.md` — sera fusionné dans DEPLOYMENT.md (Task 9)
- `docs/README.md` — deviendra le README racine (Task 10)

**Step 1 : Supprimer les 4 fichiers purement obsolètes**

```bash
git rm docs/BLUEPRINT_USER_DATA.md docs/BLUEPRINT_LEAGUES.md docs/IMPLEMENTATION_SPRINT3.md docs/REFACTORING_LEARNING_PATH.md
```

**Step 2 : Commit intermédiaire**

```bash
git commit -m "docs: suppression fichiers de planification obsolètes (sprints terminés)"
```

---

## Task 9 : Fusionner OAUTH_IMPLEMENTATION + CLOUD_RUN_UPDATE dans DEPLOYMENT.md

**Files:**
- Modify: `docs/DEPLOYMENT.md`
- Delete: `docs/OAUTH_IMPLEMENTATION.md`, `docs/CLOUD_RUN_UPDATE.md`

**Step 1 : Lire les 3 fichiers**

Lire `docs/DEPLOYMENT.md`, `docs/OAUTH_IMPLEMENTATION.md`, `docs/CLOUD_RUN_UPDATE.md` pour identifier ce qui manque dans DEPLOYMENT.md.

**Step 2 : Ajouter dans DEPLOYMENT.md**

Ajouter deux nouvelles sections en bas de `docs/DEPLOYMENT.md` :

```markdown
---

## Configuration Google OAuth (Supabase)

1. Supabase Dashboard → Authentication → Providers → Google → Activer
2. Renseigner Client ID et Client Secret Google Cloud Console
3. Authorized redirect URI : `https://<project-ref>.supabase.co/auth/v1/callback`
4. Dans Google Cloud Console : ajouter l'URI en "Authorized redirect URIs" du client OAuth

---

## Mise à jour du backend Cloud Run

Le fichier `backend/main.py` est la version de production.
Pour déployer une mise à jour :

```bash
# Depuis le dossier backend/
gcloud run deploy thebudge-coach \
  --source . \
  --region europe-west9 \
  --allow-unauthenticated
```

Le backend fonctionne sans RAG si `DATASTORE_PATH` n'est pas configuré (fallback automatique).
```

**Step 3 : Supprimer les fichiers fusionnés**

```bash
git rm docs/OAUTH_IMPLEMENTATION.md docs/CLOUD_RUN_UPDATE.md
```

**Step 4 : Commit**

```bash
git add docs/DEPLOYMENT.md
git commit -m "docs: fusion OAUTH et CLOUD_RUN dans DEPLOYMENT.md, suppression fichiers redondants"
```

---

## Task 10 : Créer REFACTORING.md (trace avant/après pour debug IA)

**Files:**
- Create: `docs/REFACTORING.md`

**Step 1 : Créer le fichier**

Créer `docs/REFACTORING.md` avec ce contenu :

```markdown
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
├── assets/                          → SUPPRIMÉ (chess.png non utilisé)
├── capsules/                        → SUPPRIMÉ (doublon de public/capsules/)
├── knowledgebase/                   → backend/knowledgebase/
├── main.py                          → SUPPRIMÉ (remplacé par cloud_run_main.py)
├── cloud_run_main.py                → backend/main.py
├── requirements.txt                 → backend/requirements.txt
├── phrases_felicitation.md          → SUPPRIMÉ (contenu hardcodé dans PhraseService.ts)
├── phrases_motivation.md            → SUPPRIMÉ (contenu hardcodé dans PhraseService.ts)
├── dist/                            → SUPPRIMÉ du git (ajouté à .gitignore)
├── docs/README.md                   → README.md (racine)
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
| `tsconfig.json` | `@/*` → `./*` | `@/*` → `src/*` |

## Alias d'imports

L'alias `@/` pointe maintenant vers `src/`. Exemple :
- `@/types` → `src/types.ts`
- `@/components/Header` → `src/components/Header.tsx`

## Notes importantes

- `public/capsules/` est la source unique des capsules — ne pas créer de doublon
- `src/assets/bears/` contient les images importées statiquement par Vite (PhraseService.ts)
- `public/bear_assets/` contient les images chargées dynamiquement via URL publique
- `backend/knowledgebase/` contient les notes de configuration Vertex AI Search (non utilisé dans le code frontend)
```

**Step 2 : Commit**

```bash
git add docs/REFACTORING.md
git commit -m "docs: ajout REFACTORING.md — trace structure avant/après pour debug IA"
```

---

## Task 11 : Mettre à jour CONTEXT.md

**Files:**
- Modify: `docs/CONTEXT.md`

**Step 1 : Réécrire CONTEXT.md**

Remplacer le contenu de `docs/CONTEXT.md` pour refléter l'état réel du projet (tous les sprints terminés, nouvelle structure) :

```markdown
# TheBudge — Contexte de session

## Projet
PWA d'éducation financière (Duolingo-style), mobile-first, React 19 + TypeScript + Vite.
Déployé sur **Vercel** (frontend) + **Google Cloud Run** (backend Python/Gemini pour le chatbot).
Branche de travail active : `main` (toutes les branches mergées).

## Stack
- Frontend : React 19, TypeScript, Vite, Tailwind CDN
- DB : Supabase (PostgreSQL + Google OAuth obligatoire + RLS)
- Backend chatbot : Cloud Run Python (`backend/main.py`), Gemini API
- Newsletter : Gemini appelé directement côté client (`src/services/NewsAggregatorService.ts`)

## Structure du projet
```
src/
├── components/    AuthModal, Header, ProfileModal, TabBar
├── contexts/      UserProgressContext (auth + état global + sync optimiste)
├── navigation/    NavigationContext (5 routes via AppRoute enum)
├── screens/       LearningPathScreen, LessonScreen, LeaguesScreen, TrophiesScreen, NewsletterScreen
├── services/      CapsuleParser, CapsuleService, ChatbotService, LeaguesService,
│                  NewsAggregatorService, NewsletterService, PhraseService,
│                  UserProgressService, supabaseClient
├── utils/         progressUtils
├── assets/bears/  Images ours importées statiquement (PhraseService)
├── App.tsx
├── index.tsx
└── types.ts
backend/
├── main.py        Flask + Gemini RAG (Cloud Run)
├── requirements.txt
└── knowledgebase/ Notes config Vertex AI Search
public/capsules/   capsule1.md … capsule9.md (source unique)
supabase/schema.sql
```

## Architecture de navigation
Pas de router. `NavigationContext` (context React) gère l'écran actif via `AppRoute` enum.
5 routes : ACADEMY, LEAGUES, TROPHIES, NEWSLETTER, LESSON.

## État de l'implémentation — TOUT TERMINÉ

### ✅ Sprint 1 — Persistance UserProgress
- `UserProgressService.ts` — fetchProgress() + upsertProgress()
- `UserProgressContext.tsx` — Google OAuth + état global + sync optimiste
- `supabase/schema.sql` — table user_progress + RLS + trigger updated_at

### ✅ Sprint 1b — Google OAuth
- `AuthModal.tsx` — signInWithOAuth() Google
- `UserProgressContext.tsx` — onAuthStateChange, Promise.race 6s timeout

### ✅ Sprint 2a — Ligues
- `LeaguesService.ts` + table `league_standings` Supabase
- `LeaguesScreen.tsx` — données dynamiques, XP hebdomadaire, promotion/rétrogradation

### ✅ Sprint 2b — Trophées
- `TrophiesScreen.tsx` — connecté à UserProgressContext

### ✅ Sprint 3 — Newsletter + Panel dev
- `NewsletterService.ts` — préférences et historique Supabase
- Panel développeur dans `ProfileModal.tsx`

### ✅ Refactorisation repo
- Migration code source vers `src/`
- Backend Flask dans `backend/`
- Docs réduits à 4 fichiers

## Table Supabase `user_progress`
user_id (UUID PK), streak, diamonds, energy, max_energy, completed_capsules (int[]),
current_capsule, claimed_chests (int[]), xp_total, league_tier, last_lesson_date,
energy_last_updated, created_at, updated_at.

Table `league_standings` : user_id, week_start, xp_this_week, tier, group_id, display_name.

Hook d'accès : `const { progress, completeLesson, claimChest, overrideProgress } = useUserProgress()`

## Bugs connus (voir docs/BUG_TO_FIX.md)
- RLS `league_standings` SELECT trop permissive (priorité haute)
- RLS `league_standings` INSERT sans WITH CHECK (priorité haute)
- Timezone UTC : streak peut se réinitialiser à tort pour UTC+ (priorité moyenne)
- Chatbot modal dupliqué dans LessonScreen et LearningPathScreen (priorité basse)

## Variables d'environnement (.env.local)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GEMINI_API_KEY=
VITE_CLOUD_RUN_URL=
```

## Conventions du projet
- Commentaires : factuels, présent, pas de prospectif
- Commits : jamais de Co-Authored-By Claude, jamais de mention de Claude
- Modifications des fichiers existants : minimales (projet de groupe)
- Nouveaux services dans `src/services/`, nouveaux contextes dans `src/contexts/`
```

**Step 2 : Commit**

```bash
git add docs/CONTEXT.md
git commit -m "docs: mise à jour CONTEXT.md — tous sprints terminés, nouvelle structure src/"
```

---

## Task 12 : Unifier le README

**Files:**
- Modify: `README.md` (racine) — remplacé par le contenu de `docs/README.md`
- Delete: `docs/README.md`

**Step 1 : Lire docs/README.md**

Lire `docs/README.md` — c'est la source du nouveau README racine (complet, avec diagrammes Mermaid, tech stack, architecture, data model).

**Step 2 : Mettre à jour la section "Project Structure" dans docs/README.md**

Dans la section `## Project Structure`, remplacer le contenu par la nouvelle structure :

```markdown
## Project Structure

```
TheBudge/
├── src/
│   ├── components/          # AuthModal, Header, ProfileModal, TabBar
│   ├── contexts/            # UserProgressContext (auth + global state + optimistic sync)
│   ├── navigation/          # NavigationContext (5-route state machine, no URL router)
│   ├── screens/             # LearningPathScreen, LessonScreen, LeaguesScreen, TrophiesScreen, NewsletterScreen
│   ├── services/
│   │   ├── CapsuleParser.ts          # Markdown → structured lesson blocks (state machine + regex)
│   │   ├── CapsuleService.ts         # Dynamic capsule loading
│   │   ├── ChatbotService.ts         # Cloud Run API calls
│   │   ├── LeaguesService.ts         # League standings + group assignment
│   │   ├── NewsAggregatorService.ts  # RSS + Gemini newsletter generation
│   │   ├── NewsletterService.ts      # Newsletter preferences + history (Supabase)
│   │   ├── PhraseService.ts          # Motivational phrases + bear images
│   │   ├── UserProgressService.ts    # fetchProgress / upsertProgress (DB layer)
│   │   └── supabaseClient.ts         # Supabase singleton client
│   ├── utils/               # progressUtils (streak, energy helpers)
│   ├── assets/bears/        # Bear mascot images (Vite static imports)
│   ├── types.ts             # Shared TypeScript interfaces
│   ├── App.tsx
│   └── index.tsx
├── backend/
│   ├── main.py              # Cloud Run backend — Flask + Gemini RAG chatbot
│   ├── requirements.txt
│   └── knowledgebase/       # Vertex AI Search configuration notes
├── public/
│   ├── capsules/            # Lesson content — capsule1.md … capsule9.md
│   ├── bear_assets/         # Bear images served as public URLs
│   └── assets/              # Quiz images (Im1.png … Im14.png)
├── supabase/
│   └── schema.sql           # user_progress + league_standings tables, RLS policies
├── docs/
│   ├── CONTEXT.md           # Session context — current state, architecture, conventions
│   ├── DEPLOYMENT.md        # Vercel variables, Supabase checklist, Cloud Run deploy
│   ├── BUG_TO_FIX.md        # Known issues classified by priority
│   └── REFACTORING.md       # Repo reorganization log (before/after)
├── .env.local.example
├── index.html
├── manifest.json            # PWA manifest
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```
```

**Step 3 : Copier docs/README.md vers README.md racine**

Écrire le contenu mis à jour de `docs/README.md` dans `README.md` (racine), en remplaçant l'intégralité du fichier actuel.

**Step 4 : Supprimer docs/README.md**

```bash
git rm docs/README.md
```

**Step 5 : Commit**

```bash
git add README.md
git commit -m "docs: README unifié — docs/README.md devient source unique à la racine"
```

---

## Task 13 : Vérification finale du build

**Step 1 : Build de production**

```bash
npm run build
```

Expected : succès sans erreur.

**Step 2 : Vérifier la structure finale**

```bash
find . -not -path './.git/*' -not -path './node_modules/*' -not -path './dist/*' | sort
```

Vérifier que :
- `src/` existe avec tous les sous-dossiers
- `backend/` existe avec `main.py`, `requirements.txt`, `knowledgebase/`
- `docs/` contient exactement 5 fichiers : `CONTEXT.md`, `DEPLOYMENT.md`, `BUG_TO_FIX.md`, `REFACTORING.md`, `plans/`
- Pas de `capsules/` à la racine
- Pas de `assets cours/` à la racine
- Pas de `phrases_*.md` à la racine

**Step 3 : Vérifier que public/capsules/ est intact**

```bash
ls public/capsules/
```
Expected : 9 fichiers capsule1.md → capsule9.md

**Step 4 : Commit final si tout est propre**

```bash
git status
```

Si tout est clean :
```bash
git log --oneline -8
```
Vérifier la cohérence des commits.

---

## Résumé des commits produits

1. `chore: retirer dist/ du suivi git, mettre à jour .gitignore`
2. `refactor: migration code source vers src/, assets bears vers src/assets/bears/`
3. `refactor: séparation backend Flask dans backend/`
4. `chore: suppression fichiers orphelins et doublons`
5. `docs: suppression fichiers de planification obsolètes (sprints terminés)`
6. `docs: fusion OAUTH et CLOUD_RUN dans DEPLOYMENT.md, suppression fichiers redondants`
7. `docs: ajout REFACTORING.md — trace structure avant/après pour debug IA`
8. `docs: mise à jour CONTEXT.md — tous sprints terminés, nouvelle structure src/`
9. `docs: README unifié — docs/README.md devient source unique à la racine`
