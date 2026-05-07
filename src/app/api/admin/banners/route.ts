import { NextRequest, NextResponse } from 'next/server';
import {
  BannerCreatePayloadSchema,
  BannerSectionParamSchema,
} from '../../../../models/bannersSchemas';
import { createBanner, listBannersBySection } from '../../../../lib/bannersStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function assertAdmin(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';
  if (!apiKey || apiKey !== expectedApiKey) {
    throw new Error('Acesso negado');
  }
}

export async function GET(request: NextRequest) {
  try {
    assertAdmin(request);
    const { searchParams } = new URL(request.url);
    const sectionRaw = searchParams.get('section');
    const sectionParsed = BannerSectionParamSchema.safeParse(sectionRaw ?? '');
    if (!sectionParsed.success) {
      return NextResponse.json(
        { error: 'Parâmetro section inválido', details: sectionParsed.error.format() },
        { status: 400 }
      );
    }
    const items = await listBannersBySection(sectionParsed.data);
    return NextResponse.json(items);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const status = message === 'Acesso negado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertAdmin(request);
    const body = await request.json();
    const parsed = BannerCreatePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }
    const banner = await createBanner(parsed.data);
    return NextResponse.json(banner, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const status =
      message === 'Acesso negado' ? 401 : message.includes('mesma URL') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
