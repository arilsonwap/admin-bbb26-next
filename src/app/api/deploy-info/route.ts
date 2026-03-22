import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Buscar informações do último deploy do Firebase Hosting
    const response = await fetch('https://bbb-26.web.app/_deploy.json', {
      next: { revalidate: 60 }, // Cache por 1 minuto
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Não foi possível buscar informações do deploy' },
        { status: response.status }
      );
    }

    const deployInfo = await response.json();

    return NextResponse.json({
      deployAt: deployInfo.deployAt,
      version: deployInfo.version,
      lastDeploy: new Date(deployInfo.deployAt).toLocaleString('pt-BR'),
      url: 'https://bbb-26.web.app'
    });

  } catch (error) {
    console.error('Erro ao buscar informações do deploy:', error);
    return NextResponse.json(
      { error: 'Erro interno ao buscar informações do deploy' },
      { status: 500 }
    );
  }
}