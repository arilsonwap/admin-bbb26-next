import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, statSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { data } = await request.json();

    if (!data) {
      return NextResponse.json({ error: 'Dados não fornecidos' }, { status: 400 });
    }

    // Caminho para o arquivo bbb26.json em tools/bbb-hosting/public
    const hostingPath = join(process.cwd(), 'tools', 'bbb-hosting', 'public', 'bbb26.json');

    // Salvar os dados no arquivo de hospedagem
    writeFileSync(hostingPath, JSON.stringify(data, null, 2), 'utf8');

    // Manter cópia na raiz para compatibilidade
    const rootPath = join(process.cwd(), 'bbb26.json');
    writeFileSync(rootPath, JSON.stringify(data, null, 2), 'utf8');

    // Atualizar metadados do arquivo latest
    const hostingDir = join(process.cwd(), 'tools', 'bbb-hosting', 'public');
    const latestPath = join(hostingDir, 'bbb26-latest.json');

    const stats = statSync(hostingPath);
    const latestData = {
      file: 'bbb26.json',
      lastModified: new Date().toISOString(),
      localDate: new Date().toISOString().split('T')[0],
      bytes: stats.size
    };

    writeFileSync(latestPath, JSON.stringify(latestData, null, 2), 'utf8');

    return NextResponse.json({
      success: true,
      message: 'Arquivo bbb26.json e metadados atualizados com sucesso'
    });

  } catch (error) {
    console.error('Erro ao salvar bbb26.json:', error);
    return NextResponse.json({
      error: 'Erro ao salvar arquivo',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}