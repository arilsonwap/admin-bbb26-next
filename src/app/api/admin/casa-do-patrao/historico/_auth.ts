import { NextRequest } from 'next/server';

export function assertCasaDoPatraoHistoricoAdmin(request: NextRequest): void {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY;
  if (process.env.NODE_ENV === 'production' && (!expectedApiKey || expectedApiKey.trim().length === 0)) {
    throw new Error('Configuração ausente: defina ADMIN_API_KEY em produção.');
  }
  const fallback = 'admin-bbb26-dev-key';
  const effectiveKey = expectedApiKey && expectedApiKey.trim().length > 0 ? expectedApiKey : fallback;
  if (!apiKey || apiKey !== effectiveKey) {
    throw new Error('Acesso negado');
  }
}
