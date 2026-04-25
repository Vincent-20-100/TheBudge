/**
 * Accès aux données de la table `user_progress` dans Supabase.
 * Service sans état, indépendant de React — reçoit un userId et retourne/écrit des données.
 *
 * Séparé du contexte React pour rester testable et réutilisable indépendamment de l'UI.
 */

import { supabase } from './supabaseClient';
import { UserProgress } from '../types';

/** Shape de la ligne SQL — colonnes snake_case de la table `user_progress`. */
interface ProgressRow {
  user_id: string;
  streak: number;
  diamonds: number;
  energy: number;
  max_energy: number;
  completed_capsules: number[];
  current_capsule: number;
  claimed_chests: number[];
  league_tier: number;
  xp_total: number;
  last_lesson_date: string | null;
  energy_last_updated: string;
  max_streak: number;
  perfect_lessons: number;
  max_daily_xp: number;
  max_league_tier: number;
  daily_xp: number;
  daily_xp_date: string | null;
}

/** Convertit une ligne SQL (snake_case) vers l'interface TypeScript (camelCase). */
function rowToProgress(row: ProgressRow): UserProgress {
  const leagueTier = row.league_tier ?? 1;
  const maxLeagueTier = Math.max(row.max_league_tier ?? 1, leagueTier);
  return {
    streak: row.streak,
    diamonds: row.diamonds,
    energy: row.energy,
    maxEnergy: row.max_energy,
    completedCapsules: row.completed_capsules ?? [],
    currentCapsule: row.current_capsule,
    claimedChests: row.claimed_chests ?? [],
    leagueTier,
    xpTotal: row.xp_total ?? 0,
    lastLessonDate: row.last_lesson_date ?? null,
    energyLastUpdated: row.energy_last_updated ?? new Date().toISOString(),
    maxStreak: Math.max(row.max_streak ?? 0, row.streak ?? 0),
    perfectLessons: row.perfect_lessons ?? 0,
    maxDailyXp: row.max_daily_xp ?? 0,
    maxLeagueTier,
    dailyXp: row.daily_xp ?? 0,
    dailyXpDate: row.daily_xp_date ?? null,
  };
}

/**
 * Calcule l'énergie regagnée hors connexion depuis la dernière écriture.
 * +1 énergie toutes les 30 minutes, plafonnée à maxEnergy.
 */
export function applyEnergyRecharge(progress: UserProgress): UserProgress {
  const elapsedMinutes =
    (Date.now() - new Date(progress.energyLastUpdated).getTime()) / 60000;
  const gained = Math.floor(elapsedMinutes / 30);
  if (gained <= 0) return progress;
  const newEnergy = Math.min(progress.energy + gained, progress.maxEnergy);
  return { ...progress, energy: newEnergy, energyLastUpdated: new Date().toISOString() };
}

/**
 * Charge la progression d'un utilisateur depuis Supabase.
 * Retourne null si aucune ligne n'existe (nouvel utilisateur).
 * Retourne 'error' pour toute erreur autre que PGRST116.
 */
export async function fetchProgress(userId: string): Promise<UserProgress | null | 'error'> {
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Pas de ligne — nouvel utilisateur
    console.error('[UserProgressService] fetchProgress:', error.message);
    return 'error';
  }

  return rowToProgress(data as ProgressRow);
}

/**
 * Insère ou met à jour la ligne `user_progress` pour un utilisateur (upsert atomique).
 * Les erreurs sont loggées sans throw — un échec de sync ne bloque pas l'UI.
 */
export async function upsertProgress(userId: string, progress: UserProgress): Promise<void> {
  const { error } = await supabase
    .from('user_progress')
    .upsert(
      {
        user_id: userId,
        streak: progress.streak,
        diamonds: progress.diamonds,
        energy: progress.energy,
        max_energy: progress.maxEnergy,
        completed_capsules: progress.completedCapsules,
        current_capsule: progress.currentCapsule,
        claimed_chests: progress.claimedChests,
        league_tier: progress.leagueTier,
        xp_total: progress.xpTotal,
        last_lesson_date: progress.lastLessonDate,
        energy_last_updated: progress.energyLastUpdated,
        max_streak: progress.maxStreak,
        perfect_lessons: progress.perfectLessons,
        max_daily_xp: progress.maxDailyXp,
        max_league_tier: Math.max(progress.maxLeagueTier, progress.leagueTier),
        daily_xp: progress.dailyXp,
        daily_xp_date: progress.dailyXpDate,
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('[UserProgressService] upsertProgress:', error.message);
  }
}
