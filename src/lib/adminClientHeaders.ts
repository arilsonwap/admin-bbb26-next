/** Headers usados pelos clients admin no browser (mesmo padrão de polls/banners/push). */
export function getAdminApiKey(): string {
  const key = process.env.NEXT_PUBLIC_ADMIN_API_KEY;
  if (process.env.NODE_ENV === 'production' && (!key || key.trim().length === 0)) {
    throw new Error(
      'Configuração ausente: defina NEXT_PUBLIC_ADMIN_API_KEY em produção (deve ser igual ao ADMIN_API_KEY do servidor).'
    );
  }
  return (key && key.trim().length > 0 ? key : 'admin-bbb26-dev-key');
}

export function adminJsonHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-api-key': getAdminApiKey(),
  };
}
