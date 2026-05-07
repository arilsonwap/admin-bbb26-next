import { NextRequest, NextResponse } from 'next/server';
import { classifyPushSupabaseError } from '../../../../../lib/supabasePushErrors';
import { AdminSendPushPayloadSchema } from '../../../../../models/pushSchemas';
import { runAdminPushSend } from '../../../../../lib/notifications/sendAdminPush';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function assertAdmin(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';

  if (!apiKey || apiKey !== expectedApiKey) {
    throw new Error('Acesso negado');
  }
}

export async function POST(request: NextRequest) {
  try {
    assertAdmin(request);

    const body = await request.json();
    const parsed = AdminSendPushPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const createdBy =
      request.headers.get('x-admin-label')?.trim().slice(0, 120) ||
      request.headers.get('x-admin-user')?.trim().slice(0, 120) ||
      null;

    console.info('[admin/notifications/send]', {
      mode: parsed.data.mode,
      audienceType: parsed.data.audience.type,
      type: parsed.data.data.type,
    });

    const { log, fcm } = await runAdminPushSend(parsed.data, { createdBy });

    return NextResponse.json({
      ok: true,
      logId: log.id,
      status: log.status,
      successCount: fcm.successCount,
      failureCount: fcm.failureCount,
      errors: fcm.errors,
      log,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    if (message === 'Acesso negado') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    const classified = classifyPushSupabaseError(message);
    if (classified.missingTables) {
      console.error('[admin/notifications/send]', message);
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
    console.error('[admin/notifications/send]', message);
    const isConfig =
      /FIREBASE_SERVICE_ACCOUNT_JSON|Supabase ausente|não configurado/i.test(message);
    return NextResponse.json(
      { error: 'Falha ao enviar notificação', message },
      { status: isConfig ? 503 : 500 }
    );
  }
}
