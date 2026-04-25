/**
 * Service d'accès aux données des ligues.
 * Gère les groupes hebdomadaires, le classement, l'XP de ligue et les promotions.
 *
 * Indépendant de React — reçoit des IDs et retourne des données.
 */

import { supabase } from './supabaseClient';

export interface LeagueStanding {
  userId: string;
  groupId: string;
  weekStart: string;
  tier: number;
  xpThisWeek: number;
  displayName: string;
}

/** Retourne le lundi de la semaine courante au format YYYY-MM-DD. */
export function getCurrentWeekStart(): string {
  const now = new Date();
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

function rowToStanding(row: any): LeagueStanding {
  return {
    userId: row.user_id,
    groupId: row.group_id,
    weekStart: row.week_start,
    tier: row.tier,
    xpThisWeek: row.xp_this_week,
    displayName: row.display_name,
  };
}

/**
 * Trouve ou crée une entrée de ligue pour l'utilisateur sur la semaine courante.
 * Délègue à la fonction SQL atomique join_or_create_league_group pour éviter
 * toute race condition entre utilisateurs rejoignant simultanément.
 * Retourne le group_id.
 */
export async function getOrJoinGroup(
  userId: string,
  tier: number,
  weekStart: string,
  displayName: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('join_or_create_league_group', {
    p_user_id: userId,
    p_tier: tier,
    p_week_start: weekStart,
    p_display_name: displayName,
  });

  if (error) {
    console.error('[LeaguesService] getOrJoinGroup:', error.message);
    return null;
  }

  return data as string;
}

/** Charge le classement d'un groupe pour la semaine donnée, trié par XP décroissant. */
export async function fetchLeaderboard(
  groupId: string,
  weekStart: string
): Promise<LeagueStanding[]> {
  const { data, error } = await supabase
    .from('league_standings')
    .select('*')
    .eq('group_id', groupId)
    .eq('week_start', weekStart)
    .order('xp_this_week', { ascending: false });

  if (error || !data) return [];
  return data.map(rowToStanding);
}

/**
 * Incrémente l'XP de ligue de l'utilisateur via une fonction SQL atomique.
 * Fire-and-forget — les erreurs sont loggées sans throw.
 */
export async function addXP(
  userId: string,
  weekStart: string,
  amount: number
): Promise<void> {
  const { error } = await supabase.rpc('increment_league_xp', {
    p_user_id: userId,
    p_week_start: weekStart,
    p_amount: amount,
  });

  if (error) {
    console.error('[LeaguesService] addXP:', error.message);
  }
}

/**
 * Souscrit aux mises à jour Realtime du groupe.
 * Déclenche un refetch complet du classement à chaque changement.
 * Retourne la fonction de désabonnement.
 */
export function subscribeToGroup(
  groupId: string,
  weekStart: string,
  callback: (standings: LeagueStanding[]) => void
): () => void {
  const channel = supabase
    .channel(`league_${groupId}_${weekStart}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'league_standings',
        filter: `group_id=eq.${groupId}`,
      },
      () => {
        fetchLeaderboard(groupId, weekStart).then(callback);
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

/**
 * Calcule la promotion/rétrogradation de l'utilisateur pour la semaine précédente.
 * Retourne le nouveau tier, ou null si aucune semaine passée à résoudre.
 * Top 5 → promu (tier + 1), Bottom 3 → rétrogradé (tier - 1).
 */
export async function resolveWeekEnd(
  userId: string,
  currentWeekStart: string
): Promise<number | null> {
  const { data: pastRow } = await supabase
    .from('league_standings')
    .select('*')
    .eq('user_id', userId)
    .lt('week_start', currentWeekStart)
    .order('week_start', { ascending: false })
    .limit(1)
    .single();

  if (!pastRow) return null;

  const { data: group } = await supabase
    .from('league_standings')
    .select('user_id, xp_this_week')
    .eq('group_id', pastRow.group_id)
    .eq('week_start', pastRow.week_start)
    .order('xp_this_week', { ascending: false });

  if (!group || group.length === 0) return null;

  const rank = group.findIndex(r => r.user_id === userId) + 1;
  const total = group.length;

  let newTier = pastRow.tier;
  if (rank <= 5) newTier = Math.min(10, pastRow.tier + 1);
  else if (rank > total - 3) newTier = Math.max(1, pastRow.tier - 1);

  return newTier;
}

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
