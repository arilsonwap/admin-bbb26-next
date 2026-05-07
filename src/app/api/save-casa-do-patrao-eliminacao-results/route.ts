import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import {
  stringifyDefaultCasaDoPatraoEliminacaoResults,
  validateCasaDoPatraoEliminacaoResultsJson,
} from '../../../lib/casaDoPatraoEliminacaoResults';

const BASENAME = 'casa-do-patrao-eliminacao-results.json';

function readPreviousVersion(hostingPath: string): number {
  if (!existsSync(hostingPath)) return 0;
  try {
    const prev = JSON.parse(readFileSync(hostingPath, 'utf8')) as Record<string, unknown>;
    const v = prev.version;
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1) {
      return v;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

export async function GET() {
  try {
    const hostingPath = join(process.cwd(), 'tools', 'bbb-hosting', 'public', BASENAME);
    if (!existsSync(hostingPath)) {
      return new NextResponse(stringifyDefaultCasaDoPatraoEliminacaoResults(), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
    const content = readFileSync(hostingPath, 'utf8');
    return new NextResponse(content, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (error) {
    console.error(`Erro ao carregar ${BASENAME}:`, error);
    return NextResponse.json(
      {
        error: 'Erro ao carregar arquivo',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (content === undefined || content === null || String(content).trim() === '') {
      return NextResponse.json({ error: 'Conteúdo não fornecido' }, { status: 400 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(String(content));
    } catch {
      return NextResponse.json({ error: 'JSON inválido na requisição' }, { status: 400 });
    }

    const validationError = validateCasaDoPatraoEliminacaoResultsJson(parsed);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const hostingPath = join(process.cwd(), 'tools', 'bbb-hosting', 'public', BASENAME);
    const prevVersion = readPreviousVersion(hostingPath);
    const nextVersion = prevVersion > 0 ? prevVersion + 1 : 1;

    const rootObj = parsed as Record<string, unknown>;
    rootObj.version = nextVersion;
    rootObj.updatedAt = new Date().toISOString();
    const toWrite = JSON.stringify(rootObj, null, 2);

    writeFileSync(hostingPath, toWrite, 'utf8');

    const rootPath = join(process.cwd(), BASENAME);
    writeFileSync(rootPath, toWrite, 'utf8');

    const hostingDir = join(process.cwd(), 'tools', 'bbb-hosting', 'public');
    const latestPath = join(hostingDir, 'casa-do-patrao-eliminacao-results-latest.json');
    const stats = statSync(hostingPath);
    const latestData = {
      file: BASENAME,
      lastModified: new Date().toISOString(),
      localDate: new Date().toISOString().split('T')[0],
      bytes: stats.size,
    };
    writeFileSync(latestPath, JSON.stringify(latestData, null, 2), 'utf8');

    return NextResponse.json({
      success: true,
      message: `${BASENAME} e metadados atualizados com sucesso`,
    });
  } catch (error) {
    console.error(`Erro ao salvar ${BASENAME}:`, error);
    return NextResponse.json(
      {
        error: 'Erro ao salvar arquivo',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
