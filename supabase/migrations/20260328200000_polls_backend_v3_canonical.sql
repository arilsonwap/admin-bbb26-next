-- =============================================================================
-- BBB26 — Enquetes: schema canônico + RPCs (fonte única no Supabase)
-- Substitui: get_poll_display_state, feature flags polls_*, decisão híbrida.
--
-- ANTES DE RODAR: backup completo. Em produção com dados, use a seção
-- "MIGRAÇÃO A PARTIR DO MODELO ANTIGO" no final (ajuste nomes reais).
--
-- ORDEM: 1) aplicar este arquivo 2) painel/app só service_role nas admin_*
--        3) app público: anon/authenticated executam get_* e submit_*.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Legado: funções e seeds que não devem mais existir
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_poll_display_state();
DROP FUNCTION IF EXISTS public.publish_poll(uuid, text);
DROP FUNCTION IF EXISTS public.publish_poll(uuid);

-- ---------------------------------------------------------------------------
-- Tabela polls (canônica)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  type text NOT NULL CHECK (type IN ('home', 'paredao')),
  status text NOT NULL CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'closed'))
    DEFAULT 'draft',
  open_at timestamptz,
  close_at timestamptz,
  auto_open_on_app_launch boolean NOT NULL DEFAULT false,
  auto_open_priority integer NOT NULL DEFAULT 0,
  show_in_home_hub boolean NOT NULL DEFAULT true,
  allow_multiple_votes boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT polls_open_before_close CHECK (
    open_at IS NULL OR close_at IS NULL OR open_at < close_at
  )
);

ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS description text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'polls' AND column_name = 'allow_vote_after_result'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'polls' AND column_name = 'allow_multiple_votes'
  ) THEN
    ALTER TABLE public.polls RENAME COLUMN allow_vote_after_result TO allow_multiple_votes;
  END IF;
END $$;

ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS allow_multiple_votes boolean NOT NULL DEFAULT false;

-- Colunas legadas (start_at/end_at): dropar após migração de app
-- ALTER TABLE public.polls DROP COLUMN IF EXISTS start_at;
-- ALTER TABLE public.polls DROP COLUMN IF EXISTS end_at;

-- Uma enquete ATIVA por destino (type)
DROP INDEX IF EXISTS public.uniq_active_poll_per_type;
DROP INDEX IF EXISTS public.uniq_open_poll_per_type;
DROP INDEX IF EXISTS public.polls_one_live;

CREATE UNIQUE INDEX uniq_active_poll_per_type
  ON public.polls (type)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_polls_status_updated
  ON public.polls (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_polls_type_status
  ON public.polls (type, status);

CREATE INDEX IF NOT EXISTS idx_polls_auto_open
  ON public.polls (auto_open_on_app_launch, auto_open_priority DESC)
  WHERE auto_open_on_app_launch = true AND status IN ('active', 'scheduled');

-- ---------------------------------------------------------------------------
-- Tabela options (opções da enquete)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  image_url text,
  participant_id text,
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_options_poll_position
  ON public.options (poll_id, position);

-- ---------------------------------------------------------------------------
-- Votos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.options(id) ON DELETE CASCADE,
  device_id text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT poll_votes_device_or_user CHECK (device_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON public.poll_votes (poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON public.poll_votes (option_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_device ON public.poll_votes (poll_id, device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_user ON public.poll_votes (poll_id, user_id) WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_polls_updated_at ON public.polls;
CREATE TRIGGER tr_polls_updated_at
  BEFORE UPDATE ON public.polls
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS tr_options_updated_at ON public.options;
CREATE TRIGGER tr_options_updated_at
  BEFORE UPDATE ON public.options
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers: janela de tempo e visibilidade (STABLE — sempre NOW() consistente na transação)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.poll_in_voting_window(p public.polls, t timestamptz DEFAULT clock_timestamp())
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (p.open_at IS NULL OR p.open_at <= t)
     AND (p.close_at IS NULL OR p.close_at > t);
$$;

CREATE OR REPLACE FUNCTION public.poll_accepts_votes(p public.polls, t timestamptz DEFAULT clock_timestamp())
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.status = 'active' AND public.poll_in_voting_window(p, t);
$$;

-- ---------------------------------------------------------------------------
-- Promoção / encerramento automáticos (chamar no início dos RPCs públicos + cron)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_polls_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  -- Encerrar ativas com close_at passado
  UPDATE public.polls p
  SET status = 'closed'
  WHERE p.status = 'active'
    AND p.close_at IS NOT NULL
    AND p.close_at <= clock_timestamp();

  -- Agendadas cuja open_at já passou -> ativar (fecha outra ativa do mesmo type)
  FOR r IN
    SELECT id, type
    FROM public.polls
    WHERE status = 'scheduled'
      AND open_at IS NOT NULL
      AND open_at <= clock_timestamp()
    ORDER BY open_at ASC, created_at ASC
  LOOP
    UPDATE public.polls
    SET status = 'closed'
    WHERE type = r.type
      AND status = 'active'
      AND id IS DISTINCT FROM r.id;

    UPDATE public.polls
    SET status = 'active', updated_at = clock_timestamp()
    WHERE id = r.id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.promote_polls_lifecycle() IS
  'Atualiza status: active->closed se close_at passou; scheduled->active se open_at passou (1 ativa por type).';

-- ---------------------------------------------------------------------------
-- RPC público: bootstrap (1 launch + home_polls)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_polls_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  launch jsonb;
  home_polls jsonb;
  t timestamptz := clock_timestamp();
BEGIN
  PERFORM public.promote_polls_lifecycle();

  -- Uma única enquete de abertura automática: maior prioridade; desempate updated_at DESC, created_at DESC, id
  -- Só enquete já ativa (scheduled é promovida em promote_polls_lifecycle antes)
  SELECT to_jsonb(s.*) INTO launch
  FROM (
    SELECT p.*
    FROM public.polls p
    WHERE p.auto_open_on_app_launch = true
      AND p.status = 'active'
      AND public.poll_in_voting_window(p, t)
    ORDER BY p.auto_open_priority DESC, p.updated_at DESC, p.created_at DESC, p.id
    LIMIT 1
  ) s;

  -- Hub home: ativas, tipo home, flag hub, dentro da janela
  SELECT coalesce(jsonb_agg(to_jsonb(x.*) ORDER BY x.auto_open_priority DESC, x.updated_at DESC), '[]'::jsonb)
  INTO home_polls
  FROM (
    SELECT p.*
    FROM public.polls p
    WHERE p.type = 'home'
      AND p.status = 'active'
      AND p.show_in_home_hub = true
      AND public.poll_in_voting_window(p, t)
    ORDER BY p.auto_open_priority DESC, p.updated_at DESC
  ) x;

  RETURN jsonb_build_object(
    'launch_poll', launch,
    'home_polls', home_polls,
    'server_time', to_jsonb(to_char(t AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    'schema_version', 3
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC público: todas as enquetes ativas “visíveis” para listagem geral
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_polls()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t timestamptz := clock_timestamp();
  result jsonb;
BEGIN
  PERFORM public.promote_polls_lifecycle();

  SELECT coalesce(jsonb_agg(to_jsonb(x.*) ORDER BY x.type, x.auto_open_priority DESC, x.updated_at DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT p.*
    FROM public.polls p
    WHERE p.status = 'active'
      AND public.poll_in_voting_window(p, t)
      AND (
        (p.type = 'home' AND p.show_in_home_hub = true)
        OR p.type = 'paredao'
      )
  ) x;

  RETURN jsonb_build_object('polls', result, 'server_time', to_jsonb(t), 'schema_version', 3);
END;
$$;

-- ---------------------------------------------------------------------------
-- Opções públicas de uma enquete (para tela de voto)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_poll_options_public(p_poll_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.polls%ROWTYPE;
  t timestamptz := clock_timestamp();
BEGIN
  PERFORM public.promote_polls_lifecycle();

  SELECT * INTO p FROM public.polls WHERE id = p_poll_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'poll_not_found');
  END IF;

  RETURN jsonb_build_object(
    'poll', to_jsonb(p),
    'options',
    (
      SELECT coalesce(jsonb_agg(to_jsonb(o.*) ORDER BY o.position, o.id), '[]'::jsonb)
      FROM public.options o
      WHERE o.poll_id = p_poll_id AND o.active = true
    ),
    'accepting_votes', public.poll_accepts_votes(p, t),
    'schema_version', 3
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Resultados agregados
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_poll_results(p_poll_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.polls%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.polls WHERE id = p_poll_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'poll_not_found');
  END IF;

  RETURN jsonb_build_object(
    'poll_id', p_poll_id,
    'status', p.status,
    'totals',
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'option_id', s.option_id,
        'label', s.label,
        'votes', s.cnt
      ) ORDER BY s.position), '[]'::jsonb)
      FROM (
        SELECT o.id AS option_id, o.label, o.position, count(v.id) AS cnt
        FROM public.options o
        LEFT JOIN public.poll_votes v ON v.option_id = o.id
        WHERE o.poll_id = p_poll_id
        GROUP BY o.id, o.label, o.position
      ) s
    ),
    'schema_version', 3
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Voto
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_poll_vote(
  p_poll_id uuid,
  p_option_id uuid,
  p_device_id text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.polls%ROWTYPE;
  opt RECORD;
  t timestamptz := clock_timestamp();
  existing bigint;
  new_vote_id uuid;
BEGIN
  PERFORM public.promote_polls_lifecycle();

  IF p_device_id IS NULL AND p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'device_or_user_required');
  END IF;

  SELECT * INTO p FROM public.polls WHERE id = p_poll_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'poll_not_found');
  END IF;

  IF NOT public.poll_accepts_votes(p, t) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'poll_not_accepting_votes');
  END IF;

  SELECT 1 INTO opt FROM public.options o
  WHERE o.id = p_option_id AND o.poll_id = p_poll_id AND o.active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_option');
  END IF;

  IF NOT p.allow_multiple_votes THEN
    IF p_device_id IS NOT NULL THEN
      SELECT count(*) INTO existing FROM public.poll_votes
      WHERE poll_id = p_poll_id AND device_id = p_device_id;
      IF existing > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'already_voted_device');
      END IF;
    END IF;
    IF p_user_id IS NOT NULL THEN
      SELECT count(*) INTO existing FROM public.poll_votes
      WHERE poll_id = p_poll_id AND user_id = p_user_id;
      IF existing > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'already_voted_user');
      END IF;
    END IF;
  END IF;

  INSERT INTO public.poll_votes (poll_id, option_id, device_id, user_id)
  VALUES (p_poll_id, p_option_id, p_device_id, p_user_id)
  RETURNING id INTO new_vote_id;

  RETURN jsonb_build_object('ok', true, 'vote_id', new_vote_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin: proteção por GRANT EXECUTE apenas a service_role (recomendado).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_publish_poll(p_poll_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
BEGIN
  SELECT type INTO v_type FROM public.polls WHERE id = p_poll_id;
  IF v_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'poll_not_found');
  END IF;

  UPDATE public.polls SET status = 'closed', updated_at = clock_timestamp()
  WHERE type = v_type AND status = 'active' AND id IS DISTINCT FROM p_poll_id;

  UPDATE public.polls SET status = 'active', updated_at = clock_timestamp()
  WHERE id = p_poll_id;

  RETURN jsonb_build_object('ok', true, 'poll_id', p_poll_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_pause_poll(p_poll_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  UPDATE public.polls SET status = 'paused', updated_at = clock_timestamp()
  WHERE id = p_poll_id AND status = 'active';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_close_poll(p_poll_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  UPDATE public.polls SET status = 'closed', updated_at = clock_timestamp()
  WHERE id = p_poll_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'poll_not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_duplicate_poll(p_poll_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid := gen_random_uuid();
  src public.polls%ROWTYPE;
BEGIN
  SELECT * INTO src FROM public.polls WHERE id = p_poll_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'poll_not_found');
  END IF;

  INSERT INTO public.polls (
    id, title, subtitle, type, status, open_at, close_at,
    auto_open_on_app_launch, auto_open_priority, show_in_home_hub, allow_multiple_votes
  )
  VALUES (
    new_id,
    src.title || ' (cópia)',
    src.subtitle,
    src.type,
    'draft',
    NULL,
    NULL,
    false,
    0,
    src.show_in_home_hub,
    src.allow_multiple_votes
  );

  INSERT INTO public.options (id, poll_id, label, image_url, participant_id, position, active)
  SELECT gen_random_uuid(), new_id, o.label, o.image_url, o.participant_id, o.position, o.active
  FROM public.options o WHERE o.poll_id = p_poll_id;

  RETURN jsonb_build_object('ok', true, 'new_poll_id', new_id);
END;
$$;

-- Create / update genéricos via JSONB (contrato estável para o painel)
CREATE OR REPLACE FUNCTION public.admin_create_poll(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid := coalesce((p_payload->>'id')::uuid, gen_random_uuid());
BEGIN
  INSERT INTO public.polls (
    id, title, subtitle, type, status, open_at, close_at,
    auto_open_on_app_launch, auto_open_priority, show_in_home_hub, allow_multiple_votes
  )
  VALUES (
    new_id,
    coalesce(p_payload->>'title', ''),
    p_payload->>'subtitle',
    coalesce(p_payload->>'type', 'home'),
    coalesce(p_payload->>'status', 'draft'),
    (p_payload->>'open_at')::timestamptz,
    (p_payload->>'close_at')::timestamptz,
    coalesce((p_payload->>'auto_open_on_app_launch')::boolean, false),
    coalesce((p_payload->>'auto_open_priority')::integer, 0),
    coalesce((p_payload->>'show_in_home_hub')::boolean, true),
    coalesce((p_payload->>'allow_multiple_votes')::boolean, false)
  );
  RETURN jsonb_build_object('ok', true, 'poll_id', new_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_poll(p_poll_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.polls SET
    title = coalesce(p_payload->>'title', title),
    subtitle = CASE WHEN p_payload ? 'subtitle' THEN p_payload->>'subtitle' ELSE subtitle END,
    type = coalesce(p_payload->>'type', type),
    status = coalesce(p_payload->>'status', status),
    open_at = CASE WHEN p_payload ? 'open_at' THEN (p_payload->>'open_at')::timestamptz ELSE open_at END,
    close_at = CASE WHEN p_payload ? 'close_at' THEN (p_payload->>'close_at')::timestamptz ELSE close_at END,
    auto_open_on_app_launch = coalesce((p_payload->>'auto_open_on_app_launch')::boolean, auto_open_on_app_launch),
    auto_open_priority = coalesce((p_payload->>'auto_open_priority')::integer, auto_open_priority),
    show_in_home_hub = coalesce((p_payload->>'show_in_home_hub')::boolean, show_in_home_hub),
    allow_multiple_votes = coalesce((p_payload->>'allow_multiple_votes')::boolean, allow_multiple_votes)
  WHERE id = p_poll_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'poll_not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS: votos — inserção apenas via RPC recomendada; se expuser tabela, use policy restrita
-- ---------------------------------------------------------------------------
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Sem policies = só service_role bypass. App usa submit_poll_vote (SECURITY DEFINER).
-- Opcional: permitir SELECT próprio ao autenticado (se user_id = auth.uid())

-- polls / options: não dar SELECT direto a anon se tudo passa por RPC; ou policies read-only.

-- ---------------------------------------------------------------------------
-- GRANTs (ajuste conforme seu modelo de segurança)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.options TO service_role;
GRANT SELECT, INSERT, DELETE ON public.poll_votes TO service_role;

REVOKE ALL ON public.poll_votes FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_polls_bootstrap() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_polls() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_poll_options_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_poll_results(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_poll_vote(uuid, uuid, text, uuid) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.promote_polls_lifecycle() TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_create_poll(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_poll(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_publish_poll(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_pause_poll(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_close_poll(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_duplicate_poll(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- NOTAS DE MIGRAÇÃO (executar manualmente conforme seu banco)
-- =============================================================================
-- 1) Se existir allow_vote_after_result: 
--    ALTER TABLE polls RENAME COLUMN allow_vote_after_result TO allow_multiple_votes;
--    -- ou migrar semântica com UPDATE explícito
-- 2) Copiar participant_slug -> participant_id em options se necessário
-- 3) Dropar feature_flags keys polls_* após app parar de ler
-- 4) Agendar pg_cron: SELECT public.promote_polls_lifecycle(); a cada minuto
--    (reduz latência de scheduled -> active sem depender só do primeiro GET)
