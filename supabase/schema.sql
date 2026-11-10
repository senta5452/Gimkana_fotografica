-- =====================================================================
-- Gimcana Fotogràfica · Estructura de la base de dades (REFERÈNCIA)
-- =====================================================================
--
-- AQUEST FITXER ÉS DOCUMENTACIÓ. NO L'EXECUTIS sobre la base de dades
-- que ja funciona: les taules ja existeixen i hi ha dades.
--
-- Serveix per saber com és la base de dades i per poder-la tornar a crear
-- en un projecte de Supabase nou i buit.
--
-- D'on surt cada part:
--   * challenge_library, messages i les columnes bonus_seconds: és el SQL
--     exacte que es va executar.
--   * games, teams, challenges, submissions i team_sessions: es van crear
--     abans i aquí estan RECONSTRUÏDES a partir de la descripció del
--     document de context (docs/). Els noms de les columnes i les regles
--     coincideixen, però alguns detalls (noms de restriccions, índexs,
--     columnes extra de team_sessions, noms de les polítiques de games)
--     poden ser diferents dels reals.
--
-- Qui hi accedeix:
--   * El navegador del monitor llegeix i edita directament `games` i
--     `challenge_library` (amb RLS: cada monitor només veu les seves).
--   * Tota la resta només la toquen les Edge Functions amb la clau secreta.
--     Aquestes taules tenen RLS activat i cap política.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Partides (reconstruïda)
-- ---------------------------------------------------------------------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  status text not null default 'setup'
    check (status in ('setup', 'active', 'paused', 'finished')),
  duration_seconds int not null default 1200 check (duration_seconds > 0),
  game_code text not null unique check (game_code = upper(game_code)),
  started_at timestamptz,
  finished_at timestamptz,
  -- Rellotge: segons ja comptats + moment en què s'ha tornat a engegar
  clock_started_at timestamptz,
  elapsed_seconds double precision not null default 0,
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

-- El monitor llegeix, crea, edita i esborra només les seves partides
create policy "Monitor llegeix les seves partides"
  on public.games for select to authenticated
  using (judge_id = (select auth.uid()));

create policy "Monitor crea partides pròpies"
  on public.games for insert to authenticated
  with check (judge_id = (select auth.uid()));

create policy "Monitor edita les seves partides"
  on public.games for update to authenticated
  using (judge_id = (select auth.uid()))
  with check (judge_id = (select auth.uid()));

create policy "Monitor esborra les seves partides"
  on public.games for delete to authenticated
  using (judge_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- Equips: sempre dos per partida, A i B (reconstruïda)
-- ---------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  team_key text not null check (team_key in ('A', 'B')),
  name text not null,
  -- PIN de 8 xifres com a hash PBKDF2 ("sal:hash"), vegeu _shared/pin.ts
  access_code_hash text,
  finished_at timestamptz,
  finish_reason text check (finish_reason in ('completed', 'timeout')),
  finish_elapsed_seconds double precision,
  created_at timestamptz not null default now(),
  unique (game_id, team_key)
);

alter table public.teams enable row level security;


-- ---------------------------------------------------------------------
-- Reptes de cada equip: còpia dels de la biblioteca en crear la partida
-- (reconstruïda; bonus_seconds exacte)
-- ---------------------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null,
  description text,
  position int not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.challenges enable row level security;

-- Temps de cada repte dins d'una partida (els reptes existents queden amb 3 min)
alter table public.challenges
  add column bonus_seconds int not null default 180
    check (bonus_seconds between 0 and 3600);


-- ---------------------------------------------------------------------
-- Fotos enviades pels equips (reconstruïda)
-- ---------------------------------------------------------------------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  submitted_by_team uuid not null references public.teams (id) on delete cascade,
  -- Ruta al bucket: <game_id>/<team_id>/<fitxer>
  photo_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  judge_comment text,
  received_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.submissions enable row level security;


-- ---------------------------------------------------------------------
-- Sessions dels equips: hash SHA-256 del token que dona join-game
-- (reconstruïda; la taula real pot tenir alguna columna més)
-- ---------------------------------------------------------------------
create table public.team_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.team_sessions enable row level security;


-- ---------------------------------------------------------------------
-- Biblioteca de reptes de cada monitor (SQL exacte)
-- ---------------------------------------------------------------------
create table public.challenge_library (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  title text not null
    check (char_length(btrim(title)) between 1 and 120),
  description text
    check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now()
);

create index challenge_library_judge_id_idx
  on public.challenge_library (judge_id);

alter table public.challenge_library enable row level security;

-- Cada monitor només pot veure i tocar els seus reptes
create policy "Monitor llegeix els seus reptes"
  on public.challenge_library for select to authenticated
  using (judge_id = (select auth.uid()));

create policy "Monitor crea reptes propis"
  on public.challenge_library for insert to authenticated
  with check (judge_id = (select auth.uid()));

create policy "Monitor edita els seus reptes"
  on public.challenge_library for update to authenticated
  using (judge_id = (select auth.uid()))
  with check (judge_id = (select auth.uid()));

create policy "Monitor esborra els seus reptes"
  on public.challenge_library for delete to authenticated
  using (judge_id = (select auth.uid()));

grant select, insert, update, delete
  on public.challenge_library to authenticated;

-- Temps propi del repte; buit = el temps per defecte de la partida
alter table public.challenge_library
  add column bonus_seconds int
    check (bonus_seconds is null or bonus_seconds between 0 and 3600);


-- ---------------------------------------------------------------------
-- Missatges entre el monitor i els equips (SQL exacte)
-- ---------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade, -- buit = a tots
  sender text not null check (sender in ('monitor', 'team')),
  body text not null check (char_length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now(),
  check (sender = 'monitor' or team_id is not null)
);

create index messages_game_id_created_at_idx
  on public.messages (game_id, created_at);

-- Sense polítiques: només hi accedeixen les Edge Functions
alter table public.messages enable row level security;


-- ---------------------------------------------------------------------
-- Emmagatzematge de fotos
-- ---------------------------------------------------------------------
-- Bucket `submission-photos`, creat des del panell de Supabase (Storage):
--   * privat (les fotos es veuen amb enllaços temporals d'1 hora)
--   * mida màxima 10 MB
--   * tipus permesos: image/jpeg, image/png, image/webp
