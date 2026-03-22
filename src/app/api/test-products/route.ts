import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    // Tentar ler o arquivo JSON
    const filePath = join(process.cwd(), 'public', 'tools', 'bbb-hosting', 'public', 'products-status.json');
    const fileContent = await readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    return NextResponse.json({
      success: true,
      productsCount: data.products?.length || 0,
      version: data.version,
      sample: data.products?.[0]?.title || 'No products found'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      cwd: process.cwd()
    }, { status: 500 });
  }
}