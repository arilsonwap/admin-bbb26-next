import { NextRequest, NextResponse } from 'next/server';
import {
  injectBarraPowerVoteOwnerEventsIfMissing,
  injectBarraTaNaRetaEventsIfMissing,
  rebuildCasaDoPatraoHistorico,
} from '@/utils/casaDoPatraoHistorico';
import {
  loadBarraJson,
  parseParticipantesArray,
  readCasaDoPatraoHistoricoOrEmpty,
  writeCasaDoPatraoHistoricoAtomic,
} from '@/lib/casaDoPatraoHistoricoStore';
import { assertCasaDoPatraoHistoricoAdmin } from '../_auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LOG = '[CasaDoPatrao][Historico]';

export async function POST(request: NextRequest) {
  try {
    assertCasaDoPatraoHistoricoAdmin(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: msg === 'Acesso negado' ? 401 : 500 });
  }

  console.log(`${LOG} rebuild_start`);
  const raw = readCasaDoPatraoHistoricoOrEmpty();
  const b = loadBarraJson();
  const { list: bl } = parseParticipantesArray(b.data);
  let merged = injectBarraPowerVoteOwnerEventsIfMissing(raw, bl).next;
  merged = injectBarraTaNaRetaEventsIfMissing(merged, bl).next;
  const rebuilt = rebuildCasaDoPatraoHistorico(merged);
  writeCasaDoPatraoHistoricoAtomic(rebuilt);
  console.log(`${LOG} rebuild_saved`);

  return NextResponse.json({ ok: true, history: rebuilt });
}
