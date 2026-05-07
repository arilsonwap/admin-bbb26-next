import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getHostingPublicDir } from '@/lib/hostingPublicDir';
import { writeHostingPublicMainAndLatest } from '@/lib/hostingPublicJsonWrite';
import { AppVersionPayloadSchema } from '@/models/appVersionSchemas';
import type { AppVersionDocument } from '@/models/appVersionTypes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAIN_FILE = 'app-version.json';

function assertAdmin(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';
  if (!apiKey || apiKey !== expectedApiKey) {
    throw new Error('Acesso negado');
  }
}

/** Espelhado em `tools/deploy-hosting/ensure-app-version-manifest.cjs` (pré-deploy). */
function defaultDocument(): AppVersionDocument {
  const updatedAt = new Date().toISOString();
  return {
    enabled: false,
    latestVersion: '1.0.0',
    minSupportedVersion: '1.0.0',
    forceUpdate: false,
    message: '',
    requiredMessage: '',
    storeUrlAndroid: 'market://details?id=com.arilson.centralbbb',
    storeUrlIos: '',
    showOncePerSession: true,
    updatedAt,
  };
}

function normalizeStoredDocument(raw: unknown): AppVersionDocument {
  const base = defaultDocument();
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const o = raw as Record<string, unknown>;
  const pickStr = (
    k: keyof Pick<
      AppVersionDocument,
      | 'latestVersion'
      | 'minSupportedVersion'
      | 'message'
      | 'requiredMessage'
      | 'storeUrlAndroid'
      | 'storeUrlIos'
      | 'updatedAt'
    >
  ): string => (typeof o[k] === 'string' ? (o[k] as string) : base[k]);
  const pickBool = (
    k: keyof Pick<AppVersionDocument, 'enabled' | 'forceUpdate' | 'showOncePerSession'>
  ): boolean => (typeof o[k] === 'boolean' ? (o[k] as boolean) : base[k]);

  return {
    enabled: pickBool('enabled'),
    latestVersion: pickStr('latestVersion'),
    minSupportedVersion: pickStr('minSupportedVersion'),
    forceUpdate: pickBool('forceUpdate'),
    message: pickStr('message'),
    requiredMessage: pickStr('requiredMessage'),
    storeUrlAndroid: pickStr('storeUrlAndroid'),
    storeUrlIos: pickStr('storeUrlIos'),
    showOncePerSession: pickBool('showOncePerSession'),
    updatedAt: pickStr('updatedAt'),
  };
}

export async function GET(request: NextRequest) {
  try {
    assertAdmin(request);
    const publicDir = getHostingPublicDir();
    const mainPath = join(publicDir, MAIN_FILE);

    if (!existsSync(mainPath)) {
      return NextResponse.json({
        ok: true,
        source: 'default',
        path: `tools/bbb-hosting/public/${MAIN_FILE}`,
        data: defaultDocument(),
      });
    }

    const raw = readFileSync(mainPath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return NextResponse.json(
        { error: 'JSON inválido em app-version.json', path: mainPath },
        { status: 422 }
      );
    }

    const data = normalizeStoredDocument(parsed);
    return NextResponse.json({
      ok: true,
      source: 'file',
      path: `tools/bbb-hosting/public/${MAIN_FILE}`,
      data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const status = message === 'Acesso negado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    assertAdmin(request);
    const publicDir = getHostingPublicDir();

    const rawBody = await request.json();
    const parsed = AppVersionPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload inválido', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const p = parsed.data;
    const document: AppVersionDocument = {
      enabled: p.enabled ?? true,
      latestVersion: p.latestVersion,
      minSupportedVersion: p.minSupportedVersion,
      forceUpdate: p.forceUpdate,
      message: p.message ?? '',
      requiredMessage: p.requiredMessage ?? '',
      storeUrlAndroid: p.storeUrlAndroid.trim(),
      storeUrlIos: (p.storeUrlIos ?? '').trim(),
      showOncePerSession: p.showOncePerSession ?? true,
      updatedAt: new Date().toISOString(),
    };

    const { bytes, sha256, version } = writeHostingPublicMainAndLatest(publicDir, MAIN_FILE, document);

    return NextResponse.json({
      ok: true,
      bytes,
      sha256,
      version,
      path: `tools/bbb-hosting/public/${MAIN_FILE}`,
      data: document,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const status = message === 'Acesso negado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
