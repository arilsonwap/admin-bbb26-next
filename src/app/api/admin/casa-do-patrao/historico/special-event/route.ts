import { NextRequest, NextResponse } from 'next/server';
import {
  applyCasaDoPatraoEvents,
  dedupeKeyForEventInCycle,
  existingDedupeKeysForCycle,
  normalizeCasaDoPatraoKey,
  rebuildCasaDoPatraoHistorico,
  type CasaDoPatraoHistoricoEvent,
} from '@/utils/casaDoPatraoHistorico';
import { readCasaDoPatraoHistoricoOrEmpty, writeCasaDoPatraoHistoricoAtomic } from '@/lib/casaDoPatraoHistoricoStore';
import { assertCasaDoPatraoHistoricoAdmin } from '../_auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LOG = '[CasaDoPatrao][Historico]';

type PowerBody = {
  kind: 'power_vote_owner';
  participanteKey?: string;
  participanteNome?: string;
  note?: string;
};

type IndicatedBody = {
  kind: 'indicated_ta_na_reta';
  participanteKey?: string;
  participanteNome?: string;
  targetParticipanteKey?: string;
  targetParticipanteNome?: string;
  note?: string;
};

type TaNaRetaBody = {
  kind: 'ta_na_reta';
  participanteKeys?: string[];
  note?: string;
  /** Registo retroativo: algum participante está FORA_DO_JOGO no snapshot do ciclo ativo */
  confirmForaDoJogo?: boolean;
};

function isForaNoSnapshot(row: {
  grupo: string;
  statusAtual: string;
}): boolean {
  return row.grupo === 'FORA_DO_JOGO' || row.statusAtual === 'FORA_DO_JOGO';
}

export async function POST(request: NextRequest) {
  try {
    assertCasaDoPatraoHistoricoAdmin(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: msg === 'Acesso negado' ? 401 : 500 });
  }

  let body: PowerBody | IndicatedBody | TaNaRetaBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const raw = readCasaDoPatraoHistoricoOrEmpty();
  const active = raw.cycles.find((c) => c.status === 'ATIVO');
  if (!active) {
    return NextResponse.json(
      { error: 'Não há ciclo ativo. Confirme um ciclo antes de registar eventos especiais.' },
      { status: 400 }
    );
  }
  if (active.isPlaceholder) {
    return NextResponse.json(
      {
        error:
          'O ciclo activo é placeholder (temporário). Confirme a semana oficial com “Confirmar novo ciclo” antes de registar Poder / Tá na Reta.',
      },
      { status: 400 }
    );
  }

  const snapKeys = new Set(active.snapshot.map((s) => s.key));
  const snapByKey = new Map(active.snapshot.map((s) => [s.key, s]));
  const nomeByKey = new Map(active.snapshot.map((s) => [s.key, s.nome]));
  const warnings: string[] = [];

  if (body.kind === 'ta_na_reta') {
    const rawKeys = body.participanteKeys;
    if (!Array.isArray(rawKeys) || rawKeys.length === 0) {
      return NextResponse.json(
        { error: 'Selecione pelo menos um participante (participanteKeys).' },
        { status: 400 }
      );
    }

    const uniqueKeys = [...new Set(rawKeys.map((k) => k.trim()).filter(Boolean))];
    if (uniqueKeys.length === 0) {
      return NextResponse.json({ error: 'Nenhuma chave de participante válida.' }, { status: 400 });
    }

    console.log(`${LOG} special_event_ta_na_reta_create_start`, {
      cicloId: active.id,
      count: uniqueKeys.length,
    });

    const foraKeys: string[] = [];
    for (const key of uniqueKeys) {
      const row = snapByKey.get(key);
      if (row && isForaNoSnapshot(row)) {
        foraKeys.push(key);
      }
    }
    if (foraKeys.length > 0 && !body.confirmForaDoJogo) {
      return NextResponse.json(
        {
          code: 'NEEDS_CONFIRM_FORA',
          error:
            'Um ou mais participantes estão fora do jogo no snapshot deste ciclo. Marque a confirmação de registo retroativo para continuar.',
          foraParticipanteKeys: foraKeys,
        },
        { status: 422 }
      );
    }

    const existing = existingDedupeKeysForCycle(active);
    const duplicateKeys: string[] = [];
    const toAppend: CasaDoPatraoHistoricoEvent[] = [];
    const now = new Date().toISOString();
    const noteTrim = body.note?.trim();

    for (const key of uniqueKeys) {
      const nome = nomeByKey.get(key) ?? key;
      if (!snapKeys.has(key)) {
        warnings.push(`Participante "${nome}" (${key}) não está no snapshot do ciclo ativo.`);
      }

      const ev: CasaDoPatraoHistoricoEvent = {
        id: '',
        type: 'TA_NA_RETA',
        createdAt: now,
        participanteNome: nome,
        participanteKey: key,
        fromFuncao: null,
        toFuncao: null,
        fromGrupo: null,
        toGrupo: null,
        source: 'admin_confirmed',
        note: noteTrim ? noteTrim : undefined,
      };
      const dk = dedupeKeyForEventInCycle(ev, active.id);
      if (existing.has(dk)) {
        console.warn(`${LOG} special_event_ta_na_reta_duplicate_ignored`, {
          participanteKey: key,
          cicloId: active.id,
        });
        duplicateKeys.push(key);
        continue;
      }
      existing.add(dk);
      toAppend.push(ev);
    }

    if (toAppend.length === 0) {
      return NextResponse.json(
        {
          error: 'Nenhum evento novo: todos os participantes já tinham TA_NA_RETA neste ciclo.',
          duplicateKeys,
          warnings,
        },
        { status: 409 }
      );
    }

    const historyBase = rebuildCasaDoPatraoHistorico(raw);
    const updated = applyCasaDoPatraoEvents(historyBase, toAppend, active.id);
    writeCasaDoPatraoHistoricoAtomic(updated);
    console.log(`${LOG} special_event_ta_na_reta_create_saved`, {
      cicloId: active.id,
      accepted: toAppend.length,
      duplicateKeys: duplicateKeys.length ? duplicateKeys : undefined,
    });

    return NextResponse.json({
      ok: true,
      history: updated,
      warnings,
      accepted: toAppend.length,
      duplicateKeys,
    });
  }

  console.log(`${LOG} special_event_create_start`, { kind: body.kind });

  let ev: CasaDoPatraoHistoricoEvent;

  if (body.kind === 'power_vote_owner') {
    const key =
      body.participanteKey?.trim() ||
      (body.participanteNome && body.participanteNome.trim().length > 0
        ? normalizeCasaDoPatraoKey(body.participanteNome)
        : '');
    if (!key) {
      return NextResponse.json(
        { error: 'Informe participanteKey ou participanteNome (Dono do Poder do Voto).' },
        { status: 400 }
      );
    }
    const nome =
      body.participanteNome?.trim() && body.participanteNome.trim().length > 0
        ? body.participanteNome.trim()
        : (nomeByKey.get(key) ?? key);
    if (!snapKeys.has(key)) {
      warnings.push(`Participante "${nome}" (${key}) não está no snapshot do ciclo ativo.`);
    }
    ev = {
      id: '',
      type: 'POWER_VOTE_OWNER',
      createdAt: new Date().toISOString(),
      participanteNome: nome,
      participanteKey: key,
      fromFuncao: null,
      toFuncao: null,
      fromGrupo: null,
      toGrupo: null,
      source: 'admin_confirmed',
      note: body.note?.trim() || undefined,
    };
  } else if (body.kind === 'indicated_ta_na_reta') {
    const ikey =
      body.participanteKey?.trim() ||
      (body.participanteNome && body.participanteNome.trim().length > 0
        ? normalizeCasaDoPatraoKey(body.participanteNome)
        : '');
    const tkey =
      body.targetParticipanteKey?.trim() ||
      (body.targetParticipanteNome && body.targetParticipanteNome.trim().length > 0
        ? normalizeCasaDoPatraoKey(body.targetParticipanteNome)
        : '');
    if (!ikey || !tkey) {
      return NextResponse.json(
        { error: 'Indicador e participante indicado são obrigatórios (key ou nome).' },
        { status: 400 }
      );
    }
    const inome =
      body.participanteNome?.trim() && body.participanteNome.trim().length > 0
        ? body.participanteNome.trim()
        : (nomeByKey.get(ikey) ?? ikey);
    const tnome =
      body.targetParticipanteNome?.trim() && body.targetParticipanteNome.trim().length > 0
        ? body.targetParticipanteNome.trim()
        : (nomeByKey.get(tkey) ?? tkey);
    if (!snapKeys.has(ikey)) {
      warnings.push(`Indicador "${inome}" (${ikey}) não está no snapshot do ciclo ativo.`);
    }
    if (!snapKeys.has(tkey)) {
      warnings.push(`Indicado "${tnome}" (${tkey}) não está no snapshot do ciclo ativo.`);
    }
    ev = {
      id: '',
      type: 'INDICATED_TO_TA_NA_RETA',
      createdAt: new Date().toISOString(),
      participanteNome: inome,
      participanteKey: ikey,
      fromFuncao: null,
      toFuncao: null,
      fromGrupo: null,
      toGrupo: null,
      targetParticipanteKey: tkey,
      targetParticipanteNome: tnome,
      source: 'admin_confirmed',
      note: body.note?.trim() || undefined,
    };
  } else {
    return NextResponse.json(
      {
        error:
          'kind inválido. Use power_vote_owner, indicated_ta_na_reta ou ta_na_reta.',
      },
      { status: 400 }
    );
  }

  const dupKey = dedupeKeyForEventInCycle(ev, active.id);
  const existing = existingDedupeKeysForCycle(active);
  if (existing.has(dupKey)) {
    console.warn(`${LOG} special_event_duplicate_ignored`, { duplicateKey: dupKey, type: ev.type });
    return NextResponse.json(
      {
        error: 'Este evento já existe neste ciclo (duplicado ignorado).',
        duplicateKey: dupKey,
        warnings,
      },
      { status: 409 }
    );
  }

  const historyBase = rebuildCasaDoPatraoHistorico(raw);
  const updated = applyCasaDoPatraoEvents(historyBase, [ev], active.id);
  writeCasaDoPatraoHistoricoAtomic(updated);
  console.log(`${LOG} special_event_create_saved`, {
    type: ev.type,
    cycleId: active.id,
    participanteKey: ev.participanteKey,
    target: ev.targetParticipanteKey,
  });

  return NextResponse.json({ ok: true, history: updated, warnings });
}
