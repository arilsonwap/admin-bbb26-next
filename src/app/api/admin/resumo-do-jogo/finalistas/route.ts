import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { getHostingPublicDir } from '@/lib/hostingPublicDir';
import { sha256HexUtf8 } from '@/lib/publishExportDiagnostics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAIN_FILE = 'statusbbb.json';

/** Valores como "1º finalista" … "9º finalista" gerados ao salvar o pódio. */
const FINALISTA_STATUS_TOKEN = /^\d+º finalista$/;

function splitStatusTokens(existing: unknown): string[] {
  if (existing === undefined || existing === null) return [];
  const s = String(existing).trim();
  if (!s) return [];
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Preserva tokens do scrape (vip, xepa, …) e só troca/atualiza o sufixo de finalista. */
function mergeStatusComMarcacaoFinalista(existing: unknown, posLabel: string): string {
  const kept = splitStatusTokens(existing).filter((t) => !FINALISTA_STATUS_TOKEN.test(t));
  return [...kept, posLabel].join(',');
}

/** Usado ao remover o bloco finalistas: tira só a marcação editorial, mantém o restante do status. */
function statusSemMarcacaoFinalista(existing: unknown): string {
  return splitStatusTokens(existing)
    .filter((t) => !FINALISTA_STATUS_TOKEN.test(t))
    .join(',');
}

const PostBodySchema = z.object({
  primeiroId: z.string(),
  segundoId: z.string().optional(),
  terceiroId: z.string().optional(),
});

function assertAdmin(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';
  if (!apiKey || apiKey !== expectedApiKey) {
    throw new Error('Acesso negado');
  }
}

function idToDisplayNome(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

type ParticipanteRow = Record<string, unknown> & { id?: string };

function normalizeParticipantes(raw: unknown): ParticipanteRow[] {
  if (Array.isArray(raw)) {
    return raw as ParticipanteRow[];
  }
  if (raw && typeof raw === 'object' && 'id' in (raw as object)) {
    return [raw as ParticipanteRow];
  }
  return [];
}

function isSelectableParticipant(p: ParticipanteRow): p is ParticipanteRow & { id: string } {
  return (
    typeof p.id === 'string' &&
    p.id.length > 0 &&
    !('error' in p && p.error)
  );
}

function extractRankingIdsParaLimpeza(finalistas: unknown): string[] {
  if (!finalistas || typeof finalistas !== 'object') return [];
  const ranking = (finalistas as { ranking?: unknown }).ranking;
  if (!Array.isArray(ranking)) return [];
  const ids: string[] = [];
  for (const row of ranking) {
    if (!row || typeof row !== 'object') continue;
    const id = (row as { id?: unknown }).id;
    if (typeof id === 'string' && id.length > 0) {
      ids.push(id);
    }
  }
  return ids;
}

function applyStatusByIdToParticipantes(
  data: Record<string, unknown>,
  statusById: Record<string, string>
): void {
  if (Array.isArray(data.participantes)) {
    (data.participantes as ParticipanteRow[]).forEach((p) => {
      if (isSelectableParticipant(p) && statusById[p.id] !== undefined) {
        p.status = statusById[p.id];
      }
    });
  } else if (data.participantes && typeof data.participantes === 'object') {
    const p = data.participantes as ParticipanteRow;
    if (isSelectableParticipant(p) && statusById[p.id] !== undefined) {
      p.status = statusById[p.id];
    }
  }
}

function writeStatusBbbAtomic(publicDir: string, data: unknown): { bytes: number } {
  const content = JSON.stringify(data, null, 2);
  const mainPath = join(publicDir, MAIN_FILE);
  const tmpMain = `${mainPath}.tmp`;
  writeFileSync(tmpMain, content, 'utf8');
  renameSync(tmpMain, mainPath);

  const sha256 = sha256HexUtf8(content);
  const version = `sha256:${sha256.slice(0, 16)}`;
  const latestPath = join(publicDir, 'statusbbb-latest.json');
  const latestData = {
    file: MAIN_FILE,
    lastModified: new Date().toISOString(),
    localDate: new Date().toISOString().split('T')[0],
    bytes: Buffer.byteLength(content, 'utf8'),
    sha256,
    version,
  };
  const tmpLatest = `${latestPath}.tmp`;
  writeFileSync(tmpLatest, JSON.stringify(latestData, null, 2), 'utf8');
  renameSync(tmpLatest, latestPath);

  return { bytes: Buffer.byteLength(content, 'utf8') };
}

export async function POST(request: NextRequest) {
  try {
    assertAdmin(request);
    const publicDir = getHostingPublicDir();
    const mainPath = join(publicDir, MAIN_FILE);
    if (!existsSync(mainPath)) {
      return NextResponse.json(
        { error: `Arquivo não encontrado: ${MAIN_FILE}. Execute o resumo do jogo antes.` },
        { status: 404 }
      );
    }

    const rawBody = await request.json();
    const parsed = PostBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload inválido', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const primeiroId = parsed.data.primeiroId.trim();
    const segundoId = (parsed.data.segundoId ?? '').trim();
    const terceiroId = (parsed.data.terceiroId ?? '').trim();

    if (!primeiroId) {
      return NextResponse.json({ error: 'Informe pelo menos o 1º finalista' }, { status: 400 });
    }
    if (terceiroId && !segundoId) {
      return NextResponse.json(
        { error: 'Preencha o 2º finalista antes do 3º' },
        { status: 400 }
      );
    }
    const idsOrdenados = [primeiroId, segundoId, terceiroId].filter((id) => id.length > 0);
    if (new Set(idsOrdenados).size !== idsOrdenados.length) {
      return NextResponse.json({ error: 'Não repita o mesmo participante' }, { status: 400 });
    }

    const raw = readFileSync(mainPath, 'utf8');
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'JSON inválido em statusbbb.json' }, { status: 422 });
    }

    const rows = normalizeParticipantes(data.participantes).filter(isSelectableParticipant);
    const byId = new Map(rows.map((r) => [r.id, r]));

    const missing = idsOrdenados.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Participante(s) não encontrado(s) no JSON', missing },
        { status: 400 }
      );
    }

    const updatedAt = new Date().toISOString();
    const ranking = idsOrdenados.map((id, idx) => {
      const pos = idx + 1;
      return {
        posicao: pos,
        id,
        nome: idToDisplayNome(id),
        titulo: `${pos}º finalista`,
      };
    });
    data.finalistas = {
      definidos: true,
      ranking,
      updatedAt,
    };

    const statusById: Record<string, string> = Object.fromEntries(
      idsOrdenados.map((id, idx) => {
        const row = byId.get(id);
        const prev = row && typeof row.status === 'string' ? row.status : '';
        const posLabel = `${idx + 1}º finalista`;
        return [id, mergeStatusComMarcacaoFinalista(prev, posLabel)];
      })
    );

    applyStatusByIdToParticipantes(data, statusById);

    const { bytes } = writeStatusBbbAtomic(publicDir, data);

    return NextResponse.json({
      ok: true,
      bytes,
      finalistas: data.finalistas,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const status = message === 'Acesso negado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertAdmin(request);
    const publicDir = getHostingPublicDir();
    const mainPath = join(publicDir, MAIN_FILE);
    if (!existsSync(mainPath)) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }

    const raw = readFileSync(mainPath, 'utf8');
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'JSON inválido em statusbbb.json' }, { status: 422 });
    }

    if (!('finalistas' in data)) {
      return NextResponse.json({ ok: true, message: 'Nenhum bloco de finalistas para remover' });
    }

    const idsParaLimparStatus = extractRankingIdsParaLimpeza(data.finalistas);
    const idSet = new Set(idsParaLimparStatus);
    if (Array.isArray(data.participantes)) {
      for (const p of data.participantes as ParticipanteRow[]) {
        if (isSelectableParticipant(p) && idSet.has(p.id)) {
          p.status = statusSemMarcacaoFinalista(p.status);
        }
      }
    } else if (data.participantes && typeof data.participantes === 'object') {
      const p = data.participantes as ParticipanteRow;
      if (isSelectableParticipant(p) && p.id && idSet.has(p.id)) {
        p.status = statusSemMarcacaoFinalista(p.status);
      }
    }

    delete data.finalistas;
    writeStatusBbbAtomic(publicDir, data);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const status = message === 'Acesso negado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
