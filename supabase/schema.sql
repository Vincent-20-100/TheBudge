-- =============================================================
-- TheBudge — Schéma complet (script "from scratch")
-- À utiliser uniquement pour créer la DB depuis zéro.
-- Sur une DB existante : utiliser les fichiers migrations/ et fixes/.
-- =============================================================

-- ---------------------------------------------------------------
-- Table : user_progress
-- Une ligne par utilisateur. Upsert via onConflict: 'user_id'.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  streak               INTEGER     NOT NULL DEFAULT 0,
  diamonds             INTEGER     NOT NULL DEFAULT 0,
  energy               INTEGER     NOT NULL DEFAULT 50,
  max_energy           INTEGER     NOT NULL DEFAULT 50,
  completed_capsules   INTEGER[]   NOT NULL DEFAULT '{}',
  current_capsule      INTEGER     NOT NULL DEFAULT 1,
  claimed_chests       INTEGER[]   NOT NULL DEFAULT '{}',
  league_tier          INTEGER     NOT NULL DEFAULT 1,
  xp_total             INTEGER     NOT NULL DEFAULT 0,
  last_lesson_date     DATE,
  energy_last_updated  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  max_streak           INTEGER     NOT NULL DEFAULT 0,
  perfect_lessons      INTEGER     NOT NULL DEFAULT 0,
  max_daily_xp         INTEGER     NOT NULL DEFAULT 0,
  max_league_tier      INTEGER     NOT NULL DEFAULT 1,
  daily_xp             INTEGER     NOT NULL DEFAULT 0,
  daily_xp_date        DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mise à jour automatique de updated_at à chaque écriture
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_user_progress_updated_at
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS : chaque utilisateur lit et écrit uniquement sa propre ligne
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture de sa propre progression"
  ON public.user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Création de sa propre progression"
  ON public.user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Mise à jour de sa propre progression"
  ON public.user_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Pas de DELETE policy : suppression gérée par ON DELETE CASCADE sur auth.users


-- ---------------------------------------------------------------
-- Table : league_standings
-- Une ligne par (user_id, week_start). Groupe hebdomadaire de ligue.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.league_standings (
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id     UUID    NOT NULL,
  week_start   DATE    NOT NULL,
  tier         INTEGER NOT NULL DEFAULT 1,
  xp_this_week INTEGER NOT NULL DEFAULT 0,
  display_name TEXT    NOT NULL DEFAULT '',

  PRIMARY KEY (user_id, week_start),
  CONSTRAINT xp_positive CHECK (xp_this_week >= 0)
);

-- Index pour la recherche de groupes par tier/semaine (join_or_create_league_group)
CREATE INDEX IF NOT EXISTS idx_league_group
  ON public.league_standings (group_id, week_start);

CREATE INDEX IF NOT EXISTS idx_league_tier_week
  ON public.league_standings (tier, week_start);

-- RLS : tout utilisateur authentifié peut lire les standings
-- (politique non-récursive — une sous-requête sur la même table crée une récursion infinie)
ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lecture groupe"
  ON public.league_standings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "insertion propre"
  ON public.league_standings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mise a jour propre"
  ON public.league_standings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------
-- RPC : incrément atomique de l'XP de ligue
-- Lève une exception si la ligne n'existe pas (race condition visible).
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_league_xp(
  p_user_id    UUID,
  p_week_start DATE,
  p_amount     INTEGER
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.league_standings
    SET xp_this_week = xp_this_week + p_amount
    WHERE user_id = p_user_id AND week_start = p_week_start;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'league_standings: aucune ligne pour user=% week=%', p_user_id, p_week_start;
  END IF;
END;
$$;


-- ---------------------------------------------------------------
-- RPC : assignation atomique à un groupe de ligue
-- Évite la race condition multi-step JS (tout en une transaction).
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_or_create_league_group(
  p_user_id      UUID,
  p_tier         INTEGER,
  p_week_start   DATE,
  p_display_name TEXT,
  p_max_size     INTEGER DEFAULT 20
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_group_id UUID;
BEGIN
  -- Retourner le groupe existant si l'utilisateur est déjà inscrit cette semaine
  SELECT group_id INTO v_group_id
  FROM public.league_standings
  WHERE user_id = p_user_id AND week_start = p_week_start;

  IF v_group_id IS NOT NULL THEN
    RETURN v_group_id;
  END IF;

  -- Trouver le premier groupe incomplet du même tier/semaine (ordre déterministe)
  SELECT group_id INTO v_group_id
  FROM public.league_standings
  WHERE tier = p_tier AND week_start = p_week_start
  GROUP BY group_id
  HAVING COUNT(*) < p_max_size
  ORDER BY MIN(ctid)
  LIMIT 1;

  -- Aucun groupe disponible : en créer un nouveau
  IF v_group_id IS NULL THEN
    v_group_id := gen_random_uuid();
  END IF;

  -- Insérer la ligne (ON CONFLICT protège contre les doublons concurrents)
  INSERT INTO public.league_standings (user_id, group_id, week_start, tier, xp_this_week, display_name)
  VALUES (p_user_id, v_group_id, p_week_start, p_tier, 0, p_display_name)
  ON CONFLICT (user_id, week_start) DO NOTHING;

  RETURN v_group_id;
END;
$$;


-- ---------------------------------------------------------------
-- Tables : newsletter_preferences et newsletter_history
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_preferences (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  topics     JSONB       NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.newsletter_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "newsletter_prefs_own"
  ON public.newsletter_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.newsletter_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topics       JSONB       NOT NULL DEFAULT '[]',
  articles     JSONB       NOT NULL DEFAULT '[]',
  satisfaction BOOLEAN,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_history_user
  ON public.newsletter_history (user_id, created_at DESC);

ALTER TABLE public.newsletter_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "newsletter_history_own"
  ON public.newsletter_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
