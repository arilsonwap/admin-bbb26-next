import { createHash } from 'crypto';
import { basename } from 'path';

/** Hash estável do payload publicado (rastreio pós-deploy). */
export function sha256HexUtf8(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export type QueridometroExportDiag = {
  flow: 'queridometro';
  generatedAt: string;
  sourceAbsolutePath: string;
  sourceFileName: string;
  destinationDir: string;
  destinationMainFile: string;
  candidateJsonFilesInData: number;
  skippedOlderCandidates: number;
  skipReason: string;
  itemsTotal: number;
  itemsOk: number;
  itemsWithFetchError: number;
  fetchErrorByType: Record<string, number>;
  fetchErrorSamples: Array<{ slug: string; errorType?: string; error?: string }>;
  bytes: number;
  contentSha256: string;
  contentVersion: string;
};

export type ResumodojogoExportDiag = {
  flow: 'resumodojogo';
  generatedAt: string;
  sourceAbsolutePath: string;
  destinationDir: string;
  destinationMainFile: string;
  dataBusca: string | null;
  urlsRequestedApprox: number | null;
  participantesInFile: number;
  participantesOk: number;
  participantesComErroScraper: number;
  scraperErrorSamples: Array<{ id?: string; url?: string; error?: string }>;
  bytes: number;
  contentSha256: string;
  contentVersion: string;
};

export function diagnoseQueridometroExport(params: {
  sourcePath: string;
  publicDir: string;
  dataDir: string;
  sortedJsonFiles: { name: string }[];
  selectedName: string;
  content: string;
}): QueridometroExportDiag {
  const generatedAt = new Date().toISOString();
  const contentSha256 = sha256HexUtf8(params.content);
  const skipped = Math.max(0, params.sortedJsonFiles.length - 1);

  let itemsTotal = 0;
  let itemsOk = 0;
  let itemsWithFetchError = 0;
  const fetchErrorByType: Record<string, number> = {};
  const fetchErrorSamples: Array<{ slug: string; errorType?: string; error?: string }> = [];

  try {
    const parsed = JSON.parse(params.content) as unknown;
    if (Array.isArray(parsed)) {
      itemsTotal = parsed.length;
      for (const row of parsed) {
        if (row && typeof row === 'object' && 'error' in row && (row as { error?: unknown }).error) {
          itemsWithFetchError++;
          const errorType =
            typeof (row as { errorType?: string }).errorType === 'string'
              ? (row as { errorType: string }).errorType
              : 'unknown';
          fetchErrorByType[errorType] = (fetchErrorByType[errorType] ?? 0) + 1;
          if (fetchErrorSamples.length < 8) {
            const pageUrl = String((row as { pageUrl?: string }).pageUrl ?? '');
            let slug = '';
            try {
              slug = new URL(pageUrl).pathname.replace(/\/$/, '').split('/').filter(Boolean).pop() ?? pageUrl;
            } catch {
              slug = pageUrl || '?';
            }
            fetchErrorSamples.push({
              slug,
              errorType,
              error: String((row as { error?: unknown }).error ?? '').slice(0, 120),
            });
          }
        } else {
          itemsOk++;
        }
      }
    }
  } catch {
    itemsTotal = -1;
  }

  return {
    flow: 'queridometro',
    generatedAt,
    sourceAbsolutePath: params.sourcePath,
    sourceFileName: basename(params.sourcePath),
    destinationDir: params.publicDir,
    destinationMainFile: 'queridometro.json',
    candidateJsonFilesInData: params.sortedJsonFiles.length,
    skippedOlderCandidates: skipped,
    skipReason:
      skipped > 0
        ? 'Fonte = arquivo .json mais recente em data/ por mtime; demais candidatos não copiados para publicação.'
        : 'Único .json em data/; nada descartado na seleção.',
    itemsTotal,
    itemsOk,
    itemsWithFetchError,
    fetchErrorByType,
    fetchErrorSamples,
    bytes: Buffer.byteLength(params.content, 'utf8'),
    contentSha256,
    contentVersion: `sha256:${contentSha256.slice(0, 16)}`,
  };
}

export function diagnoseResumodojogoExport(params: {
  sourcePath: string;
  publicDir: string;
  content: string;
}): ResumodojogoExportDiag {
  const generatedAt = new Date().toISOString();
  const contentSha256 = sha256HexUtf8(params.content);

  let dataBusca: string | null = null;
  let participantesInFile = 0;
  let participantesOk = 0;
  let participantesComErroScraper = 0;
  const scraperErrorSamples: Array<{ id?: string; url?: string; error?: string }> = [];

  try {
    const parsed = JSON.parse(params.content) as {
      dataBusca?: string;
      participantes?: unknown[];
    };
    dataBusca = typeof parsed.dataBusca === 'string' ? parsed.dataBusca : null;
    const arr = Array.isArray(parsed.participantes) ? parsed.participantes : [];
    participantesInFile = arr.length;
    for (const p of arr) {
      if (p && typeof p === 'object' && 'error' in p) {
        participantesComErroScraper++;
        if (scraperErrorSamples.length < 8) {
          const o = p as { error?: string; url?: string; id?: string };
          scraperErrorSamples.push({
            id: o.id,
            url: o.url,
            error: typeof o.error === 'string' ? o.error.slice(0, 160) : undefined,
          });
        }
      } else {
        participantesOk++;
      }
    }
  } catch {
    participantesInFile = -1;
  }

  return {
    flow: 'resumodojogo',
    generatedAt,
    sourceAbsolutePath: params.sourcePath,
    destinationDir: params.publicDir,
    destinationMainFile: 'statusbbb.json',
    dataBusca,
    urlsRequestedApprox: null,
    participantesInFile,
    participantesOk,
    participantesComErroScraper,
    scraperErrorSamples,
    bytes: Buffer.byteLength(params.content, 'utf8'),
    contentSha256,
    contentVersion: `sha256:${contentSha256.slice(0, 16)}`,
  };
}

/** Uma linha JSON por evento — fácil de grep em logs da VPS. */
export function logExportDiagnosis(diag: QueridometroExportDiag | ResumodojogoExportDiag): void {
  const line = JSON.stringify(diag);
  console.log(`[export-diagnostics] ${line}`);
}
