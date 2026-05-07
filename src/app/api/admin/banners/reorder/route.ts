import { NextRequest, NextResponse } from 'next/server';
import { BannerReorderPayloadSchema } from '../../../../../models/bannersSchemas';
import { reorderBanners } from '../../../../../lib/bannersStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function assertAdmin(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';
  if (!apiKey || apiKey !== expectedApiKey) {
    throw new Error('Acesso negado');
  }
}

export async function POST(request: NextRequest) {
  try {
    assertAdmin(request);
    const body = await request.json();
    const parsed = BannerReorderPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }
    const { section, orderedIds } = parsed.data;
    const items = await reorderBanners(section, orderedIds);
    return NextResponse.json(items);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    if (message === 'Acesso negado') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    const clientErr =
      message.includes('não corresponde') ||
      message.includes('inválido') ||
      message.includes('duplicados') ||
      message.includes('não encontrada');
    return NextResponse.json({ error: message }, { status: clientErr ? 400 : 500 });
  }
}
