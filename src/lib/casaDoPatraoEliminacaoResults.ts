export const DEFAULT_CASA_DO_PATRAO_ELIMINACAO_RESULTS = {
  version: 1,
  updatedAt: '',
  eliminacoes: [],
};

export function stringifyDefaultCasaDoPatraoEliminacaoResults(): string {
  return JSON.stringify(DEFAULT_CASA_DO_PATRAO_ELIMINACAO_RESULTS, null, 2);
}

const STATUS_SALVO = new Set(['SALVO', 'SALVA']);

function validateEliminacaoItem(value: unknown, index: number): string | null {
  const prefix = `eliminacoes[${index}]`;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return `"${prefix}" precisa ser um objeto.`;
  }
  const data = value as Record<string, unknown>;

  if (typeof data.id !== 'string' || !data.id.trim()) {
    return `"${prefix}.id" é obrigatório.`;
  }
  if (typeof data.data !== 'string' || !data.data.trim()) {
    return `"${prefix}.data" é obrigatório.`;
  }
  if (typeof data.titulo !== 'string' || !data.titulo.trim()) {
    return `"${prefix}.titulo" é obrigatório.`;
  }
  if (typeof data.subtitulo !== 'string' || !data.subtitulo.trim()) {
    return `"${prefix}.subtitulo" é obrigatório.`;
  }
  if (data.tipoVotacao !== 'FICAR') {
    return `"${prefix}.tipoVotacao" precisa ser "FICAR".`;
  }
  if (data.objetivoVotacao !== 'FICAR') {
    return `"${prefix}.objetivoVotacao" precisa ser "FICAR".`;
  }
  if (data.resultadoOficial !== 'ELIMINACAO') {
    return `"${prefix}.resultadoOficial" precisa ser "ELIMINACAO".`;
  }

  if (!Array.isArray(data.resultados) || data.resultados.length === 0) {
    return `"${prefix}.resultados" precisa ser um array com pelo menos um item.`;
  }

  const idsResultado = new Set<string>();

  for (let j = 0; j < data.resultados.length; j++) {
    const r = data.resultados[j];
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      return `"${prefix}.resultados[${j}]" precisa ser um objeto.`;
    }
    const row = r as Record<string, unknown>;
    if (typeof row.id !== 'string' || !row.id.trim()) {
      return `"${prefix}.resultados[${j}].id" é obrigatório.`;
    }
    const rid = row.id.trim();
    if (idsResultado.has(rid)) {
      return `"${prefix}.resultados": id duplicado "${rid}".`;
    }
    idsResultado.add(rid);

    if (typeof row.name !== 'string' || !row.name.trim()) {
      return `"${prefix}.resultados[${j}].name" é obrigatório.`;
    }
    if (typeof row.media !== 'number' || !Number.isFinite(row.media)) {
      return `"${prefix}.resultados[${j}].media" precisa ser numérico.`;
    }
    if (typeof row.status !== 'string' || !row.status.trim()) {
      return `"${prefix}.resultados[${j}].status" é obrigatório.`;
    }
  }

  const eliminados = (data.resultados as Record<string, unknown>[]).filter(
    row => row.status === 'ELIMINADO'
  );
  if (eliminados.length !== 1) {
    return `"${prefix}.resultados": deve existir exatamente um participante com status "ELIMINADO" (encontrado: ${eliminados.length}).`;
  }

  for (const row of data.resultados as Record<string, unknown>[]) {
    if (row.status === 'ELIMINADO') continue;
    const st = typeof row.status === 'string' ? row.status.trim() : '';
    if (!STATUS_SALVO.has(st)) {
      return `"${prefix}.resultados": participantes não eliminados devem ter status "SALVO" ou "SALVA" (recebido: "${row.status}").`;
    }
  }

  const medias = (data.resultados as { media: number }[]).map(x => x.media);
  const minMedia = Math.min(...medias);
  const elim = eliminados[0] as { media: number };
  if (elim.media !== minMedia) {
    return `"${prefix}.resultados": o eliminado deve ser quem tem a menor "media" (voto para ficar).`;
  }

  return null;
}

/**
 * Valida o arquivo público de eliminações (formato alinhado a paredao-results, votação FICAR).
 */
export function validateCasaDoPatraoEliminacaoResultsJson(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'O JSON raiz precisa ser um objeto.';
  }

  const root = value as Record<string, unknown>;

  if (
    typeof root.version !== 'number' ||
    !Number.isFinite(root.version) ||
    !Number.isInteger(root.version) ||
    root.version < 1
  ) {
    return 'Campo "version" precisa ser um número inteiro >= 1.';
  }

  if (typeof root.updatedAt !== 'string') {
    return 'Campo "updatedAt" precisa ser string (ISO; no salvamento o servidor preenche a data).';
  }

  if (!Array.isArray(root.eliminacoes)) {
    return 'Campo "eliminacoes" deve ser um array.';
  }

  const eliminacaoIds = new Set<string>();

  for (let i = 0; i < root.eliminacoes.length; i++) {
    const itemErr = validateEliminacaoItem(root.eliminacoes[i], i);
    if (itemErr) return itemErr;

    const item = root.eliminacoes[i] as Record<string, unknown>;
    const eid = (item.id as string).trim();
    if (eliminacaoIds.has(eid)) {
      return `Duplicidade: duas eliminações com o mesmo "id" (${eid}).`;
    }
    eliminacaoIds.add(eid);
  }

  return null;
}
