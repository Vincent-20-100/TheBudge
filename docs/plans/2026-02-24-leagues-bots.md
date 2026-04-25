# Leagues Bot Padding — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Toujours afficher au moins 10 joueurs dans chaque ligue (via des bots déterministes), et corriger deux bugs d'affichage dans `LeaguesScreen`.

**Architecture:** `padWithBots(standings, groupId, targetSize)` génère des joueurs fictifs en complément dans `LeaguesService.ts`, de manière déterministe (PRNG seedé sur groupId + index). `LeaguesScreen` appelle `padWithBots` après chaque fetch (init + Realtime). Les bots ont `userId` préfixé `bot-` pour identifier le joueur courant sans confusion.

**Tech Stack:** TypeScript, React 19, Supabase Realtime (abonnement `postgres_changes`), PRNG xmur3/mulberry32 (pur JS, pas de dépendance).

---

## Contexte des bugs confirmés

Diagnostic issu de la requête SQL directe (semaine 2026-02-22) :
- Vincent est seul dans son groupe (tier 3) → classement d'1 joueur affiché
- Pavel est dans un autre groupe (tier 1) → classement d'1 joueur affiché
- Cause : tiers différents = groupes différents = personne ne se voit (comportement correct)

### Bug 1 — `!displayName` guard (LeaguesScreen.tsx:63)
```ts
if (!displayName) return;  // ← stoppe l'init si le compte Google n'a pas de nom
```
Fix : continuer avec un fallback `'Joueur'` si `displayName` est vide.

### Bug 2 — `isCurrentUser` par displayName (LeaguesScreen.tsx:157)
```ts
const isCurrentUser = entry.displayName === displayName;  // ← fragile
```
Fix : comparer `entry.userId` avec l'uid Supabase de la session courante.

### Feature — `padWithBots`
Compléter le classement avec des bots jusqu'à `targetSize` (défaut 10).
- PRNG seedé sur `groupId + botIndex` → déterministe entre rechargements
- Noms français réalistes (liste fixe de 30)
- XP distribué sous le vrai dernier joueur (visible mais jamais premiers)
- `userId` préfixé `bot-` → `isCurrentUser` ne confond jamais un bot

---

## Task 1 — Fix `!displayName` guard

**Files:**
- Modify: `src/screens/LeaguesScreen.tsx:62-63`

**Step 1: Localiser le guard**

Ligne 63 dans `LeaguesScreen.tsx` :
```ts
const initLeagues = useCallback(async () => {
  if (!displayName) return;
```

**Step 2: Appliquer le fix**

Remplacer :
```ts
if (!displayName) return;
```
Par :
```ts
const effectiveDisplayName = displayName || 'Joueur';
```
Et remplacer la seule utilisation de `displayName` dans cette fonction (ligne 74) :
```ts
// avant
const gid = await getOrJoinGroup(uid, effectiveTier, weekStart, displayName);
// après
const gid = await getOrJoinGroup(uid, effectiveTier, weekStart, effectiveDisplayName);
```

**Step 3: Vérifier**

`npm run build` — doit compiler sans erreur.

**Step 4: Commit**
```bash
git add src/screens/LeaguesScreen.tsx
git commit -m "fix: leagues init ne bloque plus si displayName est vide"
```

---

## Task 2 — Fix `isCurrentUser` (userId vs displayName)

**Files:**
- Modify: `src/screens/LeaguesScreen.tsx`

**Context:** `isCurrentUser` est calculé ligne 157 par comparaison de `displayName`, ce qui est fragile (doublons possibles). Il faut utiliser l'uid de session.

**Step 1: Ajouter l'état `currentUserId`**

Après la ligne :
```ts
const [isLoadingBoard, setIsLoadingBoard] = useState(true);
```
Ajouter :
```ts
const [currentUserId, setCurrentUserId] = useState<string | null>(null);
```

**Step 2: Alimenter `currentUserId` dans `initLeagues`**

Dans `initLeagues`, la ligne `const uid = session?.user?.id;` existe déjà. Après avoir vérifié `uid` :
```ts
if (!uid) { setIsLoadingBoard(false); return; }
setCurrentUserId(uid);
```

**Step 3: Mettre à jour `isCurrentUser` dans le rendu**

Ligne 157, remplacer :
```ts
const isCurrentUser = entry.displayName === displayName;
```
Par :
```ts
const isCurrentUser = entry.userId === currentUserId;
```

**Step 4: Vérifier**

`npm run build` — doit compiler sans erreur.

**Step 5: Commit**
```bash
git add src/screens/LeaguesScreen.tsx
git commit -m "fix: isCurrentUser compare userId au lieu de displayName"
```

---

## Task 3 — Ajouter `padWithBots` dans `LeaguesService.ts`

**Files:**
- Modify: `src/services/LeaguesService.ts`

**Context:** Ajouter une fonction pure à la fin du fichier. Pas de changement d'interfaces existantes.

**Step 1: Ajouter le PRNG et la liste de noms**

À la fin de `LeaguesService.ts`, ajouter :

```ts
/** Liste de noms français utilisés pour les bots de ligue. */
const BOT_NAMES = [
  'Alice Martin', 'Baptiste Leroy', 'Camille Dubois', 'David Bernard', 'Emma Petit',
  'François Thomas', 'Gabrielle Robert', 'Hugo Simon', 'Inès Laurent', 'Julien Michel',
  'Karine Garcia', 'Léo Martinez', 'Manon Lefebvre', 'Nicolas Moreau', 'Océane Dupont',
  'Pierre Fontaine', 'Quentin Mercier', 'Rachel Boyer', 'Samuel Girard', 'Théa Bonnet',
  'Ugo Renard', 'Valentine Morel', 'William Lambert', 'Xénia Colin', 'Yasmine Picard',
  'Zacharie Gautier', 'Amélie Lemaire', 'Benoît Rousseau', 'Clara Blanc', 'Damien Chevalier',
];

/** PRNG déterministe seedé sur une chaîne. Retourne un entier 32 bits non signé. */
function seededRand(seed: string, index: number): number {
  let h = index + 1;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b9);
    h ^= h >>> 16;
  }
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Complète un classement avec des bots déterministes jusqu'à `targetSize`.
 * Les bots ont toujours moins d'XP que le dernier vrai joueur (ou ≤ 5 XP si board vide).
 * L'userId est préfixé `bot-` pour ne jamais confondre avec un utilisateur réel.
 */
export function padWithBots(
  standings: LeagueStanding[],
  groupId: string,
  weekStart: string,
  targetSize = 10
): LeagueStanding[] {
  const needed = targetSize - standings.length;
  if (needed <= 0) return standings;

  const minXp = standings.length > 0
    ? Math.max(0, standings[standings.length - 1].xpThisWeek - 1)
    : 5;

  const bots: LeagueStanding[] = [];
  for (let i = 0; i < needed; i++) {
    const rand = seededRand(groupId + weekStart, i);
    const nameIndex = rand % BOT_NAMES.length;
    const xp = Math.max(0, minXp - (rand % (minXp + 1)));
    bots.push({
      userId: `bot-${groupId}-${i}`,
      groupId,
      weekStart,
      tier: standings[0]?.tier ?? 1,
      xpThisWeek: xp,
      displayName: BOT_NAMES[nameIndex],
    });
  }

  // Trier bots entre eux par XP décroissant (les vrais joueurs restent devant)
  bots.sort((a, b) => b.xpThisWeek - a.xpThisWeek);
  return [...standings, ...bots];
}
```

**Step 2: Vérifier**

`npm run build` — doit compiler sans erreur.

**Step 3: Commit**
```bash
git add src/services/LeaguesService.ts
git commit -m "feat: padWithBots — bots déterministes pour compléter les ligues à 10 joueurs"
```

---

## Task 4 — Intégrer `padWithBots` dans `LeaguesScreen`

**Files:**
- Modify: `src/screens/LeaguesScreen.tsx`

**Step 1: Importer `padWithBots`**

Ligne 11 dans les imports depuis `LeaguesService` :
```ts
import {
  LeagueStanding,
  getCurrentWeekStart,
  getOrJoinGroup,
  fetchLeaderboard,
  subscribeToGroup,
  resolveWeekEnd,
  padWithBots,          // ← ajouter
} from '../services/LeaguesService';
```

**Step 2: Appliquer dans `initLeagues`**

Dans `initLeagues`, remplacer :
```ts
const board = await fetchLeaderboard(gid, weekStart);
setLeaderboard(board);
```
Par :
```ts
const board = await fetchLeaderboard(gid, weekStart);
setLeaderboard(padWithBots(board, gid, weekStart));
```

**Step 3: Appliquer dans le callback Realtime**

Dans le `useEffect` de `subscribeToGroup` (ligne 90), remplacer :
```ts
const unsubscribe = subscribeToGroup(groupId, weekStart, setLeaderboard);
```
Par :
```ts
const unsubscribe = subscribeToGroup(
  groupId,
  weekStart,
  (fresh) => setLeaderboard(padWithBots(fresh, groupId, weekStart))
);
```

**Step 4: Vérifier visuellement**

`npm run dev` → ouvrir l'onglet Ligues → le classement doit afficher 10 lignes même si l'utilisateur est seul dans son groupe.

**Step 5: Commit**
```bash
git add src/screens/LeaguesScreen.tsx
git commit -m "feat: intégration padWithBots — ligues toujours 10 joueurs minimum"
```

---

## Task 5 — Build final et vérification

**Step 1: Build prod**
```bash
npm run build
```
Résultat attendu : `✓ built in X.Xs` sans erreur ni warning TypeScript bloquant.

**Step 2: Smoke test**

`npm run dev` → vérifier :
- [ ] Onglet Ligues s'affiche même avec un compte Google sans `displayName`
- [ ] 10 joueurs apparaissent dans le classement (bots complètent)
- [ ] L'utilisateur courant est bien surligné en violet (isCurrentUser correct)
- [ ] Les bots ont des noms français réalistes
- [ ] Les bots ont moins d'XP que les vrais joueurs (ils sont en bas du classement)

**Step 3: Commit final si ajustements**
```bash
git add -p
git commit -m "fix: ajustements mineurs après smoke test ligues"
```
