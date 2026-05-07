import { NextRequest, NextResponse } from 'next/server';
import { classifyPushSupabaseError } from '../../../../lib/supabasePushErrors';
import { RegisterPushDevicePayloadSchema } from '../../../../models/pushSchemas';
import { upsertPushDevice } from '../../../../services/supabasePushService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function assertRegisterAllowed(request: NextRequest) {
  const secret = process.env.PUSH_REGISTER_SECRET;
  if (!secret) return;
  const key = request.headers.get('x-push-register-key');
  if (!key || key !== secret) {
    throw new Error('Acesso negado');
  }
}

export async function POST(request: NextRequest) {
  try {
    assertRegisterAllowed(request);

    const body = await request.json();
    const parsed = RegisterPushDevicePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const row = await upsertPushDevice({
      deviceId: d.deviceId,
      platform: d.platform,
      appVersion: d.appVersion,
      fcmToken: d.fcmToken,
      topics: d.topics ?? [],
      notificationsEnabled: d.notificationsEnabled ?? true,
      userId: d.userId ?? null,
    });

    return NextResponse.json({
      ok: true,
      device: {
        id: row.id,
        deviceId: row.device_id,
        platform: row.platform,
        lastSeenAt: row.last_seen_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    if (message === 'Acesso negado') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    const classified = classifyPushSupabaseError(message);
    if (classified.missingTables) {
      console.error('[push/register-device]', message);
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
    console.error('[push/register-device]', message);
    const status = /Supabase|FIREBASE/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: 'Falha ao registrar dispositivo', message }, { status });
  }
}
