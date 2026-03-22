import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, statSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { data, filename } = await request.json();

    if (!data) {
      return NextResponse.json({ error: 'Dados não fornecidos' }, { status: 400 });
    }

    // Determinar o nome do arquivo (suporte a backup)
    const targetFilename = filename || 'followers-status.json';

    let filePath: string;

    if (filename && filename.startsWith('followers-status-backup-')) {
      // Salvar backups em pasta dedicada
      const backupsDir = join(process.cwd(), 'tools', 'bbb-hosting', 'followers-backups');

      // Criar diretório se não existir
      try {
        const fs = require('fs');
        if (!fs.existsSync(backupsDir)) {
          fs.mkdirSync(backupsDir, { recursive: true });
        }
      } catch (error) {
        console.warn('Não foi possível criar diretório de backups:', error);
      }

      filePath = join(backupsDir, targetFilename);
    } else {
      // Salvar dados atuais em tools/bbb-hosting/public
      filePath = join(process.cwd(), 'tools', 'bbb-hosting', 'public', targetFilename);
    }

    // Salvar os dados no local apropriado
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

    // Se não for backup, manter cópias para compatibilidade
    if (!filename) {
      // Salvar na raiz do projeto
      const rootPath = join(process.cwd(), 'followers-status.json');
      writeFileSync(rootPath, JSON.stringify(data, null, 2), 'utf8');

      // Salvar na pasta public do Next.js (para servir via HTTP)
      const publicPath = join(process.cwd(), 'public', 'followers-status.json');
      writeFileSync(publicPath, JSON.stringify(data, null, 2), 'utf8');

      // Atualizar metadados do arquivo latest
      const hostingDir = join(process.cwd(), 'tools', 'bbb-hosting', 'public');
      const latestPath = join(hostingDir, 'followers-status-latest.json');

      const stats = statSync(filePath);
      const latestData = {
        file: 'followers-status.json',
        lastModified: new Date().toISOString(),
        localDate: new Date().toISOString().split('T')[0],
        bytes: stats.size
      };

      writeFileSync(latestPath, JSON.stringify(latestData, null, 2), 'utf8');
    }

    return NextResponse.json({
      success: true,
      message: `Arquivo ${targetFilename} salvo com sucesso`
    });

  } catch (error) {
    console.error('Erro ao salvar followers-status.json:', error);
    return NextResponse.json({
      error: 'Erro ao salvar arquivo',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}