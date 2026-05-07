-- Admin enquetes v2: colunas operacionais + índice uma ativa por tipo + RPC publish alinhada a `active`.
-- Rode no SQL Editor do Supabase após backup.

ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS open_at timestamptz;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS close_at timestamptz;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS auto_open_on_app_launch boolean NOT NULL DEFAULT false;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS auto_open_priority integer NOT NULL DEFAULT 0;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS show_in_home_hub boolean NOT NULL DEFAULT true;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS allow_multiple_votes boolean NOT NULL DEFAULT false;

UPDATE public.polls SET open_at = start_at WHERE open_at IS NULL AND start_at IS NOT NULL;
UPDATE public.polls SET close_at = end_at WHERE close_at IS NULL AND end_at IS NOT NULL;

UPDATE public.polls SET status = 'active' WHERE status = 'open';

ALTER TABLE public.options ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

DROP INDEX IF EXISTS public.polls_one_live;
DROP INDEX IF EXISTS public.uniq_open_poll_per_type;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_poll_per_type
ON public.polls (type)
WHERE status = 'active' AND type IS NOT NULL;

CREATE OR REPLACE FUNCTION public.publish_poll(p_poll_id uuid, p_live_status text DEFAULT 'active')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
BEGIN
  IF p_live_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'publish_poll: use apenas active';
  END IF;

  SELECT type INTO v_type FROM public.polls WHERE id = p_poll_id LIMIT 1;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'publish_poll: poll inexistente';
  END IF;

  UPDATE public.polls
  SET status = 'closed', updated_at = now()
  WHERE id IS DISTINCT FROM p_poll_id
    AND status = 'active'
    AND type = v_type;

  UPDATE public.polls
  SET status = 'active', updated_at = now()
  WHERE id = p_poll_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_poll(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
