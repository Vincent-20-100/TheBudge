# Bugs à corriger — post-audit (22 fév. 2026)

Audit réalisé via 4 agents en parallèle couvrant screens, services/context, schéma SQL, et fichiers inutilisés.
Les 8 bugs critiques identifiés ont été corrigés dans le commit `be05fe1`.
Cette liste recense les problèmes restants classés par priorité.

---

## Haute priorité

### 1. RLS `league_standings` : policy SELECT trop permissive
**Fichier :** `supabase/schema.sql` — ligne 109
**Impact :** Sécurité — tout utilisateur authentifié peut lire le nom, XP et tier de TOUS les utilisateurs.
**Cause :** `USING (true)` sans restriction.
**Fix :**
```sql
-- Remplacer la policy "lecture groupe" par :
CREATE POLICY "lecture groupe"
  ON public.league_standings FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.league_standings
      WHERE user_id = auth.uid()
        AND week_start = league_standings.week_start
    )
  );
```

### 2. RLS `league_standings` : INSERT non protégé contre l'usurpation
**Fichier :** `supabase/schema.sql` — ligne 113
**Impact :** Sécurité — un client peut insérer une ligne avec un `user_id` arbitraire.
**Cause :** `FOR ALL` avec seulement `USING` (sans `WITH CHECK`). Pour INSERT, Postgres évalue `WITH CHECK`, pas `USING`.
**Fix :**
```sql
-- Remplacer la policy "écriture propre" par deux policies distinctes :
CREATE POLICY "insertion propre"
  ON public.league_standings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mise a jour propre"
  ON public.league_standings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 3. `resolveWeekEnd` : le nouveau tier calculé n'est jamais persisté
**Fichier :** `screens/LeaguesScreen.tsx` — lignes 71-72
**Impact :** Après une promotion/rétrogradation, le badge de ligue et `progress.leagueTier` affichent toujours l'ancien tier. À chaque ouverture de l'onglet Ligues, `resolveWeekEnd` recalcule depuis la mauvaise base.
**Cause :** `effectiveTier` est utilisé pour rejoindre le bon groupe, mais n'est jamais écrit dans `user_progress`.
**Fix :** Appeler `overrideProgress({ leagueTier: newTier })` quand `newTier !== null && newTier !== leagueTier`.

---

## Priorité moyenne

### 4. `increment_league_xp` : silencieux si la ligne n'existe pas encore
**Fichier :** `supabase/schema.sql` — ligne 121
**Impact :** Si `addXP` est appelé avant que `getOrJoinGroup` ait créé la ligne (race condition à la première leçon), l'XP est perdu sans erreur.
**Cause :** La fonction SQL est un `UPDATE` pur, sans fallback INSERT.
**Fix :** Convertir en `INSERT ... ON CONFLICT DO UPDATE` ou vérifier `FOUND` et lever une exception.

### 5. Timezones UTC : le streak peut se réinitialiser à tort pour les utilisateurs UTC+
**Fichiers :** `contexts/UserProgressContext.tsx` lignes 58-65, `utils/progressUtils.ts` lignes 7-16
**Impact :** Un utilisateur en UTC+2 faisant une leçon à 23h30 locales peut voir son streak réinitialisé le lendemain matin.
**Cause :** `today()` et `yesterday()` utilisent `.toISOString()` (UTC) alors que les dates en DB sont en heure locale.
**Fix :** Remplacer par une fonction locale :
```ts
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
```

### 6. `resolveWeekEnd` : rétrogradation de tous les membres dans les groupes ≤ 3
**Fichier :** `services/LeaguesService.ts` — ligne 166
**Impact :** Dans un groupe de 3, le rang 1 est promu ET les rangs 2 et 3 sont rétrogradés — personne n'est en "zone sûre".
**Cause :** `rank > total - 3` avec `total = 3` → `rank > 0` → tous les rangs satisfont la condition.
**Fix :** Ajouter un garde `if (total >= 5 && rank > total - 3)`.

### 7. Index manquant sur `league_standings (tier, week_start)`
**Fichier :** `supabase/schema.sql`
**Impact :** `join_or_create_league_group` fait un scan complet de `league_standings` à chaque assignation de groupe.
**Fix :**
```sql
CREATE INDEX IF NOT EXISTS idx_league_tier_week
  ON public.league_standings (tier, week_start);
```

### 8. Duplication : modal chatbot (~270 lignes) copié-collé dans 2 écrans
**Fichiers :** `screens/LessonScreen.tsx` lignes 56-283 et 749-1018, `screens/LearningPathScreen.tsx` lignes 46-293 et 804-1081
**Impact :** Tout bug ou évolution du chatbot doit être corrigé dans les deux fichiers.
**Fix :** Extraire un composant `<ChatbotModal>` avec une prop optionnelle `context?: { capsuleId, blockId, blockText }`.

---

## Basse priorité

### 9. Trophées : progression toujours `'0/5'` (donnée factice)
**Fichier :** `screens/TrophiesScreen.tsx` — lignes 91-164
**Impact :** Cosmétique — les barres de progression des trophées n'évoluent jamais.
**Cause :** Valeurs hardcodées, non connectées à `progress.perfectLessons`, `progress.streak`, etc.

### 10. Duplication : modals streak/énergie/diamonds/boost dans 4 écrans
**Fichiers :** `screens/LearningPathScreen.tsx`, `screens/LeaguesScreen.tsx`, `screens/TrophiesScreen.tsx`, `screens/NewsletterScreen.tsx`
**Impact :** Maintenance — tout changement de design doit être répercuté 4 fois.
**Fix :** Remonter les modals dans `components/Header.tsx` ou créer un composant `<HeaderModals>`.

### 11. `getInitials` : 3 implémentations différentes
**Fichiers :** `components/Header.tsx`, `components/ProfileModal.tsx`, `screens/LeaguesScreen.tsx`
**Fix :** Centraliser dans `utils/stringUtils.ts`.

### 12. `loadCapsuleMetadata` : exportée mais jamais appelée
**Fichier :** `services/CapsuleService.ts` — ligne 87
**Fix :** Supprimer la fonction.

### 13. `console.log` de debug en production
**Fichiers :** `services/CapsuleParser.ts` (9 appels dont un bloc "Debug:" explicite), `services/ChatbotService.ts` (5 appels loggant l'URL et les payloads), `screens/LessonScreen.tsx`, `screens/LearningPathScreen.tsx`
**Fix :** Supprimer ou conditionner à `process.env.NODE_ENV === 'development'`.
