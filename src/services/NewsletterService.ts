/**
 * Service d'accès aux données Newsletter dans Supabase.
 * Gère les préférences de sujets (multi-device) et l'historique des recherches.
 */

import { supabase } from './supabaseClient';
import { SelectedTopic } from './NewsAggregatorService';
import { ProcessedArticle } from './NewsAggregatorService';

/** Charge les préférences de sujets depuis Supabase. Retourne null si aucune ligne. */
export async function fetchPreferences(userId: string): Promise<SelectedTopic[] | null> {
  const { data, error } = await supabase
    .from('newsletter_preferences')
    .select('topics')
    .eq('user_id', userId)
    .single();

  if (error) return null;
  return data.topics as SelectedTopic[];
}

/** Sauvegarde les préférences de sujets en Supabase (fire-and-forget). */
export async function upsertPreferences(userId: string, topics: SelectedTopic[]): Promise<void> {
  const { error } = await supabase
    .from('newsletter_preferences')
    .upsert(
      { user_id: userId, topics, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) console.error('[NewsletterService] upsertPreferences:', error.message);
}

/** Enregistre une session de recherche. Retourne l'id de la ligne créée, ou null. */
export async function saveHistory(
  userId: string,
  topics: SelectedTopic[],
  articles: ProcessedArticle[]
): Promise<string | null> {
  const { data, error } = await supabase
    .from('newsletter_history')
    .insert({ user_id: userId, topics, articles })
    .select('id')
    .single();

  if (error) {
    console.error('[NewsletterService] saveHistory:', error.message);
    return null;
  }
  return data.id as string;
}

/** Met à jour le retour satisfaction d'une session (fire-and-forget). */
export async function updateSatisfaction(historyId: string, satisfied: boolean): Promise<void> {
  const { error } = await supabase
    .from('newsletter_history')
    .update({ satisfaction: satisfied })
    .eq('id', historyId);

  if (error) console.error('[NewsletterService] updateSatisfaction:', error.message);
}

export interface NewsletterHistoryEntry {
  id: string;
  topics: SelectedTopic[];
  articles: ProcessedArticle[];
  satisfaction: boolean | null;
  createdAt: string;
}

/** Charge les N dernières sessions de recherche de l'utilisateur. */
export async function fetchHistory(userId: string, limit = 20): Promise<NewsletterHistoryEntry[]> {
  const { data, error } = await supabase
    .from('newsletter_history')
    .select('id, topics, articles, satisfaction, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(row => ({
    id: row.id,
    topics: row.topics as SelectedTopic[],
    articles: row.articles as ProcessedArticle[],
    satisfaction: row.satisfaction,
    createdAt: row.created_at,
  }));
}
