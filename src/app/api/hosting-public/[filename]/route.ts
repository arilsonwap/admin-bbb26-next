import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getHostingPublicDir } from '../../../../lib/hostingPublicDir';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_FILES = new Set([
  'queridometro.json',
  'queridometro-latest.json',
  'queridometro-feature.json',
  'statusbbb.json',
  'statusbbb-latest.json',
  'casa-do-patrao-participantes.json',
  'casa-do-patrao-participantes-latest.json',
  'casa-do-patrao-participantes-barra.json',
  'casa-do-patrao-participantes-barra-latest.json',
  'casa-do-patrao-eliminacao-results.json',
  'casa-do-patrao-eliminacao-results-latest.json',
  'casa-do-patrao-historico.json',
  'casa-do-patrao-historico-latest.json',
  'app-version.json',
  'app-version-latest.json',
]);

function isSafeFilename(name: string): boolean {
  if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
    return false;
  }
  return ALLOWED_FILES.has(name);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    if (!isSafeFilename(filename)) {
      return NextResponse.json({ error: 'Arquivo não permitido' }, { status: 400 });
    }

    const fullPath = join(getHostingPublicDir(), filename);
    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }

    const raw = readFileSync(fullPath, 'utf8');
    const contentType =
      filename.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8';

    return new NextResponse(raw, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
