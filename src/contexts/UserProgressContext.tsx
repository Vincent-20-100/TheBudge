/**
 * Contexte React global pour la progression utilisateur.
 *
 * Authentification : Google OAuth obligatoire. L'accès à l'app nécessite un compte Google lié.
 *
 * Cycle de vie au montage :
 *   1. Écoute les changements d'authentification (onAuthStateChange)
 *   2. Vérifie si une session existe déjà
 *   3. Si l'utilisateur a une identité Google, charge sa progression
 *   4. Applique la recharge d'énergie hors connexion
 *   5. Réinitialise le streak si aucune leçon hier ou avant
 *   6. Crée la ligne avec les valeurs par défaut si l'utilisateur est nouveau
 *
 * Mise à jour optimiste : les actions mettent à jour le state React immédiatement,
 * puis déclenchent upsertProgress() en arrière-plan sans bloquer la navigation.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { supabase } from '../services/supabaseClient';
import { UserProgress } from '../types';
import { fetchProgress, upsertProgress, applyEnergyRecharge } from '../services/UserProgressService';
import { getCurrentWeekStart, addXP, getOrJoinGroup } from '../services/LeaguesService';

/** Valeurs initiales affichées avant le chargement depuis Supabase. */
const DEFAULT_PROGRESS: UserProgress = {
  streak: 0,
  diamonds: 0,
  energy: 50,
  maxEnergy: 50,
  completedCapsules: [],
  currentCapsule: 1,
  claimedChests: [],
  leagueTier: 1,
  xpTotal: 0,
  lastLessonDate: null,
  energyLastUpdated: new Date().toISOString(),
  maxStreak: 0,
  perfectLessons: 0,
  maxDailyXp: 0,
  maxLeagueTier: 1,
  dailyXp: 0,
  dailyXpDate: null,
};

/** XP gagné par leçon complétée. */
const XP_PER_LESSON = 50;
/** Énergie consommée par leçon. */
const ENERGY_PER_LESSON = 20;

/** Retourne la date du jour au format YYYY-MM-DD (heure locale). */
function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Retourne la date d'hier au format YYYY-MM-DD. */
function yesterday(): string {
  return new Date(Date.now() - 86400000).toISOString().split('T')[0];
}

interface UserProgressContextType {
  progress: UserProgress;
  isLoading: boolean;
  isAuthenticated: boolean;
  /**
   * Marque une capsule comme complétée, avance currentCapsule, déduit l'énergie,
   * crédite l'XP et met à jour le streak. Idempotent si déjà complétée.
   * Si le streak vient d'augmenter (1ère leçon du jour), onStreakIncremented est appelé.
   */
  completeLesson: (capsuleId: number, onStreakIncremented?: () => void) => void;
  /** Ajoute un montant de diamonds et persiste en DB. */
  addDiamonds: (amount: number) => void;
  /**
   * Marque un coffre comme réclamé, crédite les diamonds et avance currentCapsule.
   * Idempotent si déjà réclamé.
   */
  claimChest: (chestIndex: number, capsuleId: number, diamondAmount: number) => void;
  /** Force une nouvelle vérification de l'authentification (après retour OAuth). */
  refreshAuth: () => Promise<void>;
  displayName: string;
  userEmail: string;
  resetProgress: () => void;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  /** Écrase les champs choisis — usage dev/démo uniquement. */
  overrideProgress: (partial: Partial<UserProgress>) => void;
  /** XP gagné par leçon complétée (affichage modal fin de leçon). */
  xpPerLesson: number;
  /** Énergie consommée par leçon (affichage modal fin de leçon). */
  energyPerLesson: number;
}

const UserProgressContext = createContext<UserProgressContextType | undefined>(undefined);

export const UserProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<UserProgress>(DEFAULT_PROGRESS);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  const handleSession = useCallback(async (session: any) => {
    try {
      if (session?.user) {
        const hasLinkedIdentity = session.user.identities && session.user.identities.length > 0;
        setIsAuthenticated(hasLinkedIdentity);
        setUserId(session.user.id);
        const name = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? '';
        setDisplayName(name);
        setUserEmail(session.user.email ?? '');

        if (hasLinkedIdentity) {
          const UNAVAILABLE = 'unavailable' as const;
          const remote = await Promise.race([
            fetchProgress(session.user.id),
            new Promise<typeof UNAVAILABLE>(resolve => setTimeout(() => resolve(UNAVAILABLE), 6000)),
          ]);

          if (remote === UNAVAILABLE || remote === 'error') {
            // Supabase inaccessible — garde DEFAULT_PROGRESS en mémoire, ne touche pas à la DB
          } else if (remote) {
            // Applique la recharge d'énergie hors connexion
            let loaded = applyEnergyRecharge(remote);

            // Réinitialise le streak si aucune leçon depuis plus d'un jour
            if (loaded.streak > 0 && loaded.lastLessonDate && loaded.lastLessonDate < yesterday()) {
              loaded = { ...loaded, streak: 0 };
              upsertProgress(session.user.id, loaded);
            }

            setProgress(loaded);
          } else {
            // null = nouvel utilisateur (PGRST116) — créer la ligne
            upsertProgress(session.user.id, DEFAULT_PROGRESS);
          }
        }
      } else {
        setIsAuthenticated(false);
        setUserId(null);
        setDisplayName('');
        setUserEmail('');
      }
    } catch (err) {
      console.error('handleSession error:', err);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        initialized = true;
        await handleSession(session);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setUserId(null);
        setProgress(DEFAULT_PROGRESS);
        setIsLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!initialized && !cancelled) {
        initialized = true;
        handleSession(session);
      }
    }).catch((err) => {
      console.error('Erreur getSession:', err);
      if (!initialized) {
        initialized = true;
        setIsLoading(false);
      }
    });

    const timeout = setTimeout(() => {
      if (!initialized && !cancelled) {
        initialized = true;
        setIsLoading(false);
        setIsAuthenticated(false);
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      authListener?.subscription.unsubscribe();
    };
  }, [handleSession]);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    await handleSession(session);
  }, [handleSession]);

  const completeLesson = useCallback((capsuleId: number, onStreakIncremented?: () => void) => {
    if (!userId) return;

    setProgress(prev => {
      const alreadyCompleted = prev.completedCapsules.includes(capsuleId);

      const nextCompleted = alreadyCompleted
        ? prev.completedCapsules
        : [...prev.completedCapsules, capsuleId];

      const nextCapsule = capsuleId >= prev.currentCapsule
        ? capsuleId + 1
        : prev.currentCapsule;

      // Streak : calcul basé sur la date du jour
      const todayStr = today();
      const yesterdayStr = yesterday();
      let nextStreak: number;
      if (prev.lastLessonDate === todayStr) {
        nextStreak = prev.streak;
      } else if (prev.lastLessonDate === yesterdayStr) {
        nextStreak = prev.streak + 1;
      } else {
        nextStreak = 1;
      }

      const streakIncreased = nextStreak > prev.streak;
      if (streakIncreased && onStreakIncremented) {
        setTimeout(() => onStreakIncremented(), 0);
      }

      // XP journalier
      const earnedXp = alreadyCompleted ? 0 : XP_PER_LESSON;
      const isSameDay = prev.dailyXpDate === todayStr;
      const nextDailyXp = isSameDay ? prev.dailyXp + earnedXp : earnedXp;
      const nextMaxDailyXp = Math.max(nextDailyXp, prev.maxDailyXp);

      const updated: UserProgress = {
        ...prev,
        completedCapsules: nextCompleted,
        currentCapsule: nextCapsule,
        energy: alreadyCompleted ? prev.energy : Math.max(0, prev.energy - ENERGY_PER_LESSON),
        energyLastUpdated: alreadyCompleted ? prev.energyLastUpdated : new Date().toISOString(),
        xpTotal: prev.xpTotal + earnedXp,
        streak: nextStreak,
        lastLessonDate: todayStr,
        maxStreak: Math.max(nextStreak, prev.maxStreak),
        perfectLessons: prev.perfectLessons,
        dailyXp: nextDailyXp,
        dailyXpDate: todayStr,
        maxDailyXp: nextMaxDailyXp,
        maxLeagueTier: Math.max(prev.leagueTier, prev.maxLeagueTier),
      };

      upsertProgress(userId, updated);

      if (!alreadyCompleted) {
        const weekStart = getCurrentWeekStart();
        getOrJoinGroup(userId, updated.leagueTier, weekStart, displayName)
          .then(() => addXP(userId, weekStart, XP_PER_LESSON));
      }

      return updated;
    });
  }, [userId, displayName]);

  const addDiamonds = useCallback((amount: number) => {
    if (!userId) return;
    setProgress(prev => {
      const updated = { ...prev, diamonds: prev.diamonds + amount };
      upsertProgress(userId, updated);
      return updated;
    });
  }, [userId]);

  const resetProgress = useCallback(() => {
    if (!userId) return;
    setProgress(DEFAULT_PROGRESS);
    upsertProgress(userId, DEFAULT_PROGRESS);
  }, [userId]);

  const signOut = useCallback(async () => {
    setIsAuthenticated(false);
    setUserId(null);
    setDisplayName('');
    setUserEmail('');
    setProgress(DEFAULT_PROGRESS);
    await supabase.auth.signOut();
  }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    setDisplayName(name);
    await supabase.auth.updateUser({ data: { full_name: name } });
  }, []);

  const overrideProgress = useCallback((partial: Partial<UserProgress>) => {
    if (!userId) return;
    const todayStr = new Date().toISOString().split('T')[0];
    setProgress(prev => {
      const newStreak = partial.streak ?? prev.streak;
      const newLeagueTier = partial.leagueTier ?? prev.leagueTier;
      const updated: UserProgress = {
        ...prev,
        ...partial,
        energy: Math.min(partial.energy ?? prev.energy, prev.maxEnergy),
        lastLessonDate: partial.streak !== undefined && partial.streak > 0
          ? todayStr
          : (partial.lastLessonDate ?? prev.lastLessonDate),
        maxStreak: Math.max(newStreak, prev.maxStreak),
        maxLeagueTier: Math.max(newLeagueTier, prev.maxLeagueTier),
      };
      upsertProgress(userId, updated);

      const weekStart = getCurrentWeekStart();

      // Sync league_standings.xp_this_week si xpTotal est overridé
      if (partial.xpTotal !== undefined) {
        supabase
          .from('league_standings')
          .update({ xp_this_week: partial.xpTotal })
          .eq('user_id', userId)
          .eq('week_start', weekStart)
          .then();
      }

      // Réassigner au bon groupe si le tier change
      if (partial.leagueTier !== undefined && partial.leagueTier !== prev.leagueTier) {
        supabase
          .from('league_standings')
          .delete()
          .eq('user_id', userId)
          .eq('week_start', weekStart)
          .then(() => getOrJoinGroup(userId, partial.leagueTier!, weekStart, displayName));
      }

      return updated;
    });
  }, [userId, displayName]);

  const claimChest = useCallback((chestIndex: number, capsuleId: number, diamondAmount: number) => {
    if (!userId) return;
    setProgress(prev => {
      if (prev.claimedChests.includes(chestIndex)) return prev;
      const nextCapsule = capsuleId >= prev.currentCapsule ? capsuleId + 1 : prev.currentCapsule;
      const updated = {
        ...prev,
        diamonds: prev.diamonds + diamondAmount,
        claimedChests: [...prev.claimedChests, chestIndex],
        currentCapsule: nextCapsule,
      };
      upsertProgress(userId, updated);
      return updated;
    });
  }, [userId]);

  return (
    <UserProgressContext.Provider
      value={{ progress, isLoading, isAuthenticated, completeLesson, refreshAuth, addDiamonds, claimChest, displayName, userEmail, resetProgress, signOut, updateDisplayName, overrideProgress, xpPerLesson: XP_PER_LESSON, energyPerLesson: ENERGY_PER_LESSON }}
    >
      {children}
    </UserProgressContext.Provider>
  );
};

/**
 * Hook d'accès au contexte UserProgress.
 * À utiliser dans tout screen ou composant enfant de UserProgressProvider.
 */
export const useUserProgress = (): UserProgressContextType => {
  const ctx = useContext(UserProgressContext);
  if (!ctx) throw new Error('useUserProgress doit être utilisé dans un UserProgressProvider');
  return ctx;
};
