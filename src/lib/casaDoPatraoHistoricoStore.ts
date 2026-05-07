import { existsSync, readFileSync, renameSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import { getHostingPublicDir } from '@/lib/hostingPublicDir';
import { writeHostingPublicMainAndLatest } from '@/lib/hostingPublicJsonWrite';
import { buildCasaDoPatraoHistoricoPublicJson, fileMtimeIso } from '@/utils/casaDoPatraoHistorico';
import type { CasaDoPatraoHistorico } from '@/utils/casaDoPatraoHistorico';
import { createEmptyHistorico } from '@/utils/casaDoPatraoHistorico';

export const HISTORICO_MAIN_BASENAME = 'casa-do-patrao-historico.json';

const DATA_RELATIVE_PATH = join('data', HISTORICO_MAIN_BASENAME);
const PARTICIPANTES_REL = join('data', 'casa-do-patrao-participantes.json');
const BARRA_REL = join('data', 'casa-do-patrao-participantes-barra.json');

export function dataHistoricoPath(): string {
  return join(process.cwd(), DATA_RELATIVE_PATH);
}

export function getDataHistoricoMeta(): {
  path: string;
  updatedAt: string | null;
  exists: boolean;
} {
  const path = dataHistoricoPath();
  if (!existsSync(path)) {
    return { path, updatedAt: null, exists: false };
  }
  const st = statSync(path);
  return { path, updatedAt: fileMtimeIso(true, st.mtimeMs), exists: true };
}

export function readCasaDoPatraoHistoricoOrEmpty(): CasaDoPatraoHistorico {
  const p = dataHistoricoPath();
  if (!existsSync(p)) return createEmptyHistorico();
  try {
    const raw = readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw) as CasaDoPatraoHistorico;
    if (!parsed || typeof parsed !== 'object') return createEmptyHistorico();
    return parsed;
  } catch {
    return createEmptyHistorico();
  }
}

export function loadParticipantesJson(): {
  data: unknown;
  updatedAt: string | null;
  path: string;
} {
  const path = join(process.cwd(), PARTICIPANTES_REL);
  if (!existsSync(path)) {
    return { data: null, updatedAt: null, path };
  }
  const st = statSync(path);
  const raw = readFileSync(path, 'utf8');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }
  return { data, updatedAt: fileMtimeIso(true, st.mtimeMs), path };
}

export function loadBarraJson(): {
  data: unknown;
  updatedAt: string | null;
  path: string;
} {
  const path = join(process.cwd(), BARRA_REL);
  if (!existsSync(path)) {
    return { data: null, updatedAt: null, path };
  }
  const st = statSync(path);
  const raw = readFileSync(path, 'utf8');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }
  return { data, updatedAt: fileMtimeIso(true, st.mtimeMs), path };
}

export function parseParticipantesArray(root: unknown): { list: { nome: string; funcao?: string }[] } {
  if (Array.isArray(root)) {
    return { list: root as { nome: string; funcao?: string }[] };
  }
  if (root && typeof root === 'object' && Array.isArray((root as { participantes?: unknown }).participantes)) {
    return {
      list: (root as { participantes: { nome: string; funcao?: string }[] }).participantes,
    };
  }
  return { list: [] };
}

export function writeCasaDoPatraoHistoricoAtomic(history: CasaDoPatraoHistorico): void {
  const content = JSON.stringify(history, null, 2);
  const dataPath = dataHistoricoPath();
  const tmp = `${dataPath}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, dataPath);

  const publicJson = buildCasaDoPatraoHistoricoPublicJson(history);
  const publicDir = getHostingPublicDir();
  writeHostingPublicMainAndLatest(publicDir, HISTORICO_MAIN_BASENAME, publicJson);
}
