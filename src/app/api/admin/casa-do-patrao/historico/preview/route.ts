import { existsSync } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import {
  buildCurrentCasaDoPatraoSnapshot,
  detectCasaDoPatraoSuggestedAction,
  diffCasaDoPatraoSnapshots,
  buildSuggestedEventsForDiff,
  existingDedupeKeysForCycle,
  getReferenceCycle,
  injectBarraPowerVoteOwnerEventsIfMissing,
  injectBarraTaNaRetaEventsIfMissing,
  normalizeCasaDoPatraoKey,
  rebuildCasaDoPatraoHistorico,
} from '@/utils/casaDoPatraoHistorico';
import {
  getDataHistoricoMeta,
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

export async function GET(request: NextRequest) {
  try {
    assertCasaDoPatraoHistoricoAdmin(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: msg === 'Acesso negado' ? 401 : 500 });
  }

  console.log(`${LOG} preview_start`);

  const historyRaw = readCasaDoPatraoHistoricoOrEmpty();
  const p = loadParticipantesJson();
  const b = loadBarraJson();
  const historicoMeta = getDataHistoricoMeta();

  console.log(`${LOG} files_loaded`, {
    participantesPath: p.path,
    barraPath: b.path,
    historicoPath: historicoMeta.path,
    hasParticipantes: p.data !== null,
    hasBarra: b.data !== null,
  });

  const warnings: string[] = [];
  const { list: pl } = parseParticipantesArray(p.data);
  const { list: bl } = parseParticipantesArray(b.data);

  let mergedFromBarra = historyRaw;
  const barraPdv = injectBarraPowerVoteOwnerEventsIfMissing(mergedFromBarra, bl);
  mergedFromBarra = barraPdv.next;
  const barraTnR = injectBarraTaNaRetaEventsIfMissing(mergedFromBarra, bl);
  mergedFromBarra = barraTnR.next;

  const history = rebuildCasaDoPatraoHistorico(mergedFromBarra);

  const namesForKeys = (keys: string[]) =>
    keys.map((key) => {
      const row = bl.find((r) => normalizeCasaDoPatraoKey(r.nome) === key);
      const n = (row?.nome ?? '').trim();
      return n || key;
    });

  if (barraPdv.insertedParticipantKeys.length > 0 || barraTnR.insertedParticipantKeys.length > 0) {
    writeCasaDoPatraoHistoricoAtomic(history);
    if (barraPdv.insertedParticipantKeys.length > 0) {
      warnings.unshift(
        `Dono do Poder do Voto sincronizado a partir da barra e gravado no histórico: ${namesForKeys(barraPdv.insertedParticipantKeys).join(', ')}.`
      );
      console.log(`${LOG} barra_poder_voto_injected`, {
        keys: barraPdv.insertedParticipantKeys,
        count: barraPdv.insertedParticipantKeys.length,
      });
    }
    if (barraTnR.insertedParticipantKeys.length > 0) {
      warnings.unshift(
        `Tá na Reta sincronizado a partir da barra e gravado no histórico: ${namesForKeys(barraTnR.insertedParticipantKeys).join(', ')}.`
      );
      console.log(`${LOG} barra_ta_na_reta_injected`, {
        keys: barraTnR.insertedParticipantKeys,
        count: barraTnR.insertedParticipantKeys.length,
      });
    }
  }

  if (!pl.length) {
    warnings.push('Arquivo casa-do-patrao-participantes.json vazio ou inválido.');
  }
  if (!existsSync(b.path) || b.data === null) {
    warnings.push(
      'Arquivo data/casa-do-patrao-participantes-barra.json ausente ou ilegível; merge de FORA/PATROA na barra pode estar incompleto.'
    );
  }

  const { snapshot: currentSnapshot, patraoKey, patraoNome } = buildCurrentCasaDoPatraoSnapshot(
    pl,
    bl,
    warnings
  );
  console.log(`${LOG} snapshot_built`, { len: currentSnapshot.length, patraoKey });

  const lastCycle = getReferenceCycle(history);
  const previousSnapshot = lastCycle?.snapshot ?? null;
  const diff = diffCasaDoPatraoSnapshots(previousSnapshot, currentSnapshot);
  console.log(`${LOG} diff_result`, {
    functionChanges: diff.functionChanges,
    groupChanges: diff.groupChanges,
    patraoChanged: diff.patraoChanged,
    rows: diff.rows.length,
  });

  const suggestedAction = detectCasaDoPatraoSuggestedAction(
    diff,
    !!lastCycle,
    currentSnapshot.length > 0
  );
  console.log(`${LOG} suggested_action`, suggestedAction);
  if (warnings.length) {
    console.warn(`${LOG} warning`, warnings);
  }

  const active = history.cycles.find((c) => c.status === 'ATIVO');
  const activeSnapshot = active?.snapshot ?? [];
  const dedupe = existingDedupeKeysForCycle(active && !active.isPlaceholder ? active : null);

  let suggestedEvents =
    suggestedAction === 'EVENTO_DENTRO_CICLO' ||
    suggestedAction === 'ATENCAO' ||
    suggestedAction === 'SEM_MUDANCAS'
      ? buildSuggestedEventsForDiff(diff, dedupe, active?.id ?? '')
      : [];

  if (suggestedAction === 'SEM_MUDANCAS') {
    suggestedEvents = [];
  }

  if (active?.isPlaceholder && suggestedEvents.length > 0) {
    warnings.unshift(
      'Com ciclo placeholder activo, os «eventos sugeridos dentro da semana» só estarão disponíveis depois de «Confirmar novo ciclo». Revise primeiro a abertura oficial da próxima semana.'
    );
    suggestedEvents = [];
  }

  return NextResponse.json({
    currentParticipants: pl,
    currentBarra: bl,
    history,
    currentSnapshot,
    lastCycle: lastCycle
      ? {
          id: lastCycle.id,
          numero: lastCycle.numero,
          status: lastCycle.status,
          patraoKey: lastCycle.patraoKey,
          patraoNome: lastCycle.patraoNome,
          snapshotLength: lastCycle.snapshot.length,
          isPlaceholder: Boolean(lastCycle.isPlaceholder),
        }
      : null,
    /** Ciclo único ATIVO (snapshot para UI/eventos especiais — pode ser placeholder). */
    activeCycle: active
      ? {
          id: active.id,
          numero: active.numero,
          status: active.status,
          isPlaceholder: Boolean(active.isPlaceholder),
          placeholderNote: active.placeholderNote ?? null,
          patraoNome: active.patraoNome,
          patraoKey: active.patraoKey,
        }
      : null,
    patraoDetected: { key: patraoKey, nome: patraoNome },
    activeSnapshot,
    diff,
    suggestedAction,
    suggestedEvents,
    warnings,
    sourceMeta: {
      participantesUpdatedAt: p.updatedAt,
      barraUpdatedAt: b.updatedAt,
      historicoUpdatedAt: historicoMeta.updatedAt,
      paths: {
        participantes: p.path,
        barra: b.path,
        historico: historicoMeta.path,
      },
      historicoExists: historicoMeta.exists,
    },
  });
}
