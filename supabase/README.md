# TheBudge — Supabase

## Structure

```
supabase/
├── schema.sql   ← Script "from scratch" : recrée toute la DB depuis zéro
└── README.md    ← Ce fichier
```

---

## Utilisation

`schema.sql` est la source de vérité. Pour créer une nouvelle DB (nouveau projet Supabase, environnement de test) :

1. Ouvrir **Supabase Dashboard → SQL Editor → New query**
2. Copier-coller le contenu de `schema.sql`
3. Cliquer **Run**

---

## Tables

### `user_progress`
Une ligne par utilisateur. Upsert sur `user_id`.

| Colonne | Type | Description |
|---|---|---|
| `user_id` | UUID PK | Référence `auth.users` (Google OAuth) |
| `streak` | INTEGER | Série de jours consécutifs |
| `diamonds` | INTEGER | Diamonds accumulés |
| `energy` / `max_energy` | INTEGER | Énergie actuelle / plafond (recharge +1/30min) |
| `completed_capsules` | INTEGER[] | IDs des capsules complétées |
| `current_capsule` | INTEGER | Pointeur vers la capsule en cours |
| `claimed_chests` | INTEGER[] | Index des coffres déjà ouverts (idempotent) |
| `league_tier` | INTEGER | Palier de ligue actuel (1=Bronze…) |
| `xp_total` | INTEGER | XP total cumulé |
| `last_lesson_date` | DATE | Date de la dernière leçon (streak) |
| `energy_last_updated` | TIMESTAMPTZ | Timestamp de la dernière écriture d'énergie |
| `max_streak` | INTEGER | Record personnel de streak |
| `perfect_lessons` | INTEGER | Nombre de leçons sans erreur |
| `max_daily_xp` | INTEGER | Meilleur XP en une journée |
| `max_league_tier` | INTEGER | Meilleur palier de ligue atteint |
| `daily_xp` | INTEGER | XP gagné aujourd'hui |
| `daily_xp_date` | DATE | Date du compteur daily_xp |

RLS : chaque utilisateur lit/écrit uniquement sa propre ligne.
Suppression : cascade depuis `auth.users` (RGPD-safe).

---

### `league_standings`
Une ligne par `(user_id, week_start)`. Classement hebdomadaire par groupe.

| Colonne | Type | Description |
|---|---|---|
| `user_id` | UUID | Référence `auth.users` |
| `group_id` | UUID | Identifiant du groupe (20 joueurs max par groupe) |
| `week_start` | DATE | Lundi de la semaine (clé de partitionnement) |
| `tier` | INTEGER | Palier de la semaine |
| `xp_this_week` | INTEGER | XP gagné cette semaine |
| `display_name` | TEXT | Pseudo affiché dans le classement |

RLS : un utilisateur voit uniquement les membres de son propre groupe.

**Fonctions SQL associées :**
- `join_or_create_league_group(user_id, tier, week_start, display_name)` — assigne atomiquement l'utilisateur à un groupe existant ou en crée un nouveau. Protège contre les race conditions multi-onglets.
- `increment_league_xp(user_id, week_start, amount)` — incrémente l'XP de ligue de manière atomique. Lève une exception si la ligne n'existe pas.

---

### `newsletter_preferences`
Une ligne par utilisateur. Stocke les sujets favoris (remplace localStorage).

| Colonne | Type | Description |
|---|---|---|
| `user_id` | UUID PK | Référence `auth.users` |
| `topics` | JSONB | Liste des sujets sélectionnés |

### `newsletter_history`
Historique des recherches newsletter avec retour de satisfaction.

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Généré automatiquement |
| `user_id` | UUID | Référence `auth.users` |
| `topics` | JSONB | Sujets de la recherche |
| `articles` | JSONB | Articles générés |
| `satisfaction` | BOOLEAN | Retour utilisateur (pouce haut/bas) |
| `created_at` | TIMESTAMPTZ | Date de la recherche |
