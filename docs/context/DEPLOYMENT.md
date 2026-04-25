# TheBudge — Checklist de déploiement

Étapes à compléter avant et après chaque mise en production sur Vercel.

---

## Variables d'environnement Vercel

À ajouter dans **Vercel > Project > Settings > Environment Variables** avant tout déploiement :

| Variable | Valeur | Source |
|---|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase | Supabase > Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable Key | Supabase > Settings > API > Publishable Key |
| `VITE_GEMINI_API_KEY` | Clé API Gemini | Google AI Studio |
| `VITE_CLOUD_RUN_URL` | URL du backend Cloud Run | GCP Console |

> Ces variables doivent être configurées pour les environnements **Production** et **Preview**.

---

## Avant de merger sur main

- [ ] `npm run build` passe sans erreur ni warning TypeScript
- [ ] Tester les flows critiques en local : compléter une leçon, recharger la page, vérifier la persistance
- [ ] Vérifier que `.env.local` n'est pas commité (`git status`)
- [ ] Pas de clés API en dur dans le code source

---

## Premier déploiement Supabase en prod

- [ ] Ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans Vercel
- [ ] Vérifier que le projet Supabase utilisé est bien le projet **production** (pas le projet de dev local)
- [ ] Vérifier les RLS policies actives sur `user_progress` : Dashboard > Authentication > Policies
- [ ] Activer les protections anti-abus si trafic attendu : captcha sur les connexions Google (Dashboard > Auth > Settings)

---

## Par sprint — variables et tables à ajouter

| Sprint | Nouvelles tables Supabase | Nouvelles variables Vercel |
|---|---|---|
| Sprint 1 ✅ | `user_progress` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Sprint 1b (OAuth) | — | Callback URL Google à configurer dans Supabase |
| Sprint 2a (Ligues) | `league_standings` | — |
| Sprint 2b (Trophées) | — | — |
| Sprint 3 (Préférences) | `user_preferences` | — |

---

## Supabase — opérations manuelles à chaque sprint

Chaque nouvelle table nécessite :
1. Exécuter le SQL de création dans **Supabase > SQL Editor**
2. Vérifier les RLS policies dans **Supabase > Authentication > Policies**
3. Tester en local avant de déployer

---

## Configuration Google OAuth (Supabase)

1. Supabase Dashboard → Authentication → Providers → Google → Activer
2. Renseigner Client ID et Client Secret (depuis Google Cloud Console > APIs & Services > Credentials)
3. Authorized redirect URI : `https://<project-ref>.supabase.co/auth/v1/callback`
4. Dans Google Cloud Console : ajouter l'URI Supabase **et** l'URL Vercel en prod dans "Authorized redirect URIs"

---

## Mise à jour du backend Cloud Run

Le backend est dans `backend/main.py`. Pour déployer :

```bash
# Depuis la racine du repo
gcloud run deploy thebudge-coach \
  --source backend/ \
  --region europe-west9 \
  --allow-unauthenticated
```

Le backend fonctionne sans RAG si `DATASTORE_PATH` n'est pas configuré (fallback automatique).
