import { createHash } from 'crypto';

const LOG_PREFIX = '[CasaDoPatrao][Historico]';

export function casaDoPatraoHistoricoWarn(message: string, extra?: unknown): void {
  if (extra !== undefined) {
    console.warn(`${LOG_PREFIX} warning`, message, extra);
  } else {
    console.warn(`${LOG_PREFIX} warning`, message);
  }
}

export type CasaDoPatraoGrupo = 'CASA_DO_PATRAO' | 'CASA_DO_TRAMPO' | 'FORA_DO_JOGO';

export type ParticipanteStatus = 'ATIVO' | 'FORA_DO_JOGO';

export type CasaDoPatraoSuggestedAction =
  | 'SEM_MUDANCAS'
  | 'EVENTO_DENTRO_CICLO'
  | 'NOVO_CICLO_SUGERIDO'
  | 'ATENCAO'
  | 'PRIMEIRO_CICLO';

export type CasaDoPatraoEventType =
  | 'CYCLE_INITIAL_ASSIGNMENT'
  | 'PROMOTED_TRAMPO_TO_PARCA'
  /** Venceu a Prova Tô Fora: Trampo → Casa do Patrão (não usar para promoção a parça manual). */
  | 'PROVA_TO_FORA'
  /** Venceu a Prova Tô Fora (novo): Trampo → Casa do Patrão; incrementa `provaToFora`. */
  | 'PROVA_TO_FORA_WINNER'
  | 'MOVED_TO_TRAMPO'
  | 'TRAMPO_FUNCTION_CHANGED'
  | 'PATRON_GROUP_ROLE_CHANGED'
  | 'LEFT_GAME'
  | 'OUT_OF_GAME_DETECTED'
  | 'NEW_PARTICIPANT_DETECTED'
  | 'POWER_VOTE_OWNER'
  | 'INDICATED_TO_TA_NA_RETA'
  /** Formação Tá na Reta (berlinda / risco); não é eliminação. */
  | 'TA_NA_RETA';

export interface HistoricoCounters {
  casaDoPatrao: number;
  casaDoTrampo: number;
  patrao: number;
  parca: number;
  cozinha: number;
  louca: number;
  banheiro: number;
  lavanderia: number;
  servir: number;
  faxina: number;
  promovidoDoTrampoParaParca: number;
  /** Vitórias na Prova Tô Fora (Trampo → Casa do Patrão); separado de parça. */
  promovidoDoTrampoParaPatrao: number;
  /** Vitórias na Prova Tô Fora (contador editorial). */
  provaToFora: number;
  foraDoJogo: number;
  /** Dono do Poder do Voto — não altera casa/função. */
  poderDoVoto: number;
  /** Vezes em Tá na Reta (eventos TA_NA_RETA e, no máx. +1/ciclo, indicação INDICATED_TO_TA_NA_RETA no alvo). */
  taNaReta: number;
}

export const EMPTY_HISTORICO: HistoricoCounters = {
  casaDoPatrao: 0,
  casaDoTrampo: 0,
  patrao: 0,
  parca: 0,
  cozinha: 0,
  louca: 0,
  banheiro: 0,
  lavanderia: 0,
  servir: 0,
  faxina: 0,
  promovidoDoTrampoParaParca: 0,
  promovidoDoTrampoParaPatrao: 0,
  provaToFora: 0,
  foraDoJogo: 0,
  poderDoVoto: 0,
  taNaReta: 0,
};

export interface SnapshotPerson {
  nome: string;
  key: string;
  funcao: string;
  grupo: CasaDoPatraoGrupo;
  /** Indica função não mapeada nas regras conhecidas */
  unknownFuncao?: boolean;
  statusAtual: ParticipanteStatus;
}

export interface CasaDoPatraoHistoricoEvent {
  id: string;
  type: CasaDoPatraoEventType;
  createdAt: string;
  participanteNome: string;
  participanteKey: string;
  fromFuncao: string | null;
  toFuncao: string | null;
  fromGrupo: CasaDoPatraoGrupo | null;
  toGrupo: CasaDoPatraoGrupo | null;
  source: string;
  /** Para TRAMPO_FUNCTION_CHANGED: se false, não incrementa contador da função destino */
  applyFunctionCounter?: boolean;
  /** Auditoria editorial, ex.: motivo fixo para Prova Tô Fora */
  motivo?: string;
  /** Nota editorial (ex.: semana, contexto) */
  note?: string;
  /** Para INDICATED_TO_TA_NA_RETA — quem recebeu a indicação */
  targetParticipanteKey?: string;
  targetParticipanteNome?: string;
}

export interface CasaDoPatraoCycle {
  id: string;
  numero: number;
  status: 'ATIVO' | 'CONCLUIDO';
  createdAt: string;
  confirmedAt: string;
  patraoNome: string;
  patraoKey: string;
  source: {
    participantesUpdatedAt: string | null;
    barraUpdatedAt: string | null;
  };
  snapshot: SnapshotPerson[];
  events: CasaDoPatraoHistoricoEvent[];
  /**
   * Ciclo placeholder: apenas snapshot para comparar JSON ao vivo (`events` deve ser []).
   * Não conta no rebuild; deve ser substituído ao confirmar a semana real (`applyCasaDoPatraoCycle`).
   */
  isPlaceholder?: boolean;
  /** Nota curta (ex.: temporário até semana oficial 2). */
  placeholderNote?: string;
}

export interface CasaDoPatraoHistoricoParticipant {
  nome: string;
  key: string;
  statusAtual: ParticipanteStatus;
  funcaoAtual: string;
  grupoAtual: CasaDoPatraoGrupo;
  historico: HistoricoCounters;
}

export interface CasaDoPatraoHistorico {
  schemaVersion: number;
  updatedAt: string;
  /**
   * Deve coincidir com o único ciclo em `status: 'ATIVO'`, quando existir; caso contrário `null`.
   * Placeholders activos continuam ATIVOs até serem substituídos na confirmação da semana real.
   */
  currentCycleId: string | null;
  cycles: CasaDoPatraoCycle[];
  participants: CasaDoPatraoHistoricoParticipant[];
}

export interface DiffRow {
  participanteKey: string;
  participanteNome: string;
  funcaoAnterior: string | null;
  grupoAnterior: CasaDoPatraoGrupo | null;
  funcaoAtual: string;
  grupoAtual: CasaDoPatraoGrupo;
  tipoMudanca: string;
  acaoSugerida: string;
  /** Quando aplicável, tipo de evento sugerido */
  suggestedEventType?: CasaDoPatraoEventType;
}

export interface CasaDoPatraoDiffResult {
  rows: DiffRow[];
  functionChanges: number;
  groupChanges: number;
  patraoPreviousKey: string | null;
  patraoCurrentKey: string | null;
  patraoChanged: boolean;
}

export function normalizeCasaDoPatraoKey(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function normalizeFuncaoCasaDoPatrao(raw: string): string {
  return raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

export function isPatraoRole(funcaoNorm: string): boolean {
  const f = funcaoNorm;
  return f === 'PATROA' || f === 'PATRAO' || f === 'PATRÃO';
}

export function isParcaRole(funcaoNorm: string): boolean {
  const f = funcaoNorm;
  return f === 'PARÇA' || f === 'PARCA';
}

export function isTrampoRole(funcaoNorm: string): boolean {
  const f = funcaoNorm;
  return (
    f === 'COZINHA' ||
    f === 'LOUÇA' ||
    f === 'LOUCA' ||
    f === 'BANHEIRO' ||
    f === 'LAVANDERIA' ||
    f === 'SERVIR' ||
    f === 'FAXINA'
  );
}

/** Função na barra (ex.: «PODER DO VOTO») para sincronizar `POWER_VOTE_OWNER` no ciclo ativo. */
export function isPoderDoVotoFuncao(funcaoNorm: string): boolean {
  const f = (funcaoNorm ?? '').trim().replace(/\s+/g, ' ');
  return f === 'PODER DO VOTO' || f.replace(/-/g, ' ') === 'PODER DO VOTO';
}

/** Função na barra (ex.: «TÁ NA RETA») para sincronizar `TA_NA_RETA` no ciclo ativo. */
export function isTaNaRetaBarraFuncao(funcaoNorm: string): boolean {
  const f = (funcaoNorm ?? '').trim().replace(/\s+/g, ' ').replace(/-/g, ' ');
  return f === 'TA NA RETA';
}

export function isForaDoJogoFuncao(funcaoNorm: string): boolean {
  const f = (funcaoNorm ?? '').trim();
  if (!f) return false;

  /**
   * Match exato (pós-normalização) para evitar falso positivo com “PROVA TÔ FORA”.
   * `normalizeFuncaoCasaDoPatrao()` já remove acentos e põe em maiúsculo.
   */
  if (f === 'PROVA TO FORA' || f === 'PROVA TÔ FORA') return false;

  const ACCEPTED = new Set<string>([
    'FORA DO JOGO',
    'FORA_DO_JOGO',
    'FORA-DO-JOGO',
    'TA NA RUA',
    'ELIMINADO',
    'ELIMINADA',
    'ELIMINACAO',
    'DESISTIU',
    'DESISTENTE',
    'EXPULSO',
    'EXPULSA',
  ]);

  return ACCEPTED.has(f);
}

export function getCasaDoPatraoGrupo(funcaoNorm: string): CasaDoPatraoGrupo {
  if (!funcaoNorm) return 'CASA_DO_TRAMPO';
  if (isForaDoJogoFuncao(funcaoNorm)) return 'FORA_DO_JOGO';
  if (isPatraoRole(funcaoNorm) || isParcaRole(funcaoNorm)) return 'CASA_DO_PATRAO';
  if (isTrampoRole(funcaoNorm)) return 'CASA_DO_TRAMPO';
  return 'CASA_DO_TRAMPO';
}

/** Mapeia função normalizada para chave do contador específico (trampo) */
export function trampoFuncaoToCounterKey(
  funcaoNorm: string
): keyof HistoricoCounters | null {
  const f = funcaoNorm;
  if (f === 'COZINHA') return 'cozinha';
  if (f === 'LOUÇA' || f === 'LOUCA') return 'louca';
  if (f === 'BANHEIRO') return 'banheiro';
  if (f === 'LAVANDERIA') return 'lavanderia';
  if (f === 'SERVIR') return 'servir';
  if (f === 'FAXINA') return 'faxina';
  return null;
}

export function fileMtimeIso(pathExists: boolean, mtimeMs?: number): string | null {
  if (!pathExists || mtimeMs === undefined) return null;
  return new Date(mtimeMs).toISOString();
}

export interface RawParticipante {
  nome: string;
  funcao?: string;
}

/**
 * Snapshot = união das chaves da lista principal + barra.
 * Participantes só na barra com função FORA/TÁ NA RUA entram como `FORA_DO_JOGO` sem estarem no JSON principal.
 */
export function buildCurrentCasaDoPatraoSnapshot(
  participantes: RawParticipante[],
  barra: RawParticipante[],
  warnings: string[]
): { snapshot: SnapshotPerson[]; patraoKey: string | null; patraoNome: string | null } {
  const mainByKey = new Map<string, RawParticipante>();
  for (const p of participantes) {
    const k = normalizeCasaDoPatraoKey(p.nome);
    if (!k) {
      warnings.push(`Participante sem key válida: "${p.nome}"`);
      continue;
    }
    mainByKey.set(k, p);
  }

  const barraByKey = new Map<string, RawParticipante>();
  for (const p of barra) {
    const k = normalizeCasaDoPatraoKey(p.nome);
    if (!k) continue;
    barraByKey.set(k, p);
  }

  const keys = new Set<string>([...mainByKey.keys(), ...barraByKey.keys()]);

  const snapshot: SnapshotPerson[] = [];

  for (const key of keys) {
    const main = mainByKey.get(key);
    const b = barraByKey.get(key);
    const nome = main?.nome ?? b?.nome ?? key;

    let funcaoRaw = main?.funcao ?? '';
    const fn = normalizeFuncaoCasaDoPatrao(funcaoRaw);
    const knownFuncao =
      fn === '' ||
      isPatraoRole(fn) ||
      isParcaRole(fn) ||
      isTrampoRole(fn) ||
      isForaDoJogoFuncao(fn);
    let grupo = getCasaDoPatraoGrupo(fn);
    const unknownFuncao = fn !== '' && !knownFuncao;

    if (b?.funcao && normalizeFuncaoCasaDoPatrao(b.funcao) !== '') {
      const bf = normalizeFuncaoCasaDoPatrao(b.funcao);
      if (isForaDoJogoFuncao(bf)) {
        funcaoRaw = b.funcao ?? funcaoRaw;
        grupo = 'FORA_DO_JOGO';
      } else if (isPatraoRole(bf) && !main) {
        funcaoRaw = b.funcao ?? funcaoRaw;
        grupo = getCasaDoPatraoGrupo(normalizeFuncaoCasaDoPatrao(funcaoRaw));
      }
    }

    const statusAtual: ParticipanteStatus = grupo === 'FORA_DO_JOGO' ? 'FORA_DO_JOGO' : 'ATIVO';
    const displayFuncao =
      funcaoRaw.trim() !== ''
        ? normalizeFuncaoCasaDoPatrao(funcaoRaw)
        : main
          ? '(sem função)'
          : isForaDoJogoFuncao(normalizeFuncaoCasaDoPatrao(b?.funcao ?? ''))
            ? normalizeFuncaoCasaDoPatrao(b!.funcao!)
            : '(somente barra)';

    if (main && normalizeFuncaoCasaDoPatrao(main.funcao ?? '').length === 0) {
      warnings.push(`Função vazia na lista principal para "${nome}".`);
    }

    const unknownFinal =
      unknownFuncao ||
      (displayFuncao === '(sem função)' && grupo !== 'FORA_DO_JOGO');

    snapshot.push({
      nome,
      key,
      funcao: displayFuncao,
      grupo,
      unknownFuncao: unknownFinal,
      statusAtual,
    });
  }

  const patroas = snapshot.filter((s) => isPatraoRole(normalizeFuncaoCasaDoPatrao(s.funcao)));
  if (patroas.length !== 1) {
    warnings.push(
      patroas.length === 0
        ? 'Deve existir exatamente 1 PATROA/PATRÃO no snapshot; encontrado: 0.'
        : `Deve existir exatamente 1 PATROA/PATRÃO; encontrados: ${patroas.length}.`
    );
  }

  const patraoNome = patroas[0]?.nome ?? null;
  const patraoKey = patroas[0]?.key ?? null;

  return { snapshot, patraoKey, patraoNome };
}

function snapshotToMap(snap: SnapshotPerson[]): Map<string, SnapshotPerson> {
  const m = new Map<string, SnapshotPerson>();
  for (const s of snap) {
    m.set(s.key, s);
  }
  return m;
}

export function diffCasaDoPatraoSnapshots(
  previous: SnapshotPerson[] | null,
  current: SnapshotPerson[]
): CasaDoPatraoDiffResult {
  const prevMap = previous ? snapshotToMap(previous) : new Map<string, SnapshotPerson>();
  const curMap = snapshotToMap(current);
  const allKeys = new Set<string>([...prevMap.keys(), ...curMap.keys()]);

  const rows: DiffRow[] = [];
  let functionChanges = 0;
  let groupChanges = 0;

  const prevPatrao = previous?.find((s) => isPatraoRole(normalizeFuncaoCasaDoPatrao(s.funcao)));
  const curPatrao = current.find((s) => isPatraoRole(normalizeFuncaoCasaDoPatrao(s.funcao)));

  const patraoPreviousKey = prevPatrao?.key ?? null;
  const patraoCurrentKey = curPatrao?.key ?? null;
  const patraoChanged =
    !!patraoPreviousKey && !!patraoCurrentKey
      ? patraoPreviousKey !== patraoCurrentKey
      : !!patraoPreviousKey !== !!patraoCurrentKey;

  for (const key of allKeys) {
    const p = prevMap.get(key) ?? null;
    const c = curMap.get(key) ?? null;

    if (!p && c) {
      rows.push({
        participanteKey: key,
        participanteNome: c.nome,
        funcaoAnterior: null,
        grupoAnterior: null,
        funcaoAtual: c.funcao,
        grupoAtual: c.grupo,
        tipoMudanca: 'NOVO_PARTICIPANTE',
        acaoSugerida: 'Registar como novo no ciclo ou revisão manual.',
        suggestedEventType: 'NEW_PARTICIPANT_DETECTED',
      });
      functionChanges += 1;
      groupChanges += 1;
      continue;
    }

    if (p && !c) {
      const wasStillPlaying = p.grupo !== 'FORA_DO_JOGO';
      rows.push({
        participanteKey: key,
        participanteNome: p.nome,
        funcaoAnterior: p.funcao,
        grupoAnterior: p.grupo,
        funcaoAtual: '(removido)',
        grupoAtual: 'FORA_DO_JOGO',
        tipoMudanca: 'REMOVIDO_DO_PRINCIPAL',
        acaoSugerida:
          'Sumiram das linhas principais e não apareceram no snapshot unificado — conferir barra (FUNÇÃO ELIMINADO/FORA/TÁ NA RUA). Preferível registá‑los na barra antes de fechar o ciclo.',
        suggestedEventType: wasStillPlaying ? 'OUT_OF_GAME_DETECTED' : undefined,
      });
      functionChanges += 1;
      continue;
    }

    if (!p || !c) continue;

    const fnP = normalizeFuncaoCasaDoPatrao(p.funcao);
    const fnC = normalizeFuncaoCasaDoPatrao(c.funcao);
    const funcChanged = fnP !== fnC || p.funcao !== c.funcao;
    const grpChanged = p.grupo !== c.grupo;

    if (funcChanged) functionChanges += 1;
    if (grpChanged) groupChanges += 1;

    if (!funcChanged && !grpChanged) continue;

    const suggested = classifyChange(p, c);

    rows.push({
      participanteKey: key,
      participanteNome: c.nome,
      funcaoAnterior: p.funcao,
      grupoAnterior: p.grupo,
      funcaoAtual: c.funcao,
      grupoAtual: c.grupo,
      tipoMudanca: suggested.tipo,
      acaoSugerida: suggested.acao,
      suggestedEventType: suggested.eventType,
    });
  }

  return {
    rows,
    functionChanges,
    groupChanges,
    patraoPreviousKey,
    patraoCurrentKey,
    patraoChanged,
  };
}

function classifyChange(
  p: SnapshotPerson,
  c: SnapshotPerson
): { tipo: string; acao: string; eventType?: CasaDoPatraoEventType } {
  const fP = normalizeFuncaoCasaDoPatrao(p.funcao);
  const fC = normalizeFuncaoCasaDoPatrao(c.funcao);

  if (c.grupo === 'FORA_DO_JOGO') {
    return {
      tipo: 'FORA_DO_JOGO',
      acao: 'Marcar como fora do jogo (uma vez no histórico).',
      eventType: 'LEFT_GAME',
    };
  }

  if (p.grupo === 'CASA_DO_TRAMPO' && c.grupo === 'CASA_DO_PATRAO' && isParcaRole(fC)) {
    return {
      tipo: 'PROMOÇÃO_TRAMPO_PARÇA',
      acao: 'Contar promoção Trampo → Parça.',
      eventType: 'PROMOTED_TRAMPO_TO_PARCA',
    };
  }

  if (
    (p.grupo === 'CASA_DO_PATRAO' || p.grupo === 'FORA_DO_JOGO') &&
    c.grupo === 'CASA_DO_TRAMPO'
  ) {
    return {
      tipo: 'MOVIMENTO_PARA_TRAMPO',
      acao: 'Contar entrada no Trampo no ciclo (se ainda não contou).',
      eventType: 'MOVED_TO_TRAMPO',
    };
  }

  if (p.grupo === 'CASA_DO_TRAMPO' && c.grupo === 'CASA_DO_TRAMPO' && fP !== fC) {
    return {
      tipo: 'TROCA_FUNCAO_TRAMPO',
      acao: 'Somar contador da função destino (confirmar editorial).',
      eventType: 'TRAMPO_FUNCTION_CHANGED',
    };
  }

  if (p.grupo === 'CASA_DO_PATRAO' && c.grupo === 'CASA_DO_PATRAO' && (fP !== fC || isPatraoRole(fP) !== isPatraoRole(fC) || isParcaRole(fP) !== isParcaRole(fC))) {
    return {
      tipo: 'MUDANCA_PATROA_PARÇA',
      acao: 'Atualizar papéis na Casa do Patrão.',
      eventType: 'PATRON_GROUP_ROLE_CHANGED',
    };
  }

  return {
    tipo: 'MUDANCA_GERAL',
    acao: 'Revisar manualmente antes de confirmar.',
  };
}

export function detectCasaDoPatraoSuggestedAction(
  diff: CasaDoPatraoDiffResult,
  hasLastCycle: boolean,
  currentSnapshotNonEmpty: boolean
): CasaDoPatraoSuggestedAction {
  if (!currentSnapshotNonEmpty) {
    return 'SEM_MUDANCAS';
  }
  if (!hasLastCycle) {
    return diff.rows.length === 0 ? 'SEM_MUDANCAS' : 'PRIMEIRO_CICLO';
  }

  if (diff.rows.length === 0 && diff.functionChanges === 0 && diff.groupChanges === 0) {
    return 'SEM_MUDANCAS';
  }

  const { patraoChanged, functionChanges, groupChanges } = diff;

  if (patraoChanged && functionChanges >= 4 && groupChanges >= 1) {
    return 'NOVO_CICLO_SUGERIDO';
  }

  if (patraoChanged && functionChanges < 4) {
    return 'ATENCAO';
  }

  if (!patraoChanged && functionChanges > 0) {
    return 'EVENTO_DENTRO_CICLO';
  }

  if (patraoChanged) {
    return 'ATENCAO';
  }

  return 'EVENTO_DENTRO_CICLO';
}

function stableEventId(parts: string[]): string {
  const h = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 12);
  return `evt-sug-${h}`;
}

export function buildSuggestedEventsForDiff(
  diff: CasaDoPatraoDiffResult,
  existingEventKeys: Set<string>,
  cycleId: string
): CasaDoPatraoHistoricoEvent[] {
  const out: CasaDoPatraoHistoricoEvent[] = [];
  const now = new Date().toISOString();

  for (const row of diff.rows) {
    if (!row.suggestedEventType) continue;
    if (row.tipoMudanca === 'REMOVIDO_DO_PRINCIPAL' && row.suggestedEventType !== 'OUT_OF_GAME_DETECTED') {
      continue;
    }

    const id = stableEventId([
      row.suggestedEventType,
      row.participanteKey,
      row.funcaoAnterior ?? '',
      row.funcaoAtual,
      row.grupoAnterior ?? '',
      row.grupoAtual,
    ]);

    const toGrupoMerged =
      row.suggestedEventType === 'OUT_OF_GAME_DETECTED' && row.funcaoAtual === '(removido)'
        ? 'FORA_DO_JOGO'
        : row.grupoAtual;

    const partialEv: CasaDoPatraoHistoricoEvent = {
      id: '',
      type: row.suggestedEventType,
      createdAt: now,
      participanteNome: row.participanteNome,
      participanteKey: row.participanteKey,
      fromFuncao: row.funcaoAnterior,
      toFuncao: row.funcaoAtual === '(removido)' ? null : row.funcaoAtual,
      fromGrupo: row.grupoAnterior,
      toGrupo: toGrupoMerged,
      source: 'suggested_preview',
    };
    const dedupKey = dedupeKeyForEventInCycle(partialEv, cycleId);
    if (existingEventKeys.has(dedupKey)) continue;
    existingEventKeys.add(dedupKey);

    const fromF = row.funcaoAnterior;
    const toF = row.funcaoAtual === '(removido)' ? null : row.funcaoAtual;

    const ev: CasaDoPatraoHistoricoEvent = {
      id,
      type: row.suggestedEventType,
      createdAt: now,
      participanteNome: row.participanteNome,
      participanteKey: row.participanteKey,
      fromFuncao: fromF,
      toFuncao: toF,
      fromGrupo: row.grupoAnterior,
      toGrupo: toGrupoMerged as CasaDoPatraoGrupo | null,
      source: 'suggested_preview',
      applyFunctionCounter: row.suggestedEventType === 'TRAMPO_FUNCTION_CHANGED' ? true : undefined,
    };

    out.push(ev);
  }

  return out;
}

interface CycleDedupeContext {
  countedCasaDoPatrao: Set<string>;
  countedCasaDoTrampo: Set<string>;
  /** No máximo +1 em `patrao` por participante neste ciclo */
  patraoIncremented: Set<string>;
  /** No máximo +1 em `parca` por participante neste ciclo */
  parcaIncremented: Set<string>;
  /** Um contador de poder por participante por ciclo (eventos duplicados ignorados no rebuild) */
  powerVoteOwnerCounted: Set<string>;
  /**
   * Participantes que já receberam +1 em `taNaReta` neste ciclo (TA_NA_RETA ou INDICATED no target).
   * Evita duplicar se ambos os eventos existirem para a mesma pessoa.
   */
  taNaRetaCountedOncePerParticipant: Set<string>;
}

function emptyCycleCtx(): CycleDedupeContext {
  return {
    countedCasaDoPatrao: new Set(),
    countedCasaDoTrampo: new Set(),
    patraoIncremented: new Set(),
    parcaIncremented: new Set(),
    powerVoteOwnerCounted: new Set(),
    taNaRetaCountedOncePerParticipant: new Set(),
  };
}

function ensureParticipant(
  map: Map<string, CasaDoPatraoHistoricoParticipant>,
  key: string,
  nome: string
): CasaDoPatraoHistoricoParticipant {
  let p = map.get(key);
  if (!p) {
    p = {
      nome,
      key,
      statusAtual: 'ATIVO',
      funcaoAtual: '',
      grupoAtual: 'CASA_DO_TRAMPO',
      historico: { ...EMPTY_HISTORICO },
    };
    map.set(key, p);
  }
  return p;
}

function bumpHistorico(h: HistoricoCounters, field: keyof HistoricoCounters, delta: number): void {
  h[field] = (h[field] ?? 0) + delta;
}

export function applyCasaDoPatraoEventToState(
  participants: Map<string, CasaDoPatraoHistoricoParticipant>,
  ev: CasaDoPatraoHistoricoEvent,
  ctx: CycleDedupeContext,
  foraGlobalOnce: Set<string> | null
): void {
  const k = ev.participanteKey;
  const p = ensureParticipant(participants, k, ev.participanteNome);
  const h = p.historico;

  switch (ev.type) {
    case 'CYCLE_INITIAL_ASSIGNMENT': {
      const g = ev.toGrupo ?? 'CASA_DO_TRAMPO';
      const fn = normalizeFuncaoCasaDoPatrao(ev.toFuncao ?? '');
      if (g === 'CASA_DO_PATRAO') {
        if (!ctx.countedCasaDoPatrao.has(k)) {
          ctx.countedCasaDoPatrao.add(k);
          bumpHistorico(h, 'casaDoPatrao', 1);
        }
        if (isPatraoRole(fn) && !ctx.patraoIncremented.has(k)) {
          ctx.patraoIncremented.add(k);
          bumpHistorico(h, 'patrao', 1);
        } else if (isParcaRole(fn) && !ctx.parcaIncremented.has(k)) {
          ctx.parcaIncremented.add(k);
          bumpHistorico(h, 'parca', 1);
        }
      } else if (g === 'CASA_DO_TRAMPO') {
        if (!ctx.countedCasaDoTrampo.has(k)) {
          ctx.countedCasaDoTrampo.add(k);
          bumpHistorico(h, 'casaDoTrampo', 1);
        }
        const ctr = trampoFuncaoToCounterKey(fn);
        if (ctr) bumpHistorico(h, ctr, 1);
      } else if (g === 'FORA_DO_JOGO') {
        if (foraGlobalOnce) {
          if (!foraGlobalOnce.has(k)) {
            foraGlobalOnce.add(k);
            bumpHistorico(h, 'foraDoJogo', 1);
          }
        } else {
          bumpHistorico(h, 'foraDoJogo', 1);
        }
      }
      break;
    }
    case 'PROMOTED_TRAMPO_TO_PARCA': {
      if (!ctx.countedCasaDoPatrao.has(k)) {
        ctx.countedCasaDoPatrao.add(k);
        bumpHistorico(h, 'casaDoPatrao', 1);
      }
      if (!ctx.parcaIncremented.has(k)) {
        ctx.parcaIncremented.add(k);
        bumpHistorico(h, 'parca', 1);
      }
      bumpHistorico(h, 'promovidoDoTrampoParaParca', 1);
      break;
    }
    case 'PROVA_TO_FORA': {
      if (ev.toGrupo !== 'CASA_DO_PATRAO') {
        casaDoPatraoHistoricoWarn('PROVA_TO_FORA: toGrupo deve ser CASA_DO_PATRAO', {
          id: ev.id,
          participanteKey: k,
          toGrupo: ev.toGrupo,
        });
      }
      if (
        ev.fromGrupo != null &&
        ev.fromGrupo !== 'CASA_DO_TRAMPO'
      ) {
        casaDoPatraoHistoricoWarn('PROVA_TO_FORA: fromGrupo esperado CASA_DO_TRAMPO', {
          id: ev.id,
          participanteKey: k,
          fromGrupo: ev.fromGrupo,
        });
      }
      if (ev.toGrupo === 'CASA_DO_PATRAO') {
        if (!ctx.countedCasaDoPatrao.has(k)) {
          ctx.countedCasaDoPatrao.add(k);
          bumpHistorico(h, 'casaDoPatrao', 1);
        }
      }
      bumpHistorico(h, 'promovidoDoTrampoParaPatrao', 1);
      break;
    }
    case 'PROVA_TO_FORA_WINNER': {
      bumpHistorico(h, 'provaToFora', 1);

      if (ev.fromGrupo === 'CASA_DO_TRAMPO') {
        if (!ctx.countedCasaDoTrampo.has(k)) {
          ctx.countedCasaDoTrampo.add(k);
          bumpHistorico(h, 'casaDoTrampo', 1);
        }
        const fromFn = normalizeFuncaoCasaDoPatrao(ev.fromFuncao ?? '');
        const ctr = trampoFuncaoToCounterKey(fromFn);
        if (ctr) {
          bumpHistorico(h, ctr, 1);
        }
      }

      if (ev.toGrupo === 'CASA_DO_PATRAO') {
        if (!ctx.countedCasaDoPatrao.has(k)) {
          ctx.countedCasaDoPatrao.add(k);
          bumpHistorico(h, 'casaDoPatrao', 1);
        }
      }

      const toFn = normalizeFuncaoCasaDoPatrao(ev.toFuncao ?? '');
      if (isPatraoRole(toFn) && !ctx.patraoIncremented.has(k)) {
        ctx.patraoIncremented.add(k);
        bumpHistorico(h, 'patrao', 1);
      } else if (isParcaRole(toFn) && !ctx.parcaIncremented.has(k)) {
        ctx.parcaIncremented.add(k);
        bumpHistorico(h, 'parca', 1);
      }

      break;
    }
    case 'MOVED_TO_TRAMPO': {
      if (!ctx.countedCasaDoTrampo.has(k)) {
        ctx.countedCasaDoTrampo.add(k);
        bumpHistorico(h, 'casaDoTrampo', 1);
      }
      const fn = normalizeFuncaoCasaDoPatrao(ev.toFuncao ?? '');
      const ctr = trampoFuncaoToCounterKey(fn);
      if (ctr) bumpHistorico(h, ctr, 1);
      break;
    }
    case 'TRAMPO_FUNCTION_CHANGED': {
      if (ev.applyFunctionCounter !== false) {
        const fn = normalizeFuncaoCasaDoPatrao(ev.toFuncao ?? '');
        const ctr = trampoFuncaoToCounterKey(fn);
        if (ctr) bumpHistorico(h, ctr, 1);
      }
      break;
    }
    case 'PATRON_GROUP_ROLE_CHANGED': {
      const fn = normalizeFuncaoCasaDoPatrao(ev.toFuncao ?? '');
      if (isPatraoRole(fn) && !ctx.patraoIncremented.has(k)) {
        ctx.patraoIncremented.add(k);
        bumpHistorico(h, 'patrao', 1);
      } else if (isParcaRole(fn) && !ctx.parcaIncremented.has(k)) {
        ctx.parcaIncremented.add(k);
        bumpHistorico(h, 'parca', 1);
      }
      break;
    }
    case 'LEFT_GAME':
    case 'OUT_OF_GAME_DETECTED': {
      if (foraGlobalOnce) {
        if (!foraGlobalOnce.has(k)) {
          foraGlobalOnce.add(k);
          bumpHistorico(h, 'foraDoJogo', 1);
        }
      } else {
        bumpHistorico(h, 'foraDoJogo', 1);
      }
      break;
    }
    case 'NEW_PARTICIPANT_DETECTED': {
      break;
    }
    case 'POWER_VOTE_OWNER': {
      if (!ctx.powerVoteOwnerCounted.has(k)) {
        ctx.powerVoteOwnerCounted.add(k);
        bumpHistorico(h, 'poderDoVoto', 1);
        console.log(`${LOG_PREFIX} rebuild_power_vote_owner`, {
          participanteKey: k,
          applied: true,
        });
      } else {
        console.warn(`${LOG_PREFIX} special_event_duplicate_ignored`, {
          type: 'POWER_VOTE_OWNER',
          participanteKey: k,
        });
      }
      break;
    }
    case 'TA_NA_RETA': {
      if (!ctx.taNaRetaCountedOncePerParticipant.has(k)) {
        ctx.taNaRetaCountedOncePerParticipant.add(k);
        bumpHistorico(h, 'taNaReta', 1);
        console.log(`${LOG_PREFIX} rebuild_ta_na_reta`, {
          type: 'TA_NA_RETA',
          participanteKey: k,
          applied: true,
        });
      } else {
        console.warn(`${LOG_PREFIX} special_event_ta_na_reta_duplicate_ignored`, {
          type: 'TA_NA_RETA',
          participanteKey: k,
        });
      }
      break;
    }
    case 'INDICATED_TO_TA_NA_RETA': {
      const tkRaw = ev.targetParticipanteKey?.trim();
      const targetKey =
        tkRaw && tkRaw.length > 0 ? tkRaw : ev.participanteKey;
      const tnRaw = ev.targetParticipanteNome?.trim();
      const targetNome =
        tnRaw && tnRaw.length > 0 ? tnRaw : targetKey;

      const tp = ensureParticipant(participants, targetKey, targetNome);
      if (!ctx.taNaRetaCountedOncePerParticipant.has(targetKey)) {
        ctx.taNaRetaCountedOncePerParticipant.add(targetKey);
        bumpHistorico(tp.historico, 'taNaReta', 1);
        console.log(`${LOG_PREFIX} rebuild_ta_na_reta`, {
          type: 'INDICATED_TO_TA_NA_RETA',
          targetParticipanteKey: targetKey,
          indicadorParticipanteKey: k,
          applied: true,
        });
      } else {
        console.warn(`${LOG_PREFIX} special_event_ta_na_reta_duplicate_ignored`, {
          type: 'INDICATED_TO_TA_NA_RETA',
          targetParticipanteKey: targetKey,
        });
      }
      break;
    }
    default:
      break;
  }
}

export function rebuildCasaDoPatraoHistorico(history: CasaDoPatraoHistorico): CasaDoPatraoHistorico {
  const participants = new Map<string, CasaDoPatraoHistoricoParticipant>();
  const foraGlobalOnce = new Set<string>();

  const sortedCycles = [...history.cycles].sort((a, b) => a.numero - b.numero);

  for (const cycle of sortedCycles) {
    if (cycle.isPlaceholder) {
      if (cycle.events.length > 0) {
        casaDoPatraoHistoricoWarn(
          `Placeholder ${cycle.id} deve manter events: [] (ígnorados no replay; confirme o JSON antes de publicar).`,
          { discardedEventCount: cycle.events.length }
        );
      }
      continue;
    }
    const ctx = emptyCycleCtx();
    const events = [...cycle.events].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    for (const ev of events) {
      applyCasaDoPatraoEventToState(participants, ev, ctx, foraGlobalOnce);
    }
  }

  const active = history.cycles.find((c) => c.status === 'ATIVO');
  if (active?.snapshot?.length) {
    for (const s of active.snapshot) {
      const p = ensureParticipant(participants, s.key, s.nome);
      p.nome = s.nome;
      p.funcaoAtual = s.funcao;
      p.grupoAtual = s.grupo;
      p.statusAtual = s.statusAtual;
    }
  }

  const list = Array.from(participants.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR')
  );

  return {
    ...history,
    updatedAt: new Date().toISOString(),
    participants: list,
  };
}

export function createEmptyHistorico(): CasaDoPatraoHistorico {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    currentCycleId: null,
    cycles: [],
    participants: [],
  };
}

/** Ciclos que contam como semana oficial (para numeração e diff). */
export function officialCyclesOnly(cycles: CasaDoPatraoCycle[]): CasaDoPatraoCycle[] {
  return cycles.filter((c) => !c.isPlaceholder);
}

/**
 * Ciclo único ATIVO, se existir (inclui placeholder).
 */
export function getActiveCycle(history: CasaDoPatraoHistorico): CasaDoPatraoCycle | null {
  return history.cycles.find((c) => c.status === 'ATIVO') ?? null;
}

/**
 * Base para preview/diff do JSON ao vivo vs último estado “oficial”.
 * — Se o ATIVo for ciclo real, devolve esse ciclo (snapshot da semana corrente).
 * — Se o ATIVo for placeholder, devolve o último ciclo não-placeholder (última semana real fechada ou actividade).
 */
export function getReferenceCycle(history: CasaDoPatraoHistorico): CasaDoPatraoCycle | null {
  if (!history.cycles.length) return null;
  const active = history.cycles.find((c) => c.status === 'ATIVO');
  if (active && !active.isPlaceholder) {
    return active;
  }
  const officials = officialCyclesOnly(history.cycles);
  if (!officials.length) {
    return active ?? null;
  }
  return [...officials].sort((a, b) => b.numero - a.numero)[0];
}

/** Próximo `numero` e `id` para uma nova semana oficial (ignora placeholders na contagem). */
export function nextOfficialCycleSpec(cycles: CasaDoPatraoCycle[]): { id: string; numero: number } {
  const o = officialCyclesOnly(cycles);
  const numero = o.length === 0 ? 1 : Math.max(...o.map((c) => c.numero)) + 1;
  return { id: `ciclo-${String(numero).padStart(3, '0')}`, numero };
}

export function nextCycleId(cycles: CasaDoPatraoCycle[]): string {
  return nextOfficialCycleSpec(cycles).id;
}

function applySnapshotOverlayToParticipants(
  participants: CasaDoPatraoHistoricoParticipant[],
  snapshot: SnapshotPerson[] | null
): CasaDoPatraoHistoricoParticipant[] {
  if (!snapshot?.length) return participants;
  const byKey = new Map(participants.map((p) => [p.key, p]));
  for (const s of snapshot) {
    const p = byKey.get(s.key);
    if (!p) continue;
    p.nome = s.nome;
    p.funcaoAtual = s.funcao;
    p.grupoAtual = s.grupo;
    p.statusAtual = s.statusAtual;
  }
  return participants;
}

/**
 * Versão pública (mobile-safe) do histórico:
 * - remove ciclos placeholder
 * - garante `currentCycleId` não apontando para placeholder
 * - evita expor `funcaoAtual/grupoAtual/statusAtual` derivados de snapshot placeholder
 *   (usa snapshot do último ciclo oficial disponível).
 */
export function buildCasaDoPatraoHistoricoPublicJson(
  history: CasaDoPatraoHistorico
): CasaDoPatraoHistorico & {
  publicGeneratedAt: string;
  publicCurrentCycleId: string | null;
  hasAdminPlaceholder: boolean;
  adminCurrentCycleId: string | null;
} {
  const now = new Date().toISOString();
  const hasAdminPlaceholder = history.cycles.some((c) => c.isPlaceholder);

  const officialCycles = officialCyclesOnly(history.cycles).map((c) => {
    const { isPlaceholder, placeholderNote, ...rest } = c;
    return rest;
  });

  const officialActive = officialCycles.find((c) => c.status === 'ATIVO') ?? null;
  const lastOfficial =
    officialCycles.length > 0 ? [...officialCycles].sort((a, b) => b.numero - a.numero)[0] : null;

  const publicCurrentCycleId = officialActive?.id ?? lastOfficial?.id ?? null;

  // Evita vazamento de “estado atual” vindo de placeholder: reaplica snapshot do ciclo oficial escolhido.
  const snapshotForPublic = officialActive?.snapshot ?? lastOfficial?.snapshot ?? null;
  const participants = applySnapshotOverlayToParticipants(
    history.participants.map((p) => ({ ...p, historico: { ...p.historico } })),
    snapshotForPublic
  );

  return {
    ...(history as CasaDoPatraoHistorico),
    cycles: officialCycles,
    currentCycleId: publicCurrentCycleId,
    participants,
    publicGeneratedAt: now,
    publicCurrentCycleId,
    hasAdminPlaceholder,
    adminCurrentCycleId: history.currentCycleId,
  };
}

export function applyCasaDoPatraoCycle(
  history: CasaDoPatraoHistorico,
  opts: {
    snapshot: SnapshotPerson[];
    patraoNome: string;
    patraoKey: string;
    participantesUpdatedAt: string | null;
    barraUpdatedAt: string | null;
  }
): CasaDoPatraoHistorico {
  const now = new Date().toISOString();
  const active = history.cycles.find((c) => c.status === 'ATIVO');

  if (active?.isPlaceholder) {
    if (active.events.length > 0) {
      casaDoPatraoHistoricoWarn(
        `Ao converter placeholder ${active.id}: events existentes (${active.events.length}) serão descartadas e substituídas pelo snapshot confirmado.`,
        undefined
      );
    }
    const id = active.id;
    const events: CasaDoPatraoHistoricoEvent[] = opts.snapshot.map((s) => ({
      id: stableEventId(['cia', id, s.key, s.funcao, s.grupo]),
      type: 'CYCLE_INITIAL_ASSIGNMENT' as const,
      createdAt: now,
      participanteNome: s.nome,
      participanteKey: s.key,
      fromFuncao: null,
      toFuncao: s.funcao,
      fromGrupo: null,
      toGrupo: s.grupo,
      source: 'admin_confirmed',
    }));

    const replaced: CasaDoPatraoCycle = {
      id: active.id,
      numero: active.numero,
      status: 'ATIVO',
      createdAt: active.createdAt,
      confirmedAt: now,
      patraoNome: opts.patraoNome,
      patraoKey: opts.patraoKey,
      source: {
        participantesUpdatedAt: opts.participantesUpdatedAt,
        barraUpdatedAt: opts.barraUpdatedAt,
      },
      snapshot: opts.snapshot,
      events,
    };

    const cycles = history.cycles.map((c) => (c.id === id ? replaced : c));
    console.log(`${LOG_PREFIX} placeholder_cycle_replaced_with_official_week`, {
      cycleId: id,
      numero: active.numero,
    });
    return rebuildCasaDoPatraoHistorico({
      ...history,
      cycles,
      currentCycleId: id,
      updatedAt: now,
    });
  }

  const { id, numero } = nextOfficialCycleSpec(history.cycles);

  const closedCycles = history.cycles.map((c) =>
    c.status === 'ATIVO' ? { ...c, status: 'CONCLUIDO' as const } : c
  );

  const events: CasaDoPatraoHistoricoEvent[] = opts.snapshot.map((s) => ({
    id: stableEventId(['cia', id, s.key, s.funcao, s.grupo]),
    type: 'CYCLE_INITIAL_ASSIGNMENT' as const,
    createdAt: now,
    participanteNome: s.nome,
    participanteKey: s.key,
    fromFuncao: null,
    toFuncao: s.funcao,
    fromGrupo: null,
    toGrupo: s.grupo,
    source: 'admin_confirmed',
  }));

  const newCycle: CasaDoPatraoCycle = {
    id,
    numero,
    status: 'ATIVO',
    createdAt: now,
    confirmedAt: now,
    patraoNome: opts.patraoNome,
    patraoKey: opts.patraoKey,
    source: {
      participantesUpdatedAt: opts.participantesUpdatedAt,
      barraUpdatedAt: opts.barraUpdatedAt,
    },
    snapshot: opts.snapshot,
    events,
  };

  const next: CasaDoPatraoHistorico = {
    ...history,
    currentCycleId: id,
    cycles: [...closedCycles, newCycle],
    updatedAt: now,
  };

  return rebuildCasaDoPatraoHistorico(next);
}

export function applyCasaDoPatraoEvents(
  history: CasaDoPatraoHistorico,
  newEvents: CasaDoPatraoHistoricoEvent[],
  activeCycleId: string
): CasaDoPatraoHistorico {
  const now = new Date().toISOString();
  const cycles = history.cycles.map((c) => {
    if (c.id !== activeCycleId) return c;
    const withIds = newEvents.map((ev, i) => ({
      ...ev,
      id: `evt-cfm-${Date.now()}-${i}-${ev.participanteKey}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: ev.createdAt || now,
      source: 'admin_confirmed',
    }));
    return { ...c, events: [...c.events, ...withIds] };
  });

  const next: CasaDoPatraoHistorico = {
    ...history,
    cycles,
    updatedAt: now,
  };

  return rebuildCasaDoPatraoHistorico(next);
}

/**
 * Identifica evento já aplicado no ciclo. Para TRAMPO_FUNCTION_CHANGED inclui origem/destino,
 * para permitir várias trocas no mesmo ciclo sem colidir com a chave `tipo + participante`.
 */
export function dedupeKeyForEvent(ev: CasaDoPatraoHistoricoEvent): string {
  if (ev.type === 'TRAMPO_FUNCTION_CHANGED') {
    return `${ev.type}:${ev.participanteKey}:${ev.fromFuncao ?? ''}:${ev.toFuncao ?? ''}`;
  }
  return `${ev.type}:${ev.participanteKey}`;
}

/**
 * Chave de dedupe dentro de um ciclo. Eventos especiais (poder / Tá na Reta) incluem `cycleId`.
 */
export function dedupeKeyForEventInCycle(ev: CasaDoPatraoHistoricoEvent, cycleId: string): string {
  if (ev.type === 'POWER_VOTE_OWNER') {
    return `POWER_VOTE_OWNER:${cycleId}:${ev.participanteKey}`;
  }
  if (ev.type === 'TA_NA_RETA') {
    return `TA_NA_RETA:${cycleId}:${ev.participanteKey}`;
  }
  if (ev.type === 'INDICATED_TO_TA_NA_RETA') {
    const tk =
      ev.targetParticipanteKey != null && ev.targetParticipanteKey.trim() !== ''
        ? ev.targetParticipanteKey.trim()
        : ev.participanteKey;
    return `INDICATED_TO_TA_NA_RETA:${cycleId}:${tk}`;
  }
  return dedupeKeyForEvent(ev);
}

export function existingDedupeKeysForCycle(cycle: CasaDoPatraoCycle | null): Set<string> {
  const s = new Set<string>();
  if (!cycle) return s;
  const cid = cycle.id;
  for (const ev of cycle.events) {
    s.add(dedupeKeyForEventInCycle(ev, cid));
  }
  return s;
}

/**
 * Para cada participante na barra com função «PODER DO VOTO», acrescenta `POWER_VOTE_OWNER`
 * ao ciclo **ATIVO** não-placeholder apenas se já não existir o mesmo dedupe neste ciclo
 * (inclui dono já registado manualmente ou pela API — não duplica).
 */
export function injectBarraPowerVoteOwnerEventsIfMissing(
  history: CasaDoPatraoHistorico,
  barra: RawParticipante[]
): { next: CasaDoPatraoHistorico; insertedParticipantKeys: string[] } {
  const insertedParticipantKeys: string[] = [];
  const active = history.cycles.find((c) => c.status === 'ATIVO' && !c.isPlaceholder);
  if (!active || barra.length === 0) {
    return { next: history, insertedParticipantKeys };
  }

  const existing = existingDedupeKeysForCycle(active);
  const now = new Date().toISOString();
  const toAppend: CasaDoPatraoHistoricoEvent[] = [];
  let barraPdVSeq = 0;

  for (const p of barra) {
    if (!isPoderDoVotoFuncao(normalizeFuncaoCasaDoPatrao(p.funcao ?? ''))) continue;

    const nome = (p.nome ?? '').trim();
    const key = normalizeCasaDoPatraoKey(nome);
    if (!key) continue;

    const dk = `POWER_VOTE_OWNER:${active.id}:${key}`;
    if (existing.has(dk)) continue;
    existing.add(dk);

    barraPdVSeq += 1;
    toAppend.push({
      id: `evt-barra-pdv-${createHash('sha256')
        .update(`${now}:${active.id}:${key}:${barraPdVSeq}`)
        .digest('hex')
        .slice(0, 16)}`,
      type: 'POWER_VOTE_OWNER',
      createdAt: now,
      participanteNome: nome || key,
      participanteKey: key,
      fromFuncao: null,
      toFuncao: null,
      fromGrupo: null,
      toGrupo: null,
      source: 'barra_participantes_json',
      note: 'Sincronizado a partir de «PODER DO VOTO» em casa-do-patrao-participantes-barra.json',
    });
    insertedParticipantKeys.push(key);
  }

  if (toAppend.length === 0) {
    return { next: history, insertedParticipantKeys: [] };
  }

  const cycles = history.cycles.map((c) =>
    c.id === active.id ? { ...c, events: [...c.events, ...toAppend] } : c
  );

  return {
    next: {
      ...history,
      cycles,
      updatedAt: now,
    },
    insertedParticipantKeys,
  };
}

/**
 * Para cada participante na barra com função «TÁ NA RETA», acrescenta `TA_NA_RETA`
 * ao ciclo **ATIVO** não-placeholder apenas se ainda não existir dedupe neste ciclo.
 */
export function injectBarraTaNaRetaEventsIfMissing(
  history: CasaDoPatraoHistorico,
  barra: RawParticipante[]
): { next: CasaDoPatraoHistorico; insertedParticipantKeys: string[] } {
  const insertedParticipantKeys: string[] = [];
  const active = history.cycles.find((c) => c.status === 'ATIVO' && !c.isPlaceholder);
  if (!active || barra.length === 0) {
    return { next: history, insertedParticipantKeys };
  }

  const existing = existingDedupeKeysForCycle(active);
  const now = new Date().toISOString();
  const toAppend: CasaDoPatraoHistoricoEvent[] = [];
  let barraTnRSeq = 0;

  for (const p of barra) {
    if (!isTaNaRetaBarraFuncao(normalizeFuncaoCasaDoPatrao(p.funcao ?? ''))) continue;

    const nome = (p.nome ?? '').trim();
    const key = normalizeCasaDoPatraoKey(nome);
    if (!key) continue;

    const dk = `TA_NA_RETA:${active.id}:${key}`;
    if (existing.has(dk)) continue;
    existing.add(dk);

    barraTnRSeq += 1;
    toAppend.push({
      id: `evt-barra-tnr-${createHash('sha256')
        .update(`${now}:${active.id}:${key}:${barraTnRSeq}`)
        .digest('hex')
        .slice(0, 16)}`,
      type: 'TA_NA_RETA',
      createdAt: now,
      participanteNome: nome || key,
      participanteKey: key,
      fromFuncao: null,
      toFuncao: null,
      fromGrupo: null,
      toGrupo: null,
      source: 'barra_participantes_json',
      note: 'Sincronizado a partir de «TÁ NA RETA» em casa-do-patrao-participantes-barra.json',
    });
    insertedParticipantKeys.push(key);
  }

  if (toAppend.length === 0) {
    return { next: history, insertedParticipantKeys: [] };
  }

  const cycles = history.cycles.map((c) =>
    c.id === active.id ? { ...c, events: [...c.events, ...toAppend] } : c
  );

  return {
    next: {
      ...history,
      cycles,
      updatedAt: now,
    },
    insertedParticipantKeys,
  };
}
