import { NextRequest, NextResponse } from 'next/server';
import {
  applyCasaDoPatraoCycle,
  buildCurrentCasaDoPatraoSnapshot,
  rebuildCasaDoPatraoHistorico,
} from '@/utils/casaDoPatraoHistorico';
import {
  loadBarraJson,
  loadParticipantesJson,
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

  console.log(`${LOG} confirm_cycle_start`);

  const warnings: string[] = [];
  const p = loadParticipantesJson();
  const b = loadBarraJson();
  const { list: pl } = parseParticipantesArray(p.data);
  const { list: bl } = parseParticipantesArray(b.data);

  const { snapshot, patraoKey, patraoNome } = buildCurrentCasaDoPatraoSnapshot(pl, bl, warnings);

  if (!patraoKey || !patraoNome) {
    console.warn(`${LOG} warning`, 'confirm_cycle sem PATROA/PATRÃO válido');
    return NextResponse.json(
      {
        error: 'Não é possível confirmar ciclo: PATROA/PATRÃO não identificado unicamente.',
        warnings,
      },
      { status: 400 }
    );
  }

  if (!snapshot.length) {
    return NextResponse.json({ error: 'Snapshot vazio.', warnings }, { status: 400 });
  }

  const historyBase = rebuildCasaDoPatraoHistorico(readCasaDoPatraoHistoricoOrEmpty());
  const updated = applyCasaDoPatraoCycle(historyBase, {
    snapshot,
    patraoNome,
    patraoKey,
    participantesUpdatedAt: p.updatedAt,
    barraUpdatedAt: b.updatedAt,
  });

  writeCasaDoPatraoHistoricoAtomic(updated);
  console.log(`${LOG} confirm_cycle_saved`, { cycleId: updated.currentCycleId });

  return NextResponse.json({ ok: true, history: updated, warnings });
}
