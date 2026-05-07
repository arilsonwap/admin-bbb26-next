import { NextRequest, NextResponse } from 'next/server';
import { classifyPushSupabaseError } from '../../../../../lib/supabasePushErrors';
import { listRecentPushNotificationLogs } from '../../../../../services/supabasePushService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function assertAdmin(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';

  if (!apiKey || apiKey !== expectedApiKey) {
    throw new Error('Acesso negado');
  }
}

export async function GET(request: NextRequest) {
  try {
    assertAdmin(request);

    const { searchParams } = new URL(request.url);
    const limitRaw = searchParams.get('limit');
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 50;

    const logs = await listRecentPushNotificationLogs(Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ logs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    if (message === 'Acesso negado') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    const classified = classifyPushSupabaseError(message);
    if (classified.missingTables) {
      console.error('[admin/notifications/logs]', message);
      return NextResponse.json(
        {
          error: 'Tabelas de push não encontradas no Supabase',
          code: 'PUSH_TABLES_NOT_MIGRATED',
          hint: classified.hint,
          message,
        },
        { status: 503 }
      );
    }
    console.error('[admin/notifications/logs]', message);
    return NextResponse.json({ error: 'Falha ao listar logs', message }, { status: 500 });
  }
}
