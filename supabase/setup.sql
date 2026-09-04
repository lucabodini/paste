-- Paste - backend gratuito per GitHub Pages
-- Esegui tutto questo file una sola volta nel Supabase SQL Editor.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.paste_config (
  id integer primary key check (id = 1),
  team_code_hash text not null,
  captain_name text not null,
  captain_password_hash text
);

create table if not exists public.paste_state (
  id integer primary key check (id = 1),
  data jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.paste_sessions (
  token_hash text primary key,
  person_name text not null,
  role text not null check (role in ('captain', 'viewer')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.paste_config enable row level security;
alter table public.paste_state enable row level security;
alter table public.paste_sessions enable row level security;

revoke all on public.paste_config from anon, authenticated;
revoke all on public.paste_state from anon, authenticated;
revoke all on public.paste_sessions from anon, authenticated;

-- Configurazione e dati iniziali vengono inseriti con il file privato
-- paste-private-import.sql, che non deve essere pubblicato su GitHub.

create or replace function public.paste_check_team(p_team_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_config public.paste_config%rowtype;
  v_data jsonb;
  v_people jsonb;
begin
  select * into v_config from public.paste_config where id = 1;
  if v_config.team_code_hash is null
     or encode(digest(coalesce(p_team_code, ''), 'sha256'), 'hex') <> v_config.team_code_hash then
    return jsonb_build_object('error', 'Codice squadra non corretto', 'status', 401);
  end if;
  select data into v_data from public.paste_state where id = 1;
  select coalesce(jsonb_agg(person->>0), '[]'::jsonb)
    into v_people
    from jsonb_array_elements(coalesce(v_data->'team', '[]'::jsonb)) person;
  return jsonb_build_object(
    'people', v_people,
    'captainName', v_config.captain_name,
    'captainReady', v_config.captain_password_hash is not null
  );
end;
$$;

create or replace function public.paste_login(
  p_team_code text,
  p_person_name text,
  p_password text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_config public.paste_config%rowtype;
  v_data jsonb;
  v_exists boolean;
  v_role text := 'viewer';
  v_token text;
begin
  select * into v_config from public.paste_config where id = 1 for update;
  if encode(digest(coalesce(p_team_code, ''), 'sha256'), 'hex') <> v_config.team_code_hash then
    return jsonb_build_object('error', 'Dati di accesso non corretti', 'status', 401);
  end if;
  select data into v_data from public.paste_state where id = 1;
  select exists (
    select 1
    from jsonb_array_elements(coalesce(v_data->'team', '[]'::jsonb)) person
    where person->>0 = p_person_name
  ) into v_exists;
  if not v_exists then
    return jsonb_build_object('error', 'Giocatore non presente', 'status', 401);
  end if;
  if p_person_name = v_config.captain_name then
    v_role := 'captain';
    if v_config.captain_password_hash is null then
      if length(coalesce(p_password, '')) < 6 then
        return jsonb_build_object(
          'error', 'La nuova password deve avere almeno 6 caratteri',
          'status', 400
        );
      end if;
      update public.paste_config
        set captain_password_hash = crypt(p_password, gen_salt('bf', 10))
        where id = 1;
    elsif crypt(coalesce(p_password, ''), v_config.captain_password_hash)
          <> v_config.captain_password_hash then
      return jsonb_build_object('error', 'Password capitano non corretta', 'status', 401);
    end if;
  end if;
  delete from public.paste_sessions where expires_at <= now();
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.paste_sessions (token_hash, person_name, role, expires_at)
  values (
    encode(digest(v_token, 'sha256'), 'hex'),
    p_person_name,
    v_role,
    now() + interval '30 days'
  );
  return jsonb_build_object(
    'authenticated', true,
    'token', v_token,
    'personName', p_person_name,
    'role', v_role,
    'captainName', v_config.captain_name,
    'captainReady', true
  );
end;
$$;

create or replace function public.paste_session(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.paste_sessions%rowtype;
  v_config public.paste_config%rowtype;
begin
  select * into v_session
    from public.paste_sessions
    where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
      and expires_at > now();
  if not found then
    return jsonb_build_object(
      'authenticated', false,
      'personName', null,
      'role', null,
      'people', '[]'::jsonb,
      'captainName', 'Luca Bodini',
      'captainReady', false
    );
  end if;
  select * into v_config from public.paste_config where id = 1;
  return jsonb_build_object(
    'authenticated', true,
    'personName', v_session.person_name,
    'role', v_session.role,
    'people', '[]'::jsonb,
    'captainName', v_config.captain_name,
    'captainReady', v_config.captain_password_hash is not null
  );
end;
$$;

create or replace function public.paste_get_state(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.paste_sessions%rowtype;
  v_config public.paste_config%rowtype;
  v_state public.paste_state%rowtype;
  v_person jsonb;
  v_additions jsonb := '[]'::jsonb;
  v_key text;
  v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  select * into v_session
    from public.paste_sessions
    where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
      and expires_at > now();
  if not found then
    return jsonb_build_object('error', 'Accesso richiesto', 'status', 401);
  end if;
  select * into v_state from public.paste_state where id = 1 for update;
  for v_person in
    select value from jsonb_array_elements(coalesce(v_state.data->'team', '[]'::jsonb))
  loop
    if substring(v_person->>3 from 6 for 5) = to_char(v_today, 'MM-DD') then
      v_key := to_char(v_today, 'YYYY') || '-' || (v_person->>0);
      if not exists (
        select 1
        from jsonb_array_elements(coalesce(v_state.data->'foods', '[]'::jsonb)) food
        where food->>'birthdayKey' = v_key
      ) then
        v_additions := v_additions || jsonb_build_array(jsonb_build_object(
          'name', v_person->>0,
          'why', 'Compleanno',
          'date', to_char(v_today, 'DD/MM'),
          'status', 'Da portare',
          'note', '',
          'initials', v_person->>1,
          'birthdayKey', v_key
        ));
      end if;
    end if;
  end loop;
  if jsonb_array_length(v_additions) > 0 then
    v_state.data := jsonb_set(
      v_state.data,
      '{foods}',
      v_additions || coalesce(v_state.data->'foods', '[]'::jsonb)
    );
    v_state.revision := v_state.revision + 1;
    update public.paste_state
      set data = v_state.data, revision = v_state.revision, updated_at = now()
      where id = 1;
  end if;
  select * into v_config from public.paste_config where id = 1;
  return jsonb_build_object(
    'data', v_state.data,
    'revision', v_state.revision,
    'captainName', v_config.captain_name
  );
end;
$$;

create or replace function public.paste_save_state(
  p_token text,
  p_data jsonb,
  p_captain_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.paste_sessions%rowtype;
begin
  select * into v_session
    from public.paste_sessions
    where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
      and expires_at > now();
  if not found then
    return jsonb_build_object('error', 'Accesso richiesto', 'status', 401);
  end if;
  if v_session.role <> 'captain' then
    return jsonb_build_object(
      'error', 'Solo il capitano può modificare i dati',
      'status', 403
    );
  end if;
  if p_data is null
     or jsonb_typeof(p_data->'team') <> 'array'
     or jsonb_typeof(p_data->'foods') <> 'array'
     or jsonb_typeof(p_data->'kits') <> 'array'
     or octet_length(p_data::text) > 500000 then
    return jsonb_build_object('error', 'Dati non validi', 'status', 400);
  end if;
  if coalesce(trim(p_captain_name), '') <> ''
     and not exists (
       select 1
       from jsonb_array_elements(p_data->'team') person
       where person->>0 = trim(p_captain_name)
     ) then
    return jsonb_build_object(
      'error', 'Capitano non presente nella squadra',
      'status', 400
    );
  end if;
  update public.paste_state
    set data = p_data, revision = revision + 1, updated_at = now()
    where id = 1;
  if coalesce(trim(p_captain_name), '') <> '' then
    update public.paste_config
      set captain_name = trim(p_captain_name)
      where id = 1;
  end if;
  return jsonb_build_object('ok', true, 'updatedAt', now());
end;
$$;

create or replace function public.paste_logout(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.paste_sessions
    where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return jsonb_build_object('authenticated', false);
end;
$$;

revoke all on function public.paste_check_team(text) from public;
revoke all on function public.paste_login(text, text, text) from public;
revoke all on function public.paste_session(text) from public;
revoke all on function public.paste_get_state(text) from public;
revoke all on function public.paste_save_state(text, jsonb, text) from public;
revoke all on function public.paste_logout(text) from public;

grant execute on function public.paste_check_team(text) to anon, authenticated;
grant execute on function public.paste_login(text, text, text) to anon, authenticated;
grant execute on function public.paste_session(text) to anon, authenticated;
grant execute on function public.paste_get_state(text) to anon, authenticated;
grant execute on function public.paste_save_state(text, jsonb, text) to anon, authenticated;
grant execute on function public.paste_logout(text) to anon, authenticated;
