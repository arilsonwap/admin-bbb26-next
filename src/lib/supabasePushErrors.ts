/**
 * Erros PostgREST/Supabase quando tabelas de push ainda não existem no projeto remoto.
 */
export type PushTablesMigrationStatus =
  | { missingTables: true; hint: string }
  | { missingTables: false };

const MIGRATION_FILE = 'supabase/migrations/20260404120000_push_devices_and_notification_logs.sql';

export function classifyPushSupabaseError(message: string): PushTablesMigrationStatus {
  const m = message.toLowerCase();
  const looksLikeMissingTable =
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('does not exist');
  const mentionsPush =
    m.includes('push_notification_logs') ||
    m.includes('push_devices');

  if (looksLikeMissingTable && mentionsPush) {
    return {
      missingTables: true,
      hint: `As tabelas de push ainda não existem neste projeto Supabase. Abra o SQL Editor no dashboard do projeto (mesmo de SUPABASE_URL), cole e execute o arquivo ${MIGRATION_FILE} do repositório, ou rode a migration pelo fluxo de migrations do Supabase. Depois, aguarde alguns segundos e recarregue o painel.`,
    };
  }

  return { missingTables: false };
}
