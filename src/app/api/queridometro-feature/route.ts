import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { join } from 'path';
import { getHostingPublicDir } from '../../../lib/hostingPublicDir';
import {
  QueridometroFeatureSaveBodySchema,
  QueridometroFeatureStateSchema,
} from '../../../models/queridometroFeatureSchemas';
import type { QueridometroFeatureState } from '../../../models/queridometroFeatureTypes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FEATURE_FILENAME = 'queridometro-feature.json';

function defaultFeatureState(): QueridometroFeatureState {
  return {
    mode: 'active',
    title: 'Queridômetro encerrado',
    message:
      'O Queridômetro não está mais ativo nesta fase do programa. Confira outras atualizações na tela inicial.',
    buttonLabel: 'Voltar para a Home',
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

function featureFilePath(): string {
  return join(getHostingPublicDir(), FEATURE_FILENAME);
}

function readFeatureFromDisk(): QueridometroFeatureState | null {
  const path = featureFilePath();
  if (!existsSync(path)) {
    return null;
  }
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    const result = QueridometroFeatureStateSchema.safeParse(parsed);
    if (!result.success) {
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

export async function GET() {
  const fromDisk = readFeatureFromDisk();
  if (fromDisk) {
    return NextResponse.json(fromDisk);
  }
  return NextResponse.json(defaultFeatureState());
}

export async function PUT(request: NextRequest) {
  try {
    const json: unknown = await request.json();
    const parsedBody = QueridometroFeatureSaveBodySchema.safeParse(json);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Payload inválido', details: parsedBody.error.format() },
        { status: 400 }
      );
    }

    const updatedAt = new Date().toISOString();
    const nextState: QueridometroFeatureState = {
      ...parsedBody.data,
      updatedAt,
    };

    const path = featureFilePath();
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(nextState, null, 2), 'utf8');
    renameSync(tmp, path);

    return NextResponse.json(nextState);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
