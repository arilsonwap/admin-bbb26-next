-- =============================================================================
-- BBB26 — Push: dispositivos FCM + histórico de envios editoriais
-- Acesso: apenas server (service role) via painel/API Next; app registra via POST.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Dispositivos / tokens (upsert por device_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  user_id uuid,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  app_version text,
  fcm_token text NOT NULL,
  topics text[] NOT NULL DEFAULT '{}',
  notifications_enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_push_devices_device_id
  ON public.push_devices (device_id);

CREATE INDEX IF NOT EXISTS idx_push_devices_fcm_token
  ON public.push_devices (fcm_token);

CREATE INDEX IF NOT EXISTS idx_push_devices_platform
  ON public.push_devices (platform);

CREATE INDEX IF NOT EXISTS idx_push_devices_last_seen
  ON public.push_devices (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_devices_topics_gin
  ON public.push_devices USING GIN (topics);

COMMENT ON TABLE public.push_devices IS 'Tokens FCM e metadados por device_id (idempotente por device_id).';

-- ---------------------------------------------------------------------------
-- Histórico de envios (auditoria)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  body text,
  type text NOT NULL,
  audience_type text NOT NULL CHECK (audience_type IN ('token', 'topic', 'segment')),
  audience_snapshot jsonb NOT NULL DEFAULT '{}',
  payload_data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'partial', 'failed')),
  provider text NOT NULL DEFAULT 'fcm',
  provider_response jsonb,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_notification_logs_created_at
  ON public.push_notification_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notification_logs_type
  ON public.push_notification_logs (type);

COMMENT ON TABLE public.push_notification_logs IS 'Log de disparos editoriais (payload + resultado FCM agregado).';

-- Acesso apenas via service role (REST do painel); anon/authenticated ficam bloqueados.
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_devices FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_devices_deny_all ON public.push_devices;
CREATE POLICY push_devices_deny_all ON public.push_devices FOR ALL USING (false);

ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_notification_logs_deny_all ON public.push_notification_logs;
CREATE POLICY push_notification_logs_deny_all ON public.push_notification_logs FOR ALL USING (false);
