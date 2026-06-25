-- =============================================================================
-- Frenz — schéma Supabase pour la qualification IA (Skills)
-- À exécuter dans le SQL editor de Supabase.
--
-- Modèle : Frenz s'authentifie via Privy (pas Supabase Auth). Les écritures/
-- lectures passent par le serveur avec la clé service_role (qui bypass RLS).
-- On active quand même RLS pour bloquer tout accès direct anon/authenticated.
-- L'ownership est porté par owner_id = DID Privy (did:privy:...).
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.skills_records (
  id          uuid primary key default gen_random_uuid(),
  owner_id    text not null,                 -- DID Privy (did:privy:...)
  task        text not null check (task in (
                'analyze_besoin','match_cv','rank_candidates','generate_brief'
              )),
  input       jsonb not null default '{}'::jsonb,
  output      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists skills_records_owner_idx
  on public.skills_records (owner_id, created_at desc);

create index if not exists skills_records_task_idx
  on public.skills_records (task);

-- Recherche plein-texte (FTS) sur le contenu de sortie, cohérent avec ta stack.
alter table public.skills_records
  add column if not exists search tsvector
  generated always as (to_tsvector('french', coalesce(output::text, ''))) stored;

create index if not exists skills_records_search_idx
  on public.skills_records using gin (search);

-- RLS : activée, aucune policy pour anon/authenticated => accès direct refusé.
-- Le serveur (service_role) bypass RLS et filtre par owner_id dans le code.
alter table public.skills_records enable row level security;

-- (Optionnel) Si un jour Frenz utilise un JWT Supabase portant le DID Privy
-- dans le claim "sub", décommentez pour autoriser la lecture côté client :
-- create policy "owner can read" on public.skills_records
--   for select using (owner_id = auth.jwt() ->> 'sub');

-- Exemple de requête FTS côté serveur (service_role) :
--   select id, task, output, created_at
--   from public.skills_records
--   where owner_id = $1
--     and search @@ websearch_to_tsquery('french', $2)
--   order by created_at desc
--   limit 20;
