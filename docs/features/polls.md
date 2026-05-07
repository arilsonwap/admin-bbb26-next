# Enquetes (BBB26) — modelo único

## Fonte de verdade

- **App (leitura):** RPC Postgres `get_polls_bootstrap()` — `launch_poll`, `home_polls`, `server_time`, `schema_version`.
- **App (listagem ampla):** `get_active_polls()` quando necessário.
- **Voto / resultados:** `get_poll_options_public`, `submit_poll_vote`, `get_poll_results` (conforme produto).

Não usar `feature_flags` com chaves `polls_*`, `home_poll_card`, `paredao_entry` nem qualquer `display_state` legado.

## Supabase

- Schema e RPCs: `supabase/migrations/20260328200000_polls_backend_v3_canonical.sql`
- Limpeza DB legada (one-off): `supabase/sql/polls_legacy_cleanup_oneoff.sql`

## Painel admin (Next)

- Gestão via REST nas tabelas `polls` / `options` e RPCs `admin_*` para publicar, pausar, encerrar e duplicar (service role).
