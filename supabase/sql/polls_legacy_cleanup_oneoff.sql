-- Executar UMA VEZ após app e painel usarem só get_polls_bootstrap / modelo v3.
-- Backup antes de rodar.

DROP FUNCTION IF EXISTS public.get_poll_display_state();

DELETE FROM public.feature_flags
WHERE key LIKE 'polls_%'
   OR key IN ('home_poll_card', 'paredao_entry');

-- Se ainda existir coluna antiga de voto único vs múltiplo:
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

NOTIFY pgrst, 'reload schema';
