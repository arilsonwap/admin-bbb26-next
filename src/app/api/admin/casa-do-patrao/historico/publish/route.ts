import { NextRequest, NextResponse } from 'next/server';
import { rebuildCasaDoPatraoHistorico } from '@/utils/casaDoPatraoHistorico';
import { readCasaDoPatraoHistoricoOrEmpty, writeCasaDoPatraoHistoricoAtomic } from '@/lib/casaDoPatraoHistoricoStore';
import { assertCasaDoPatraoHistoricoAdmin } from '../_auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LOG = '[CasaDoPatrao][Historico]';

/** Regrava data + tools/bbb-hosting/public a partir do JSON em data/ (recalcula agregados antes). */
export async function POST(request: NextRequest) {
  try {
    assertCasaDoPatraoHistoricoAdmin(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: msg === 'Acesso negado' ? 401 : 500 });
  }

  console.log(`${LOG} publish_start`);
  const rebuilt = rebuildCasaDoPatraoHistorico(readCasaDoPatraoHistoricoOrEmpty());
  writeCasaDoPatraoHistoricoAtomic(rebuilt);
  console.log(`${LOG} publish_saved`);

  return NextResponse.json({ ok: true, history: rebuilt });
}
