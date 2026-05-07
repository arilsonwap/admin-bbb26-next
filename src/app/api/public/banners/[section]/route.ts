import { NextRequest, NextResponse } from 'next/server';
import { BannerSectionParamSchema } from '../../../../../models/bannersSchemas';
import { getPublicPayloadForSection } from '../../../../../lib/bannersStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ section: string }> }
) {
  try {
    const { section: raw } = await context.params;
    const parsed = BannerSectionParamSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Seção inválida', details: parsed.error.format() },
        { status: 400 }
      );
    }
    const payload = await getPublicPayloadForSection(parsed.data);
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
