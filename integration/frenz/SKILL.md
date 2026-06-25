---
name: qualification-recrutement-frenz
description: >-
  Assistant IA de qualification de recrutement (Skills®) intégré à Frenz.
  À utiliser pour : qualifier un besoin client tech, scorer/matcher une shortlist
  de CV, classer des candidats, générer un brief client + un pitch mission.
  Déclencheurs : "qualifie ce besoin", "matche ces CV", "lequel appeler en
  priorité", "fais le brief / le pitch". Tient compte de l'historique
  opérationnel (biais humains du client) pour ajuster scoring et alertes.
  Stack cible : Next.js 14 · TS · React 18 · Privy · Supabase/Postgres · Stripe ·
  Brevo · Vercel Cron · design system bilingue.
---

# Skills® dans Frenz — qualification de recrutement IA

Module qui transforme un **besoin client** + une **shortlist de CV** en décisions
de priorisation, puis en livrables (brief client, pitch candidat). Moteur =
`lib/skills-core.ts` (prompts, schémas, normalisation). Cette fiche décrit **quoi**
le module fait et **comment** il se branche dans Frenz.

## Architecture dans Frenz

```
Front (React 18)                Serveur (App Router)             IA / Données
─────────────────               ────────────────────             ────────────
useSkills() ──► skills-client ──► POST /api/qualification ──► runSkill() ──► Anthropic
(token Privy)                     │  vérifie token Privy        (skills-core)   (Messages API,
                                  │  ANTHROPIC_API_KEY (serveur)                 output_config)
                                  └► Supabase (service_role) ──► skills_records (RLS + FTS)
```

## Fichiers du kit (à copier dans Frenz)

| Fichier | Destination | Rôle |
|---|---|---|
| `lib/skills-core.ts` | `lib/skills-core.ts` | Moteur métier portable (`runSkill`, types, prompts, schémas, normalisation, retry). |
| `lib/skills-client.ts` | `lib/skills-client.ts` | Client front typé (attache le token Privy). |
| `app/api/qualification/route.ts` | `app/api/qualification/route.ts` | Route gardée Privy → Anthropic → Supabase. |
| `supabase.sql` | SQL editor Supabase | Table `skills_records` + RLS + FTS français. |

## Dépendances & env

```bash
npm i @anthropic-ai/sdk @privy-io/server-auth @supabase/supabase-js
```
```bash
ANTHROPIC_API_KEY=sk-ant-...     # crédit requis, facturé SÉPARÉMENT des abos Claude
PRIVY_APP_ID=...   PRIVY_APP_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=...   SUPABASE_SERVICE_ROLE_KEY=...   # serveur uniquement
```

## Les 4 opérations (task)

Modèle `claude-opus-4-8`, sorties structurées (`output_config.format`),
`max_tokens` 4096. Entrées CV/fiche acceptées en **texte ou PDF base64**
(bloc `document`). Toutes les chaînes de prompt/schéma exactes sont dans
`lib/skills-core.ts`.

| `task` | Entrées | Sortie (clés) |
|---|---|---|
| `analyze_besoin` | `besoin` (+ `fichePdfBase64?`) | `resume[]`, `competencesIndispensables[]`, `competencesSecondaires[]`, `pointsVigilance[]`, `typeProfil` |
| `match_cv` | `besoin`, `cvLabel`, `cvText?`/`cvPdfBase64?` | `candidat`, `score` (Fort/Moyen/Faible), `scoreSur100`, `recommandation`, `synthese`, `pointsForts[3]`, `pointsVigilance[3]`, `questionsCles[]`, `competencesCouvertes[]`, `competencesManquantes[]`, `anneesExperience`, `disponibilite`, `tjmEstime` |
| `rank_candidates` | `besoin`, `matchings[]` | `classement[]` (candidat, rang, label, forces, blocages, action), `synthese` |
| `generate_brief` | `besoin`, `matching`, `cvText?`/`cvPdfBase64?` | `briefClient{prenom, accroche, resumeExperiences, pointsForts[], pointsVigilance[], anneesExperience, competencesCles[], disponibilite, tjm}`, `pitchMission` |
| `ping` | — | `{ ok: true }` (test de clé/connexion) |

**Flux complet** : `analyze_besoin` → `match_cv` (×N, en parallèle) →
`rank_candidates` → `generate_brief`.

> 🔑 **Règle d'or** : transmets toujours `besoin.historiqueOperationnel` (biais /
> préférences humaines du client). C'est le différenciateur : l'IA s'en sert pour
> le scoring, le ranking et les alertes, et doit le citer quand il fait pencher la
> balance.

## Câblage front (React 18 + Privy)

```tsx
"use client";
import { usePrivy } from "@privy-io/react-auth";
import { makeSkillsClient } from "@/lib/skills-client";

export function useSkills() {
  const { getAccessToken } = usePrivy();
  return makeSkillsClient(getAccessToken);
}

// usage
const skills = useSkills();
const analyse = await skills.analyzeBesoin(besoin);
const m = await skills.matchCv({ besoin, cvLabel: "A", cvText });
const rank = await skills.rankCandidates(besoin, [m1, m2, m3]);
const brief = await skills.generateBrief({ besoin, matching: best, cvText });
```

Types (`BesoinInput`, `CvMatching`, `Ranking`, `BriefOutput`…) exportés depuis
`lib/skills-core.ts` — à réutiliser dans tes composants et tables.

## Sécurité & données (Supabase)

- **Auth Privy** : la route vérifie le Bearer / cookie `privy-token`
  (`verifyAuthToken`) ; 401 sinon. `owner_id` = DID Privy.
- **RLS activée** sur `skills_records` ; accès direct anon/authenticated refusé.
  Lectures côté serveur en `service_role` filtrées par `owner_id`.
- **PDF non persistés** (base64 retirés avant insert).
- **FTS** : colonne `tsvector` français + index GIN (requête
  `websearch_to_tsquery` — voir `supabase.sql`).

## Extensions Frenz

- **Stripe** : gate la route par abonnement (`assertActiveSubscription` commenté
  dans `route.ts`) → 402 si inactif.
- **Brevo** : après `generate_brief`, envoie le brief/pitch (déjà du texte prêt)
  par email transactionnel depuis une route serveur.
- **Vercel Cron** : re-qualifie en batch les besoins issus de ton agrégation
  d'offres (`analyze_besoin` → stockage `skills_records`).
- **Bilingue** : le moteur renvoie du français ; pour l'EN, duplique `SYSTEM` et
  les prompts dans `skills-core.ts` et passe la langue dans le `payload`.

## À valider selon ta version

- `@privy-io/server-auth` : signature de `verifyAuthToken` (peu de variations,
  mais vérifie).
- Pages Router : si besoin, appelle `runSkill` depuis `pages/api/qualification.ts`
  (même logique, `req/res`).
- L'API Anthropic se facture séparément des abonnements Claude/Claude Code —
  prévoir du crédit (console.anthropic.com/settings/billing).
