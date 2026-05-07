import { NextRequest, NextResponse } from 'next/server';
import { rpcGetPollsBootstrap } from '../../../../services/supabasePollsService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function assertAdmin(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';

  if (!apiKey || apiKey !== expectedApiKey) {
    throw new Error('Acesso negado');
  }
}

/** Espelha `get_polls_bootstrap` (útil para validar painel / depuração). O app em produção deve chamar a RPC com anon. */
export async function GET(request: NextRequest) {
  try {
    assertAdmin(request);
    const payload = await rpcGetPollsBootstrap();
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const status = message === 'Acesso negado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
