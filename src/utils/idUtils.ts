export function generateId(prefix: string = ''): string {
  // Browser/Edge runtime
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return prefix ? `${prefix}-${crypto.randomUUID()}` : crypto.randomUUID();
  }

  // Fallback (não garante UUID v4, mas garante unicidade prática para o painel)
  return `${prefix ? `${prefix}-` : ''}${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** UUID v4 puro para colunas Postgres `uuid` (ex.: `polls.id`, `options.id`). */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

