/**
 * Proteção da rota de sincronização VPS → máquina local (rsync de JSONs).
 *
 * Regras:
 * - Em produção (NODE_ENV=production) a rota fica desligada por padrão, para que
 *   um deploy no VPS não exponha execução de shell.
 * - Ambientes hospedados (ex.: Vercel) são bloqueados via VERCEL.
 * - Se você rodar `next start` localmente com NODE_ENV=production, defina
 *   ALLOW_VPS_JSON_SYNC_LOCAL=1 para permitir (ainda assim inútil na Vercel).
 */

export type LocalVpsJsonSyncGuardResult =
  | { ok: true }
  | { ok: false; message: string; status: number };

export function assertLocalVpsJsonSyncAllowed(): LocalVpsJsonSyncGuardResult {
  if (process.env.VERCEL === "1") {
    return {
      ok: false,
      message:
        "Sincronização de JSONs do VPS está desativada neste ambiente (build hospedado). Use apenas no admin rodando no seu PC (next dev).",
      status: 403,
    };
  }

  const allowProdLocal = process.env.ALLOW_VPS_JSON_SYNC_LOCAL === "1";
  if (process.env.NODE_ENV === "production" && !allowProdLocal) {
    return {
      ok: false,
      message:
        "Rota exclusiva de desenvolvimento: NODE_ENV é production. Em produção no VPS ela não executa. Localmente use `npm run dev` ou defina ALLOW_VPS_JSON_SYNC_LOCAL=1 se estiver em `next start` com production.",
      status: 403,
    };
  }

  return { ok: true };
}
