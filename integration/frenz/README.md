# Intégrer Skills dans Frenz

Kit d'intégration de l'assistant de qualification IA **Skills** dans **Frenz**
(Next.js 14 · TS · React 18 · Privy · Supabase/Postgres · Stripe · Brevo).

## Fichiers à copier

| Fichier du kit | Destination dans Frenz | Rôle |
|---|---|---|
| `lib/skills-core.ts` | `lib/skills-core.ts` | Moteur métier (prompts, schémas, normalisation, retry). Aucune dépendance UI. |
| `lib/skills-client.ts` | `lib/skills-client.ts` | Client front typé (attache le token Privy). |
| `app/api/qualification/route.ts` | `app/api/qualification/route.ts` | Route App Router : Privy + Anthropic + Supabase. |
| `supabase.sql` | (SQL editor Supabase) | Table `skills_records` + RLS + FTS. |

## Dépendances

```bash
npm i @anthropic-ai/sdk @privy-io/server-auth @supabase/supabase-js
# (Frenz a déjà @privy-io/react-auth côté front)
```

## Variables d'environnement (déjà partiellement présentes dans Frenz)

```bash
ANTHROPIC_API_KEY=sk-ant-...          # clé API Anthropic (crédit requis, facturé à part)
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...         # serveur uniquement
```

> ⚠️ L'API Anthropic se facture **séparément** des abonnements Claude/Claude Code.
> Prévoir du crédit sur console.anthropic.com/settings/billing.

## Câblage front (exemple React 18)

```tsx
"use client";
import { usePrivy } from "@privy-io/react-auth";
import { makeSkillsClient } from "@/lib/skills-client";

export function useSkills() {
  const { getAccessToken } = usePrivy();
  return makeSkillsClient(getAccessToken);
}

// Dans un composant :
const skills = useSkills();
const analyse = await skills.analyzeBesoin(besoin);            // étape 1
const m = await skills.matchCv({ besoin, cvLabel: "A", cvText }); // étape 2 (1 par CV, en parallèle)
const rank = await skills.rankCandidates(besoin, [m1, m2, m3]);   // étape 3
const brief = await skills.generateBrief({ besoin, matching: best, cvText }); // étape 4
```

Les **types** (`BesoinInput`, `CvMatching`, `Ranking`, `BriefOutput`, …) sont
exportés depuis `lib/skills-core.ts` — réutilise-les dans tes composants et tes
tables.

## Flux complet

`analyze_besoin` → `match_cv` (×N, en parallèle) → `rank_candidates` →
`generate_brief`. Le champ **`historiqueOperationnel`** du besoin est le
différenciateur : transmets-le toujours, l'IA s'en sert pour le scoring/ranking.

## Sécurité & données

- **Auth** : la route vérifie le token Privy (Bearer ou cookie `privy-token`) et
  refuse sinon (401). L'`owner_id` stocké = DID Privy.
- **RLS** : activée sur `skills_records` ; aucun accès direct anon/authenticated.
  Les lectures se font côté serveur via `service_role` filtré par `owner_id`.
- **PDF** : les base64 ne sont **pas** persistés (retirés avant insert).
- **FTS** : colonne `search` (français) + index GIN — voir l'exemple de requête
  `websearch_to_tsquery` dans `supabase.sql`. Cohérent avec ton agrégation
  d'offres.

## Extensions naturelles dans Frenz

- **Stripe** : gate la route par abonnement (helper `assertActiveSubscription`
  commenté dans `route.ts`) → renvoie 402 si pas d'abonnement actif.
- **Brevo** : envoie le Brief Client / Pitch par email depuis une route serveur
  après `generate_brief` (transac Brevo) — le contenu est déjà du texte prêt.
- **Vercel Cron** : tu peux re-qualifier automatiquement des besoins issus de ton
  agrégation d'offres (cron → `analyze_besoin` en batch → stockage `skills_records`).
- **Design system bilingue** : le moteur renvoie du **français** ; si tu veux de
  l'EN, ajoute une variante de `SYSTEM`/prompts EN dans `skills-core.ts` et passe
  la langue dans le `payload`.

## Notes de version

- Route en **App Router** (Next 14). Si une partie de Frenz est en Pages Router,
  appelle plutôt `runSkill` depuis un handler `pages/api/qualification.ts`
  (même logique, `req/res` au lieu de `NextRequest/NextResponse`).
- `@privy-io/server-auth` : `verifyAuthToken` selon ta version — vérifie la
  signature exacte si tu es sur une version différente.
- `output_config` (sorties structurées) est envoyé au endpoint Messages ; le
  parsing tolérant + la normalisation couvrent le cas où le modèle dévie.
