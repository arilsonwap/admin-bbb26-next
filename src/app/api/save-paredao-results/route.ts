import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, statSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Conteúdo não fornecido' }, { status: 400 });
    }

    // Caminho para o arquivo paredao-results.json em tools/bbb-hosting/public
    const hostingPath = join(process.cwd(), 'tools', 'bbb-hosting', 'public', 'paredao-results.json');

    // Salvar os dados no arquivo de hospedagem
    writeFileSync(hostingPath, content, 'utf8');

    // Manter cópia na raiz para compatibilidade
    const rootPath = join(process.cwd(), 'paredao-results.json');
    writeFileSync(rootPath, content, 'utf8');

    // Atualizar metadados do arquivo latest
    const hostingDir = join(process.cwd(), 'tools', 'bbb-hosting', 'public');
    const latestPath = join(hostingDir, 'paredao-results-latest.json');

    const stats = statSync(hostingPath);
    const latestData = {
      file: 'paredao-results.json',
      lastModified: new Date().toISOString(),
      localDate: new Date().toISOString().split('T')[0],
      bytes: stats.size
    };

    writeFileSync(latestPath, JSON.stringify(latestData, null, 2), 'utf8');

    return NextResponse.json({
      success: true,
      message: 'Arquivo paredao-results.json e metadados atualizados com sucesso'
    });

  } catch (error) {
    console.error('Erro ao salvar paredao-results.json:', error);
    return NextResponse.json({
      error: 'Erro ao salvar arquivo',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}