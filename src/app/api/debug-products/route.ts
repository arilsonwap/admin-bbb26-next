import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { ProductsJsonPayloadSchema } from '../../../models/types';

// Forçar execução dinâmica e desabilitar cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'tools', 'bbb-hosting', 'public', 'products-status.json');

    // Verificar timestamp do arquivo para detectar cache
    const fileStat = await stat(filePath);
    const fileContent = await readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    console.log('📖 Debug products - leitura:', {
      version: data.version,
      updatedAt: data.updatedAt,
      fileModified: new Date(fileStat.mtime).toISOString(),
      timestamp: new Date().toISOString(),
      age: Date.now() - fileStat.mtime.getTime(),
      query: new URLSearchParams(new URL(`http://dummy${process.env.REQUEST_URL || ''}`).search).get('t')
    });

    // Validar os dados
    const validation = ProductsJsonPayloadSchema.safeParse(data);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Dados inválidos',
        details: validation.error.issues
      }, { status: 400 });
    }

    return NextResponse.json({
      ...data,
      _cache_bust: Date.now() // Prevenir cache
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }); // Retornar os dados validados
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      cwd: process.cwd(),
      filePath: join(process.cwd(), 'tools', 'bbb-hosting', 'public', 'products-status.json')
    }, { status: 500 });
  }
}