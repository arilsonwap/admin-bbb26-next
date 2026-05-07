import { NextRequest, NextResponse } from 'next/server';
import {
  applyCasaDoPatraoEvents,
  dedupeKeyForEventInCycle,
  rebuildCasaDoPatraoHistorico,
  type CasaDoPatraoHistoricoEvent,
} from '@/utils/casaDoPatraoHistorico';
import { readCasaDoPatraoHistoricoOrEmpty, writeCasaDoPatraoHistoricoAtomic } from '@/lib/casaDoPatraoHistoricoStore';
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

  console.log(`${LOG} confirm_events_start`);

  let body: { events?: CasaDoPatraoHistoricoEvent[]; activeCycleId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const events = body.events;
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'Informe events (array não vazio)' }, { status: 400 });
  }

  const raw = readCasaDoPatraoHistoricoOrEmpty();
  const active =
    raw.cycles.find((c) => c.id === body.activeCycleId) ??
    raw.cycles.find((c) => c.status === 'ATIVO');
  if (!active) {
    return NextResponse.json(
      { error: 'Não há ciclo ativo. Confirme um ciclo antes dos eventos.' },
      { status: 400 }
    );
  }

  if (active.isPlaceholder) {
    return NextResponse.json(
      {
        error:
          'O ciclo activo é apenas placeholder (temporário). Use “Confirmar novo ciclo” para tornar oficial a semana actual antes de aplicar estes eventos.',
      },
      { status: 400 }
    );
  }

  const cid = active.id;
  const already = new Set(active.events.map((ev) => dedupeKeyForEventInCycle(ev, cid)));
  const seenIncoming = new Set<string>();
  const filtered = events.filter((ev) => {
    const k = dedupeKeyForEventInCycle(ev, cid);
    if (already.has(k)) {
      console.warn(`${LOG} special_event_duplicate_ignored`, { phase: 'existing_cycle', key: k });
      return false;
    }
    if (seenIncoming.has(k)) {
      console.warn(`${LOG} special_event_duplicate_ignored`, { phase: 'payload', key: k });
      return false;
    }
    seenIncoming.add(k);
    return true;
  });

  if (filtered.length === 0) {
    return NextResponse.json(
      { error: 'Nenhum evento novo: todos já existem no ciclo ou o payload está duplicado.' },
      { status: 400 }
    );
  }

  const historyBase = rebuildCasaDoPatraoHistorico(raw);
  const updated = applyCasaDoPatraoEvents(historyBase, filtered, active.id);
  writeCasaDoPatraoHistoricoAtomic(updated);
  console.log(`${LOG} confirm_events_saved`, { count: filtered.length, cycleId: active.id });

  return NextResponse.json({ ok: true, history: updated, accepted: filtered.length, ignored: events.length - filtered.length });
}
