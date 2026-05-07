-- Tabela genérica de flags (sem seeds de enquetes — removidos; UI de polls = get_polls_bootstrap + colunas em polls).
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  description text,
  updated_at timestamptz not null default now()
);

create or replace function public.set_feature_flags_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_feature_flags_updated_at on public.feature_flags;
create trigger trg_feature_flags_updated_at
before update on public.feature_flags
for each row
execute function public.set_feature_flags_updated_at();
