import { NextResponse } from 'next/server';
import { buildPollDisplayStateV2ForApp } from '../../../../services/supabasePollsService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET público — mesmo JSON que o app espera em `parsePollDisplayStateV2` (schemaVersion 2).
 * Host típico: `https://bbb-26.web.app/api/polls/display-state`
 */
export async function GET() {
  try {
    const payload = await buildPollDisplayStateV2ForApp();
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[api/polls/display-state]', message);
    return NextResponse.json({ error: 'Falha ao montar display state', message }, { status: 503 });
  }
}
