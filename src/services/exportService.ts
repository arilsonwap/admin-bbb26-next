import {
  AdminDatabase,
  BBB26Export,
  ParticipantsStatusExport,
  ParedaoResultsExport,
} from '../models/types';
import JSZip from 'jszip';

// Sistema de erros tipados para importação BBB26
export enum BBB26ImportErrorCode {
  INVALID_SEASON = 'INVALID_SEASON',
  UNSUPPORTED_SCHEMA = 'UNSUPPORTED_SCHEMA',
  INVALID_STRUCTURE = 'INVALID_STRUCTURE',
  INVALID_TYPES = 'INVALID_TYPES',
  MISSING_FIELDS = 'MISSING_FIELDS',
  INVALID_HIGHLIGHT = 'INVALID_HIGHLIGHT',
  INVALID_PAREDAO_SLOT = 'INVALID_PAREDAO_SLOT',
  DUPLICATE_IMPORT = 'DUPLICATE_IMPORT',
  FILE_READ_ERROR = 'FILE_READ_ERROR'
}

export enum BBB26ImportMode {
  STRICT = 'STRICT',     // Fail-fast estrito (padrão)
  LENIENT = 'LENIENT'    // Tenta normalizar pequenos desvios
}

export class BBB26ImportError extends Error {
  public readonly code: BBB26ImportErrorCode;
  public readonly userMessage: string;
  public readonly details: any;
  public readonly fieldPath?: string; // Path granular (ex: highlights[2].id)

  constructor(code: BBB26ImportErrorCode, userMessage: string, details: any = null, fieldPath?: string) {
    super(userMessage);
    this.name = 'BBB26ImportError';
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
    this.fieldPath = fieldPath;
  }
}

// Sistema de fieldPath para validação granular
class FieldPathBuilder {
  private path: string[] = [];

  push(segment: string | number): FieldPathBuilder {
    this.path.push(segment.toString());
    return this;
  }

  pop(): FieldPathBuilder {
    this.path.pop();
    return this;
  }

  toString(): string {
    return this.path.join('.').replace(/\.\[/g, '[');
  }

  clone(): FieldPathBuilder {
    const clone = new FieldPathBuilder();
    clone.path = [...this.path];
    return clone;
  }
}

// Exportar para bbb26.json
export const exportToBBB26 = (database: AdminDatabase): BBB26Export => {
  const now = new Date().toISOString();

  return {
    schemaVersion: 1,
    season: database.season,
    updatedAt: now,
    highlights: database.currentWeek.highlights,
    paredao: database.currentWeek.paredao,
    paredaoState: database.currentWeek.paredaoState,
    votingStatus: database.currentWeek.votingStatus,
  };
};

// Exportar para participants-status.json
export const exportToParticipantsStatus = (database: AdminDatabase): ParticipantsStatusExport => {
  const now = new Date().toISOString();

  const participants: Record<string, { status: "ATIVO" | "ELIMINADO" | "DESCLASSIFICADO" }> = {};
  Object.values(database.participants).forEach((participant) => {
    participants[participant.id] = {
      status: participant.status,
    };
  });

  return {
    version: database.version,
    updatedAt: now,
    participants,
  };
};

// Exportar para paredao-results.json
export const exportToParedaoResults = (database: AdminDatabase): ParedaoResultsExport => {
  const now = new Date().toISOString();

  const paredoes = database.history.paredoes.map((paredao) => ({
    id: paredao.id,
    data: paredao.date,
    titulo: paredao.title,
    subtitulo: paredao.subtitle || '',
    resultados: paredao.results.map((result) => {
      const participant = database.participants[result.participantId];
      return {
        id: result.participantId,
        name: participant?.name || result.participantId,
        media: result.media,
        status: result.status,
      };
    }),
  }));

  return {
    version: database.version,
    updatedAt: now,
    paredoes,
  };
};

// Função principal para exportar todos os arquivos
export const exportAllFiles = (database: AdminDatabase) => {
  return {
    bbb26: exportToBBB26(database),
    participantsStatus: exportToParticipantsStatus(database),
    paredaoResults: exportToParedaoResults(database),
  };
};

// Utilitários para formatação
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatJSON = (data: any): string => {
  return JSON.stringify(data, null, 2);
};

export const validateExportData = (data: any): boolean => {
  try {
    JSON.stringify(data);
    return true;
  } catch {
    return false;
  }
};

// Função para download de arquivo via browser
export const downloadFile = (filename: string, content: string, mimeType = 'application/json') => {
  if (typeof window === 'undefined') return; // Server-side guard

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

// Função para copiar para clipboard
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Erro ao copiar para clipboard:', error);
    return false;
  }
};

// Exportar arquivo individual
export const exportFile = (filename: string, data: any) => {
  const jsonString = formatJSON(data);
  downloadFile(filename, jsonString);
};

// Exportar todos os arquivos individualmente (modo legacy)
export const exportAllFilesToDownload = (database: AdminDatabase) => {
  const files = exportAllFiles(database);

  // Pequeno delay entre downloads para evitar conflitos
  setTimeout(() => exportFile('bbb26.json', files.bbb26), 100);
  setTimeout(() => exportFile('participants-status.json', files.participantsStatus), 300);
  setTimeout(() => exportFile('paredao-results.json', files.paredaoResults), 500);
};

// Opções de export flexíveis
export interface ExportOptions {
  includeBbb26: boolean;
  includeParticipants: boolean;
  includeParedao: boolean;
  format: 'zip' | 'individual' | 'copy';
  includeReadme: boolean;
}

// Export flexível com múltiplas opções
export const exportFlexible = async (
  database: AdminDatabase,
  options: ExportOptions
): Promise<void> => {
  const files = exportAllFiles(database);
  const selectedFiles: { name: string; content: string }[] = [];

  // Coletar arquivos selecionados
  if (options.includeBbb26) {
    selectedFiles.push({
      name: 'bbb26.json',
      content: formatJSON(files.bbb26)
    });
  }

  if (options.includeParticipants) {
    selectedFiles.push({
      name: 'participants-status.json',
      content: formatJSON(files.participantsStatus)
    });
  }

  if (options.includeParedao) {
    selectedFiles.push({
      name: 'paredao-results.json',
      content: formatJSON(files.paredaoResults)
    });
  }

  if (selectedFiles.length === 0) {
    throw new Error('Nenhum arquivo selecionado para exportar');
  }

  // Executar export baseado no formato
  switch (options.format) {
    case 'zip':
      await exportAsZip(selectedFiles, database, options.includeReadme);
      break;
    case 'individual':
      exportIndividualFiles(selectedFiles);
      break;
    case 'copy':
      await copyMultipleFilesToClipboard(selectedFiles);
      break;
  }
};

// Função auxiliar para export como ZIP
const exportAsZip = async (
  files: { name: string; content: string }[],
  database: AdminDatabase,
  includeReadme: boolean
): Promise<void> => {
  if (typeof window === 'undefined') return;

  const zip = new JSZip();

  // Adicionar arquivos selecionados
  files.forEach(file => {
    zip.file(file.name, file.content);
  });

  // Adicionar README se solicitado
  if (includeReadme) {
    const readme = generateReadme(database);
    zip.file('README.txt', readme);
  }

  // Gerar e baixar ZIP
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `bbb26-export-${dateStr}.zip`;
  downloadBlob(filename, zipBlob, 'application/zip');
};

// Função auxiliar para export individual
const exportIndividualFiles = (files: { name: string; content: string }[]): void => {
  files.forEach((file, index) => {
    setTimeout(() => {
      downloadFile(file.name, file.content);
    }, index * 200); // 200ms de delay entre downloads
  });
};

// Função auxiliar para copiar múltiplos arquivos para clipboard
const copyMultipleFilesToClipboard = async (files: { name: string; content: string }[]): Promise<void> => {
  if (files.length === 1) {
    // Copiar apenas um arquivo
    await navigator.clipboard.writeText(files[0].content);
  } else {
    // Copiar múltiplos arquivos como texto formatado
    const combined = files
      .map(file => `=== ${file.name} ===\n${file.content}`)
      .join('\n\n');
    await navigator.clipboard.writeText(combined);
  }
};

// ========== FUNÇÕES DE EXPORT PROFISSIONAL ==========

// Exportar todos os arquivos como ZIP profissional
export const exportAllFilesAsZip = async (database: AdminDatabase): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    const zip = new JSZip();

    // Obter dados de todos os arquivos
    const files = exportAllFiles(database);

    // Adicionar arquivos ao ZIP
    zip.file('bbb26.json', formatJSON(files.bbb26));
    zip.file('participants-status.json', formatJSON(files.participantsStatus));
    zip.file('paredao-results.json', formatJSON(files.paredaoResults));

    // Adicionar arquivo README
    const readme = generateReadme(database);
    zip.file('README.txt', readme);

    // Gerar o ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Criar nome do arquivo com data
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `bbb26-export-${dateStr}.zip`;

    // Download do arquivo ZIP
    downloadBlob(filename, zipBlob, 'application/zip');

  } catch (error) {
    console.error('Erro ao criar arquivo ZIP:', error);
    throw new Error('Falha ao exportar dados como ZIP');
  }
};

// Função auxiliar para download de blob
const downloadBlob = (filename: string, blob: Blob, mimeType: string) => {
  if (typeof window === 'undefined') return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Gerar README para o pacote de export
const generateReadme = (database: AdminDatabase): string => {
  const dateStr = new Date().toLocaleString('pt-BR');
  const participantsCount = Object.keys(database.participants).length;
  const paredoesCount = database.history.paredoes.length;

  return `BBB26 - Pacote de Export de Dados
=================================

Data de exportação: ${dateStr}
Versão do database: ${database.version}
Temporada: ${database.season}

Conteúdo do pacote:
------------------

bbb26.json
  - Configurações da semana atual
  - Destaques e paredão atual
  - Estado da votação

participants-status.json
  - Lista completa de participantes (${participantsCount} participantes)
  - Status atual de cada um (Ativo/Eliminado/Desclassificado)

paredao-results.json
  - Histórico completo de paredões (${paredoesCount} paredões)
  - Resultados detalhados de cada votação

Como usar estes arquivos:
-----------------------

1. bbb26.json → Para configurar o app BBB26
2. participants-status.json → Para sincronizar status dos participantes
3. paredao-results.json → Para manter histórico de votações

IMPORTANTE: Mantenha este backup em local seguro!

Gerado pelo Admin BBB26
https://admin-bbb26.vercel.app
`;
};

// ========== NOVAS FUNÇÕES PARA PERSISTÊNCIA MAIS SEGURA ==========

// Exportar database completo como admin-db.json
export const exportDatabase = (database: AdminDatabase): AdminDatabase => {
  // Criar uma cópia profunda do database
  const exportData: AdminDatabase = {
    ...database,
  };

  return exportData;
};

// Exportar e fazer download do database completo
export const downloadDatabase = (database: AdminDatabase) => {
  const exportData = exportDatabase(database);
  const filename = `admin-db-${new Date().toISOString().split('T')[0]}.json`;
  exportFile(filename, exportData);
};

// Importar database de arquivo JSON
export const importDatabase = (file: File): Promise<AdminDatabase> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as AdminDatabase;

        // Validações básicas
        if (!data.version || !data.season || !data.participants || !data.currentWeek || !data.history) {
          throw new Error('Arquivo inválido: estrutura do database incompleta');
        }

        resolve(data);
      } catch (error) {
        reject(new Error(`Erro ao importar arquivo: ${error instanceof Error ? error.message : 'Formato inválido'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler o arquivo'));
    };

    reader.readAsText(file);
  });
};

// Validar e processar dados do BBB26 por versão de schema
const processBBB26Data = (data: any, mode: BBB26ImportMode): BBB26Export => {
  // Validação rigorosa de tipos com detecção
  const validationResult = validateBBB26Types(data);

  // Fail-fast: verificar se é exatamente BBB26
  const seasonValue = data.season;
  const seasonPath = new FieldPathBuilder().push('season').toString();

  if (mode === BBB26ImportMode.STRICT) {
    // STRICT: erro em qualquer desvio
    if (typeof seasonValue === 'string') {
      throw new BBB26ImportError(
        BBB26ImportErrorCode.INVALID_TYPES,
        'Temporada veio como texto; esperado número',
        { expected: 'number', received: typeof seasonValue, value: seasonValue },
        seasonPath
      );
    }
    if (seasonValue !== 26) {
      throw new BBB26ImportError(
        BBB26ImportErrorCode.INVALID_SEASON,
        'Arquivo não pertence ao BBB26 (temporada 26)',
        { expected: 26, received: seasonValue },
        seasonPath
      );
    }
  } else {
    // LENIENT: tentar normalizar
    if (typeof seasonValue === 'string') {
      const normalized = parseInt(seasonValue, 10);
      if (!isNaN(normalized)) {
        data.season = normalized;
        validationResult.warnings = validationResult.warnings || [];
        validationResult.warnings.push({
          field: 'season',
          issue: 'normalized_from_string',
          original: seasonValue,
          normalized: normalized,
          path: seasonPath
        });
      } else {
        throw new BBB26ImportError(
          BBB26ImportErrorCode.INVALID_TYPES,
          'Temporada é um texto inválido para conversão numérica',
          { received: seasonValue },
          seasonPath
        );
      }
    }

    if (data.season !== 26) {
      // LENIENT: permite season diferente mas marca como warning
      validationResult.warnings = validationResult.warnings || [];
      validationResult.warnings.push({
        field: 'season',
        issue: 'unexpected_season',
        expected: 26,
        received: data.season,
        path: seasonPath
      });
    }
  }

  // Sistema de versionamento de schema
  const schemaValue = data.schemaVersion;
  const schemaPath = new FieldPathBuilder().push('schemaVersion').toString();

  if (mode === BBB26ImportMode.STRICT) {
    if (typeof schemaValue === 'string') {
      throw new BBB26ImportError(
        BBB26ImportErrorCode.INVALID_TYPES,
        'Versão do schema veio como texto; esperado número',
        { expected: 'number', received: typeof schemaValue, value: schemaValue },
        schemaPath
      );
    }
  } else {
    // LENIENT: tentar normalizar
    if (typeof schemaValue === 'string') {
      const normalized = parseInt(schemaValue, 10);
      if (!isNaN(normalized)) {
        data.schemaVersion = normalized;
        validationResult.warnings = validationResult.warnings || [];
        validationResult.warnings.push({
          field: 'schemaVersion',
          issue: 'normalized_from_string',
          original: schemaValue,
          normalized: normalized,
          path: schemaPath
        });
      }
    }
  }

  switch (data.schemaVersion) {
    case 1:
      return processBBB26SchemaV1(data, validationResult, mode);
    default:
      throw new BBB26ImportError(
        BBB26ImportErrorCode.UNSUPPORTED_SCHEMA,
        `Versão de schema não suportada: v${data.schemaVersion}. Suportado: v1`,
        { supportedVersions: [1], received: data.schemaVersion },
        schemaPath
      );
  }
};

// Validação de tipos com detecção de problemas e fieldPath
const validateBBB26Types = (data: any): { typeIssues: any[], warnings: any[] } => {
  const typeIssues: any[] = [];
  const warnings: any[] = [];

  // Verificar tipos básicos
  const fields = [
    { name: 'season', expected: 'number' },
    { name: 'schemaVersion', expected: 'number' },
    { name: 'highlights', expected: 'array' },
    { name: 'paredao', expected: 'array' },
    { name: 'updatedAt', expected: 'string' },
    { name: 'paredaoState', expected: 'string' },
    { name: 'votingStatus', expected: 'string' }
  ];

  fields.forEach(({ name, expected }) => {
    const value = data[name];
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    const path = new FieldPathBuilder().push(name).toString();

    if (expected === 'array' && !Array.isArray(value)) {
      typeIssues.push({
        field: name,
        expected,
        received: actualType,
        value,
        path
      });
    } else if (expected !== 'array' && typeof value !== expected) {
      typeIssues.push({
        field: name,
        expected,
        received: actualType,
        value,
        path
      });
    }
  });

  return { typeIssues, warnings };
};

// Processar dados da versão 1 do schema BBB26
const processBBB26SchemaV1 = (
  data: any,
  validationResult: { typeIssues: any[], warnings: any[] },
  mode: BBB26ImportMode
): BBB26Export => {
  // Garantir que todos os campos obrigatórios estão presentes
  const requiredFields = ['schemaVersion', 'season', 'updatedAt', 'highlights', 'paredao', 'paredaoState', 'votingStatus'];
  const missingFields = requiredFields.filter(field => !data.hasOwnProperty(field));

  if (missingFields.length > 0) {
    const missingPaths = missingFields.map(field => new FieldPathBuilder().push(field).toString());
    throw new BBB26ImportError(
      BBB26ImportErrorCode.MISSING_FIELDS,
      `Campos obrigatórios faltando: ${missingFields.join(', ')}`,
      { missingFields, requiredFields, missingPaths },
      missingPaths.join(', ')
    );
  }

  // Validar estrutura dos highlights com fieldPath
  data.highlights.forEach((highlight: any, index: number) => {
    const pathBuilder = new FieldPathBuilder().push('highlights').push(index);
    const requiredHighlightFields = ['id', 'type', 'title', 'state'];
    const missingHighlightFields = requiredHighlightFields.filter(field => !highlight[field]);

    // participantId pode ser vazio (string vazia), então validamos separadamente
    if (!highlight.hasOwnProperty('participantId')) {
      missingHighlightFields.push('participantId');
    }

    if (missingHighlightFields.length > 0) {
      const fieldPaths = missingHighlightFields.map(field => pathBuilder.clone().push(field).toString());
      throw new BBB26ImportError(
        BBB26ImportErrorCode.INVALID_HIGHLIGHT,
        `Highlight ${index + 1} tem campos obrigatórios faltando: ${missingHighlightFields.join(', ')}`,
        { highlightIndex: index, missingFields: missingHighlightFields, highlight },
        fieldPaths.join(', ')
      );
    }

    // LENIENT: normalizar campos opcionais
    if (mode === BBB26ImportMode.LENIENT) {
      // Normalizar state para maiúsculo se necessário
      if (typeof highlight.state === 'string') {
        const normalizedState = highlight.state.toUpperCase();
        if (normalizedState !== highlight.state) {
          highlight.state = normalizedState;
          validationResult.warnings.push({
            field: 'state',
            issue: 'normalized_case',
            original: highlight.state,
            normalized: normalizedState,
            path: pathBuilder.clone().push('state').toString()
          });
        }
      }
    }
  });

  // Validar estrutura do paredão com fieldPath
  data.paredao.forEach((slot: any, index: number) => {
    const pathBuilder = new FieldPathBuilder().push('paredao').push(index);

    // Campos obrigatórios (devem existir)
    const requiredSlotFields = ['id', 'position', 'status'];

    // participantId é opcional - pode ser string vazia ou inexistente
    const missingRequiredFields = requiredSlotFields.filter(field => {
      const value = slot[field];
      return value === undefined || value === null;
    });

    if (missingRequiredFields.length > 0) {
      const fieldPaths = missingRequiredFields.map(field => pathBuilder.clone().push(field).toString());
      throw new BBB26ImportError(
        BBB26ImportErrorCode.INVALID_PAREDAO_SLOT,
        `Slot do paredão ${index + 1} tem campos obrigatórios faltando: ${missingRequiredFields.join(', ')}`,
        { slotIndex: index, missingFields: missingRequiredFields, slot },
        fieldPaths.join(', ')
      );
    }

    // Validar tipos dos campos obrigatórios
    if (typeof slot.id !== 'string' || slot.id.trim() === '') {
      throw new BBB26ImportError(
        BBB26ImportErrorCode.INVALID_TYPES,
        `ID do slot ${index + 1} deve ser uma string não vazia`,
        { slotIndex: index, id: slot.id },
        pathBuilder.clone().push('id').toString()
      );
    }

    // participantId pode ser string (incluindo vazia) ou undefined
    if (slot.participantId !== undefined && typeof slot.participantId !== 'string') {
      throw new BBB26ImportError(
        BBB26ImportErrorCode.INVALID_TYPES,
        `participantId do slot ${index + 1} deve ser uma string ou não existir`,
        { slotIndex: index, participantId: slot.participantId, type: typeof slot.participantId },
        pathBuilder.clone().push('participantId').toString()
      );
    }

    if (mode === BBB26ImportMode.STRICT && typeof slot.position !== 'number') {
      throw new BBB26ImportError(
        BBB26ImportErrorCode.INVALID_TYPES,
        `Posição do slot ${index + 1} deve ser um número`,
        { slotIndex: index, position: slot.position, type: typeof slot.position },
        pathBuilder.clone().push('position').toString()
      );
    } else if (mode === BBB26ImportMode.LENIENT && typeof slot.position === 'string') {
      // LENIENT: tentar converter string para número
      const normalized = parseInt(slot.position, 10);
      if (!isNaN(normalized)) {
        slot.position = normalized;
        validationResult.warnings.push({
          field: 'position',
          issue: 'normalized_from_string',
          original: slot.position,
          normalized,
          path: pathBuilder.clone().push('position').toString()
        });
      }
    }
  });

  return {
    ...data,
    // Adicionar metadados de validação para telemetria
    _validation: {
      typeIssues: validationResult.typeIssues,
      warnings: validationResult.warnings,
      processedAt: new Date().toISOString(),
      schemaVersion: 1,
      mode
    }
  } as BBB26Export & { _validation: any };
};

// Normalização canônica do JSON para hash consistente
const canonicalizeJSON = (obj: any): string => {
  // Função recursiva para ordenar chaves
  const sortObject = (o: any): any => {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) return o.map(sortObject);

    const sorted: any = {};
    Object.keys(o).sort().forEach(key => {
      sorted[key] = sortObject(o[key]);
    });
    return sorted;
  };

  // Normalizar quebras de linha e espaços
  const normalized = JSON.stringify(sortObject(obj), null, 0)
    .replace(/\r\n/g, '\n')  // CRLF -> LF
    .replace(/\r/g, '\n');   // CR -> LF

  return normalized;
};

// Gerar hash do conteúdo canônico para idempotência verdadeira
const generateContentHash = (content: string): string => {
  try {
    // Tentar parsear e canonicalizar
    const parsed = JSON.parse(content);
    const canonical = canonicalizeJSON(parsed);
    return generateHash(canonical);
  } catch {
    // Fallback: hash do conteúdo bruto se não for JSON válido
    return generateHash(content);
  }
};

// Função de hash simples (FNV-1a like)
const generateHash = (str: string): string => {
  let hash = 2166136261; // FNV offset
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash *= 16777619; // FNV prime
  }
  return (hash >>> 0).toString(16); // Unsigned 32-bit
};

// Fases do processo de importação
export enum ImportPhase {
  READ = 'read',
  PARSE = 'parse',
  VALIDATE = 'validate',
  TRANSFORM = 'transform',
  COMMIT = 'commit'
}

// Telemetria aprimorada com duration e phase tracking
const logBBB26Import = (
  data: Partial<BBB26Export>,
  file: File,
  contentHash: string,
  success: boolean,
  durationMs: number,
  phase: ImportPhase,
  mode: BBB26ImportMode,
  error?: any,
  fieldPath?: string
) => {
  const telemetry = {
    timestamp: new Date().toISOString(),
    durationMs,
    phase,
    mode,
    fileName: file.name,
    fileSize: file.size,
    contentHash,
    success,
    schemaVersion: data.schemaVersion || 1,
    season: data.season || 26,
    highlightsCount: data.highlights?.length || 0,
    paredaoSlotsCount: data.paredao?.length || 0,
    updatedAt: data.updatedAt,
    paredaoState: data.paredaoState,
    votingStatus: data.votingStatus,
    ...(data as any)._validation && { validation: (data as any)._validation },
    ...(error && {
      error: {
        code: error.code,
        name: error.name,
        message: error.message,
        fieldPath,
        details: error.details
      }
    })
  };

  // Log estruturado (pode ser enviado para serviço de monitoramento)
  console.log('📊 BBB26 Import Telemetry:', JSON.stringify(telemetry, null, 2));
};

// Importação ATÔMICA: parse + validação + transformação em memória, só depois commit único
export const importFromBBB26 = (
  file: File,
  mode: BBB26ImportMode = BBB26ImportMode.STRICT
): Promise<BBB26Export> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const startTime = Date.now();
    let currentPhase: ImportPhase = ImportPhase.READ;

    const trackPhase = (phase: ImportPhase) => {
      currentPhase = phase;
    };

    const createErrorData = () => ({
      schemaVersion: 1,
      season: 26,
      updatedAt: new Date().toISOString(),
      highlights: [],
      paredao: [],
      paredaoState: 'NOT_FORMED' as const,
      votingStatus: 'CLOSED' as const
    });

    reader.onload = (e) => {
      let content: string;
      let contentHash = '';

      try {
        // FASE 1: READ
        trackPhase(ImportPhase.READ);
        content = e.target?.result as string;
        if (!content) {
          throw new BBB26ImportError(
            BBB26ImportErrorCode.FILE_READ_ERROR,
            'Arquivo vazio ou não pôde ser lido'
          );
        }

        // Gerar hash canônico
        contentHash = generateContentHash(content);

        // FASE 2: PARSE
        trackPhase(ImportPhase.PARSE);
        let rawData: any;
        try {
          rawData = JSON.parse(content);
        } catch (parseError) {
          throw new BBB26ImportError(
            BBB26ImportErrorCode.INVALID_STRUCTURE,
            'Arquivo não é um JSON válido',
            { parseError: parseError instanceof Error ? parseError.message : 'Erro de parsing' }
          );
        }

        // FASE 3: VALIDATE + TRANSFORM (em memória)
        trackPhase(ImportPhase.VALIDATE);
        const data = processBBB26Data(rawData, mode);

        // FASE 4: TRANSFORM final
        trackPhase(ImportPhase.TRANSFORM);
        // Adicionar metadados
        (data as any)._importHash = contentHash;
        (data as any)._importMode = mode;
        (data as any)._processedAt = new Date().toISOString();

        // FASE 5: "COMMIT" (neste caso, só retorna os dados processados)
        trackPhase(ImportPhase.COMMIT);

        const duration = Date.now() - startTime;
        logBBB26Import(data, file, contentHash, true, duration, currentPhase, mode);

        resolve(data);

      } catch (error) {
        const duration = Date.now() - startTime;
        const errorData = createErrorData();
        const fieldPath = error instanceof BBB26ImportError ? error.fieldPath : undefined;

        logBBB26Import(errorData, file, contentHash || '', false, duration, currentPhase, mode, error, fieldPath);

        reject(error);
      }
    };

    reader.onerror = () => {
      const duration = Date.now() - startTime;
      const error = new BBB26ImportError(
        BBB26ImportErrorCode.FILE_READ_ERROR,
        'Erro ao ler o arquivo selecionado',
        { fileName: file.name, fileSize: file.size }
      );

      logBBB26Import({}, file, '', false, duration, currentPhase, mode, error);
      reject(error);
    };

    reader.readAsText(file);
  });
};

// Validar se um arquivo é um database válido do Admin BBB26
export const validateDatabaseFile = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    // Verificar extensão
    if (!file.name.toLowerCase().endsWith('.json')) {
      resolve(false);
      return;
    }

    // Verificar tamanho (não deve ser muito grande)
    if (file.size > 50 * 1024 * 1024) { // 50MB max
      resolve(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as AdminDatabase;

        // Verificar estrutura básica
        const isValid = !!(
          data.version &&
          data.season &&
          data.participants &&
          typeof data.participants === 'object' &&
          data.currentWeek &&
          data.history &&
          Array.isArray(data.history.paredoes)
        );

        resolve(isValid);
      } catch {
        resolve(false);
      }
    };

    reader.onerror = () => resolve(false);
    reader.readAsText(file);
  });
};