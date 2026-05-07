import { NextRequest, NextResponse } from 'next/server';
import { BannerUpdatePayloadSchema } from '../../../../../models/bannersSchemas';
import { deleteBanner, getBannerById, updateBanner } from '../../../../../lib/bannersStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function assertAdmin(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';
  if (!apiKey || apiKey !== expectedApiKey) {
    throw new Error('Acesso negado');
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ bannerId: string }> }
) {
  try {
    assertAdmin(request);
    const { bannerId } = await context.params;
    const banner = await getBannerById(bannerId);
    if (!banner) {
      return NextResponse.json({ error: 'Banner não encontrado' }, { status: 404 });
    }
    return NextResponse.json(banner);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const status = message === 'Acesso negado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ bannerId: string }> }
) {
  try {
    assertAdmin(request);
    const { bannerId } = await context.params;
    const body = await request.json();
    const parsed = BannerUpdatePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }
    const banner = await updateBanner(bannerId, parsed.data);
    return NextResponse.json(banner);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    if (message === 'Acesso negado') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === 'Banner não encontrado') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('mesma URL')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ bannerId: string }> }
) {
  try {
    assertAdmin(request);
    const { bannerId } = await context.params;
    await deleteBanner(bannerId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    if (message === 'Acesso negado') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === 'Banner não encontrado') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
