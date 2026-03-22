import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { data } = await request.json();

    if (!data) {
      return NextResponse.json({ error: 'Dados não fornecidos' }, { status: 400 });
    }

    // Caminho para o arquivo participants-status.json em tools/bbb-hosting/public
    const hostingPath = join(process.cwd(), 'tools', 'bbb-hosting', 'public', 'participants-status.json');

    // Salvar os dados no arquivo de hospedagem
    writeFileSync(hostingPath, JSON.stringify(data, null, 2), 'utf8');

    // Manter cópia na raiz para compatibilidade
    const rootPath = join(process.cwd(), 'participants-status.json');
    writeFileSync(rootPath, JSON.stringify(data, null, 2), 'utf8');

    return NextResponse.json({
      success: true,
      message: 'Arquivo participants-status.json atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao salvar participants-status.json:', error);
    return NextResponse.json({
      error: 'Erro ao salvar arquivo',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}