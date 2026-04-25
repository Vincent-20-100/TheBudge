/**
 * Client Supabase singleton pour toute l'application.
 * Ne jamais recréer un client ailleurs — importer `supabase` depuis ce fichier.
 *
 * Requiert dans .env.local :
 *   VITE_SUPABASE_URL      → URL du projet (ex: https://xxx.supabase.co)
 *   VITE_SUPABASE_ANON_KEY → Clé publique anon, sécurisée par les RLS policies côté DB
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const isValidHttpUrl = (value: string | undefined) => /^https?:\/\/.+/i.test(value ?? '');
const hasValidEnv = isValidHttpUrl(supabaseUrl) && Boolean(supabaseAnonKey);

if (!hasValidEnv) {
  console.warn(
    '[Supabase] Variables invalides/missing dans .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) — ' +
    'la progression ne sera pas sauvegardée.'
  );
}

// Fallback client pour éviter le crash UI si .env.local est absent/invalide.
export const supabase = createClient(
  hasValidEnv ? supabaseUrl : 'https://example.supabase.co',
  hasValidEnv ? supabaseAnonKey : 'public-anon-key-placeholder'
);
