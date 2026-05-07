import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { generateCasaDoPatraoConteudos, readCasaDoPatraoConteudosSaved } = await import(
      '@/lib/casaDoPatraoConteudosGenerator.cjs'
    );

    const url = new URL(request.url);
    const readOnly = url.searchParams.get('read') === '1';

    if (readOnly) {
      const payload = await readCasaDoPatraoConteudosSaved();
      return NextResponse.json(payload);
    }

    const { payload } = await generateCasaDoPatraoConteudos();
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro inesperado';
    const status = message.includes('Falha ao buscar fonte') ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
