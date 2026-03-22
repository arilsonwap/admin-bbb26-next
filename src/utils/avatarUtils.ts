// Sistema inteligente de avatares BBB26
// Baseado no sistema híbrido: imagens locais + avatares automáticos

// Mapeamento de imagens locais por nome normalizado (URLs diretas da pasta public)
const localImages: Record<string, string> = {
  // VETERANOS
  [normalizeName('Alberto "Cowboy"')]: '/participants/alberto-cowboy.png',
  [normalizeName('Alberto Cowboy')]: '/participants/alberto-cowboy.png',
  [normalizeName('Ana Paula Renault')]: '/participants/ana-paula-renault.png',
  [normalizeName('Babu Santana')]: '/participants/babu-santana.png',
  [normalizeName('Jonas Sulzbach')]: '/participants/jonas-sulzbach.png',
  [normalizeName('Sarah Andrade')]: '/participants/sarah-andrade.png',
  [normalizeName('Sol Vega')]: '/participants/sol-vega.png',

  // CAMAROTE
  [normalizeName('Aline Campos')]: '/participants/aline-campos.png',
  [normalizeName('Edílson')]: '/participants/edilson.png',
  [normalizeName('Edilson')]: '/participants/edilson.png',
  [normalizeName('Henri Castelli')]: '/participants/henri-castelli.png',
  [normalizeName('Juliano Floss')]: '/participants/juliano-floss.png',
  [normalizeName('Solange Couto')]: '/participants/solange-couto.png',

  // PIPOCA
  [normalizeName('Breno')]: '/participants/breno.png',
  [normalizeName('Brígido')]: '/participants/brigido.png',
  [normalizeName('Brigido')]: '/participants/brigido.png',
  [normalizeName('Chaiany')]: '/participants/chaiany.png',
  [normalizeName('Gabriela')]: '/participants/gabriela.png',
  [normalizeName('Jordana')]: '/participants/jordana.png',
  [normalizeName('Leandro')]: '/participants/leandro.png',
  [normalizeName('Marcelo')]: '/participants/marcelo.png',
  [normalizeName('Marciele')]: '/participants/marciele.png',
  [normalizeName('Matheus')]: '/participants/matheus.png',
  [normalizeName('Maxiane')]: '/participants/maxiane.png',
  [normalizeName('Milena')]: '/participants/milena.png',
  [normalizeName('Paulo Augusto')]: '/participants/paulo-augusto.png',
  [normalizeName('Samira')]: '/participants/samira.png',
};

/**
 * Normaliza nomes para busca case-insensitive e sem acentos
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais exceto espaços e hífens
    .trim();
}

/**
 * Gera avatar automático usando UI Avatars
 */
export function getAutomaticAvatar(name: string, size: number = 40): string {
  // Proteção contra nomes vazios ou undefined
  const safeName = name && typeof name === 'string' && name.trim() ? name.trim() : 'XX';

  const initials = safeName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  // Garantir que temos pelo menos 2 caracteres
  const finalInitials = initials.length >= 2 ? initials : (initials + 'X').slice(0, 2);

  // Cores baseadas no nome para consistência
  const colors = [
    '3B82F6', // blue-500
    'EF4444', // red-500
    '10B981', // emerald-500
    'F59E0B', // amber-500
    '8B5CF6', // violet-500
    'EC4899', // pink-500
    '06B6D4', // cyan-500
    '84CC16', // lime-500
  ];

  const colorIndex = safeName.length % colors.length;
  const bgColor = colors[colorIndex];

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(finalInitials)}&size=${size}&background=${bgColor}&color=FFFFFF&font-size=0.6&bold=true`;
}

/**
 * Sistema híbrido inteligente:
 * 1. Primeiro: busca imagem local (se existir)
 * 2. Fallback: avatar automático
 */
export function getParticipantImage(name: string | undefined | null): string {
  // Proteção contra valores undefined/null/vazios
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return getAutomaticAvatar('');
  }

  // Forçar imagens locais para participantes conhecidos (fallback mais robusto)
  const lowerName = name.toLowerCase().trim();

  // Mapeamento direto por palavras-chave (mais confiável)
  const directMappings: Record<string, string> = {
    'babu santana': '/participants/babu-santana.png',
    'sol vega': '/participants/sol-vega.png',
    'jonas sulzbach': '/participants/jonas-sulzbach.png',
    'sarah andrade': '/participants/sarah-andrade.png',
    'alberto cowboy': '/participants/alberto-cowboy.png',
    'ana paula renault': '/participants/ana-paula-renault.png',
    'aline campos': '/participants/aline-campos.png',
    'edilson': '/participants/edilson.png',
    'henri castelli': '/participants/henri-castelli.png',
    'juliano floss': '/participants/juliano-floss.png',
    'solange couto': '/participants/solange-couto.png',
    'breno': '/participants/breno.png',
    'brigido': '/participants/brigido.png',
    'chaiany': '/participants/chaiany.png',
    'gabriela': '/participants/gabriela.png',
    'jordana': '/participants/jordana.png',
    'leandro': '/participants/leandro.png',
    'marcelo': '/participants/marcelo.png',
    'marciele': '/participants/marciele.png',
    'matheus': '/participants/matheus.png',
    'maxiane': '/participants/maxiane.png',
    'milena': '/participants/milena.png',
    'paulo augusto': '/participants/paulo-augusto.png',
    'samira': '/participants/samira.png'
  };

  // Primeiro tentar mapeamento direto (mais confiável)
  if (directMappings[lowerName]) {
    return directMappings[lowerName];
  }

  // Fallback para o mapeamento normalizado
  const normalizedKey = normalizeName(name);
  const localImage = localImages[normalizedKey];
  if (localImage) {
    return localImage;
  }

  // Último fallback: avatar automático
  return getAutomaticAvatar(name);
}

/**
 * Verifica se um participante tem imagem local
 */
export function hasLocalImage(name: string): boolean {
  const normalizedKey = normalizeName(name);
  return localImages[normalizedKey] !== undefined;
}

/**
 * Obtém apenas o avatar automático (útil para previews)
 */
export function getAvatarUrl(name: string, size: number = 40): string {
  return getAutomaticAvatar(name, size);
}

/**
 * Lista todos os participantes que têm imagens locais
 */
export function getParticipantsWithLocalImages(): string[] {
  return Object.keys(localImages).map(normalizedName => {
    // Tenta encontrar o nome original (inverso da normalização)
    // Isso é aproximado, mas funciona para debug
    return Object.keys(localImages).find(key => normalizeName(key) === normalizedName) || normalizedName;
  });
}

// Debug: verifica se um nome específico tem imagem
export function debugParticipantImage(name: string): { hasImage: boolean; normalizedKey: string; imageUrl?: string } {
  const normalizedKey = normalizeName(name);
  const hasImage = localImages[normalizedKey] !== undefined;

  return {
    hasImage,
    normalizedKey,
    imageUrl: hasImage ? localImages[normalizedKey] : undefined
  };
}