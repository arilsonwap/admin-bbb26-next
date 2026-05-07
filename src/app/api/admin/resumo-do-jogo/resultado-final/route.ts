import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { getHostingPublicDir } from '@/lib/hostingPublicDir';
import { sha256HexUtf8 } from '@/lib/publishExportDiagnostics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAIN_FILE = 'statusbbb.json';

/** Status neutro após remover o pódio editorial (sem histórico de valores anteriores). */
const STATUS_NEUTRO = '';

const PostBodySchema = z
  .object({
    primeiroId: z.string().min(1),
    segundoId: z.string().min(1),
    terceiroId: z.string().min(1),
  })
  .refine(
    (d) =>
      d.primeiroId !== d.segundoId &&
      d.primeiroId !== d.terceiroId &&
      d.segundoId !== d.terceiroId,
    { message: 'Os três participantes devem ser distintos' }
  );

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

/** IDs do pódio (posições 1–3) antes de remover `resultadoFinal`. */
function extractRankingIdsParaLimpeza(resultadoFinal: unknown): string[] {
  if (!resultadoFinal || typeof resultadoFinal !== 'object') return [];
  const ranking = (resultadoFinal as { ranking?: unknown }).ranking;
  if (!Array.isArray(ranking)) return [];
  const ids: string[] = [];
  for (const row of ranking) {
    if (!row || typeof row !== 'object') continue;
    const pos = (row as { posicao?: unknown }).posicao;
    const id = (row as { id?: unknown }).id;
    if ((pos === 1 || pos === 2 || pos === 3) && typeof id === 'string' && id.length > 0) {
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

    const { primeiroId, segundoId, terceiroId } = parsed.data;

    const raw = readFileSync(mainPath, 'utf8');
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'JSON inválido em statusbbb.json' }, { status: 422 });
    }

    const rows = normalizeParticipantes(data.participantes).filter(isSelectableParticipant);
    const byId = new Map(rows.map((r) => [r.id, r]));

    const missing = [primeiroId, segundoId, terceiroId].filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Participante(s) não encontrado(s) no JSON', missing },
        { status: 400 }
      );
    }

    const nome1 = idToDisplayNome(primeiroId);
    const nome2 = idToDisplayNome(segundoId);
    const nome3 = idToDisplayNome(terceiroId);

    const updatedAt = new Date().toISOString();
    data.resultadoFinal = {
      encerrado: true,
      ranking: [
        { posicao: 1, id: primeiroId, nome: nome1, titulo: '1º lugar' },
        { posicao: 2, id: segundoId, nome: nome2, titulo: '2º lugar' },
        { posicao: 3, id: terceiroId, nome: nome3, titulo: '3º lugar' },
      ],
      updatedAt,
    };

    const statusById: Record<string, string> = {
      [primeiroId]: '1º lugar',
      [segundoId]: '2º lugar',
      [terceiroId]: '3º lugar',
    };

    applyStatusByIdToParticipantes(data, statusById);

    const { bytes } = writeStatusBbbAtomic(publicDir, data);

    return NextResponse.json({
      ok: true,
      bytes,
      resultadoFinal: data.resultadoFinal,
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

    if (!('resultadoFinal' in data)) {
      return NextResponse.json({ ok: true, message: 'Nenhum resultado final para remover' });
    }

    const idsParaLimparStatus = extractRankingIdsParaLimpeza(data.resultadoFinal);
    applyStatusByIdToParticipantes(data, Object.fromEntries(idsParaLimparStatus.map((id) => [id, STATUS_NEUTRO])));

    delete data.resultadoFinal;
    writeStatusBbbAtomic(publicDir, data);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const status = message === 'Acesso negado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
