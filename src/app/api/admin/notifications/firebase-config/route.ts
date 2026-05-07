import { NextRequest, NextResponse } from 'next/server';
import { getFirebasePushDiagnostics } from '../../../../../lib/firebaseAdmin';

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

/**
 * Diagnóstico seguro da credencial Firebase Admin (push). Não retorna private_key nem JSON bruto.
 */
export async function GET(request: NextRequest) {
  try {
    assertAdmin(request);
    const diagnostics = getFirebasePushDiagnostics();
    return NextResponse.json(diagnostics);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    if (message === 'Acesso negado') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error('[admin/notifications/firebase-config]', message);
    return NextResponse.json({ error: 'Falha ao obter diagnóstico' }, { status: 500 });
  }
}
