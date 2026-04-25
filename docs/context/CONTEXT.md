# TheBudge — Contexte de session

## Projet
PWA d'éducation financière (Duolingo-style), mobile-first, React 19 + TypeScript + Vite.
Déployé sur **Vercel** (frontend) + **Google Cloud Run** (backend Python/Gemini pour le chatbot).
Branche de travail active : `dev-vincent` (merge sur `main` quand validée).

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
├── assets/        chess.png, chess-open.png (LearningPathScreen)
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
- `UserProgressContext.tsx` — onAuthStateChange, Promise.race 6s timeout, UNAVAILABLE sentinel

### ✅ Sprint 2a — Ligues
- `LeaguesService.ts` + table `league_standings` Supabase
- `LeaguesScreen.tsx` — données dynamiques, XP hebdomadaire, promotion/rétrogradation

### ✅ Sprint 2b — Trophées
- `TrophiesScreen.tsx` — connecté à UserProgressContext

### ✅ Sprint 3 — Newsletter + Panel dev
- `NewsletterService.ts` — préférences et historique Supabase
- Panel développeur dans `ProfileModal.tsx` (overrideProgress)

### ✅ Refactorisation repo (2026-02-24)
- Migration code source vers `src/`
- Backend Flask dans `backend/`
- Docs réduits à 4 fichiers + plans/

## Table Supabase `user_progress`
user_id (UUID PK), streak, diamonds, energy, max_energy, completed_capsules (int[]),
current_capsule, claimed_chests (int[]), xp_total, league_tier, last_lesson_date,
energy_last_updated, max_streak, perfect_lessons, max_daily_xp, max_league_tier,
daily_xp, daily_xp_date, created_at, updated_at.

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
- Docs dans `docs/`, jamais à la racine
