import type {
  PollCreateInput,
  PollLifecycleStatus,
  PollOptionInput,
  PollOptionRow,
  PollRow,
  PollType,
  PollUpdateInput,
} from '../models/pollsTypes';

type SupabaseRestError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ADMIN_KEY;

  if (!supabaseUrl) {
    throw new Error('Config Supabase ausente: defina SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL).');
  }

  if (!serviceRoleKey) {
    throw new Error('Config Supabase ausente: defina SUPABASE_SERVICE_ROLE_KEY (ou equivalente).');
  }

  return { supabaseUrl, serviceRoleKey };
}

async function supabaseFetch<T>(pathWithQuery: string, init: RequestInit): Promise<T> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1${pathWithQuery}`;
  const hasBody = init.body !== undefined && init.body !== null;
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => null)) as T | SupabaseRestError | null;

  if (!res.ok) {
    const err = data as SupabaseRestError | null;
    throw new Error(err?.message || `Erro Supabase REST HTTP ${res.status}`);
  }

  return data as T;
}

function unwrapRpcRow<T extends Record<string, unknown>>(data: unknown): T {
  if (Array.isArray(data) && data.length === 1 && data[0] && typeof data[0] === 'object') {
    return data[0] as T;
  }
  return data as T;
}

/** RPC retornando jsonb único (PostgREST pode envolver em array de 1 elemento). */
function unwrapRpcJsonValue<T>(data: unknown): T {
  if (Array.isArray(data) && data.length === 1 && data[0] !== undefined) {
    return data[0] as T;
  }
  return data as T;
}

/** Colunas canônicas (v3). */
const POLL_SELECT =
  'id,title,subtitle,description,status,type,open_at,close_at,auto_open_on_app_launch,auto_open_priority,show_in_home_hub,allow_multiple_votes,created_at,updated_at';

/** Colunas alinhadas ao banco atual (sem `participant_id` até migração aplicada). */
const OPTIONS_SELECT = 'id,poll_id,label,image_url,created_at';

export function normalizePollRow(r: Record<string, unknown>): PollRow {
  const stRaw = String(r.status ?? 'draft');
  const st: PollLifecycleStatus =
    stRaw === 'open'
      ? 'active'
      : (['draft', 'scheduled', 'active', 'paused', 'closed'].includes(stRaw)
          ? stRaw
          : 'draft') as PollLifecycleStatus;

  const typeRaw = r.type;
  const type: PollType = typeRaw === 'paredao' ? 'paredao' : 'home';

  return {
    id: String(r.id),
    title: String(r.title ?? ''),
    subtitle: r.subtitle != null ? String(r.subtitle) : null,
    description: r.description != null ? String(r.description) : null,
    status: st,
    type,
    open_at: (r.open_at as string | null | undefined) ?? null,
    close_at: (r.close_at as string | null | undefined) ?? null,
    auto_open_on_app_launch: Boolean(r.auto_open_on_app_launch),
    auto_open_priority: typeof r.auto_open_priority === 'number' ? r.auto_open_priority : 0,
    show_in_home_hub: r.show_in_home_hub !== false,
    allow_multiple_votes: Boolean(r.allow_multiple_votes),
    created_at: String(r.created_at ?? new Date().toISOString()),
    updated_at: r.updated_at != null ? String(r.updated_at) : undefined,
  };
}

async function promotePollsLifecycle(): Promise<void> {
  try {
    await supabaseFetch<unknown>('/rpc/promote_polls_lifecycle', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: '{}',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // best-effort: não bloquear leituras se o RPC estiver lento (evita 504 em proxy/cliente curto)
  }
}

function buildPollWriteBody(
  input: Partial<PollCreateInput> & { status?: PollLifecycleStatus },
  options: { includeId?: boolean; id?: string }
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (options.includeId && options.id) body.id = options.id;
  if (input.title !== undefined) body.title = input.title;
  if (input.subtitle !== undefined) body.subtitle = input.subtitle;
  if (input.description !== undefined) body.description = input.description;
  if (input.status !== undefined) body.status = input.status;
  if (input.type !== undefined) body.type = input.type;
  if (input.open_at !== undefined) body.open_at = input.open_at;
  if (input.close_at !== undefined) body.close_at = input.close_at;
  if (input.auto_open_on_app_launch !== undefined) body.auto_open_on_app_launch = input.auto_open_on_app_launch;
  if (input.auto_open_priority !== undefined) body.auto_open_priority = input.auto_open_priority;
  if (input.show_in_home_hub !== undefined) body.show_in_home_hub = input.show_in_home_hub;
  if (input.allow_multiple_votes !== undefined) body.allow_multiple_votes = input.allow_multiple_votes;
  body.updated_at = new Date().toISOString();
  return body;
}

function buildOptionRowsForUpsert(pollId: string, options: PollOptionInput[]): Record<string, unknown>[] {
  return options.map((o) => ({
    id: o.id,
    poll_id: pollId,
    label: o.label,
    image_url: o.image_url ?? null,
  }));
}

async function fetchOptionsForPoll(pollId: string): Promise<PollOptionRow[]> {
  const rows = await supabaseFetch<Record<string, unknown>[]>(
    `/options?select=${OPTIONS_SELECT}&poll_id=eq.${encodeURIComponent(pollId)}&order=id.asc`,
    { method: 'GET' }
  );
  return rows.map((r) => ({
    id: String(r.id),
    poll_id: String(r.poll_id),
    label: String(r.label ?? ''),
    image_url: r.image_url != null ? String(r.image_url) : null,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
  }));
}

async function upsertOptionsForPoll(pollId: string, options: PollOptionInput[]): Promise<void> {
  const rows = buildOptionRowsForUpsert(pollId, options);
  await supabaseFetch<PollOptionRow[]>(
    `/options?on_conflict=id&select=${OPTIONS_SELECT}`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates, return=representation' },
      body: JSON.stringify(rows),
    }
  );
}

async function patchPollFields(pollId: string, patch: Record<string, unknown>): Promise<void> {
  const body = { ...patch, updated_at: new Date().toISOString() };
  await supabaseFetch<unknown>(`/polls?id=eq.${encodeURIComponent(pollId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
}

function assertRpcOk(res: Record<string, unknown>, action: string): void {
  if (res.ok === false) {
    throw new Error(`${action}: ${String(res.error ?? 'failed')}`);
  }
}

export async function listPolls(): Promise<PollRow[]> {
  await promotePollsLifecycle();

  const raw = await supabaseFetch<Record<string, unknown>[]>(
    `/polls?select=${POLL_SELECT}&order=created_at.desc`,
    { method: 'GET' }
  );

  return raw.map(normalizePollRow);
}

export async function getPollWithOptions(pollId: string): Promise<{
  poll: PollRow;
  options: PollOptionRow[];
}> {
  await promotePollsLifecycle();

  const pollRows = await supabaseFetch<Record<string, unknown>[]>(
    `/polls?select=${POLL_SELECT}&id=eq.${encodeURIComponent(pollId)}&limit=1`,
    { method: 'GET' }
  );

  if (!pollRows || pollRows.length === 0) {
    throw new Error('poll_not_found');
  }

  const options = await fetchOptionsForPoll(pollId);

  return { poll: normalizePollRow(pollRows[0]!), options };
}

export async function upsertPoll(poll: PollCreateInput): Promise<PollRow[]> {
  const body = buildPollWriteBody(
    {
      ...poll,
      status: poll.status ?? 'draft',
      subtitle: poll.subtitle ?? null,
      description: poll.description ?? null,
      open_at: poll.open_at ?? null,
      close_at: poll.close_at ?? null,
      auto_open_on_app_launch: poll.auto_open_on_app_launch ?? false,
      auto_open_priority: poll.auto_open_priority ?? 0,
      show_in_home_hub: poll.show_in_home_hub ?? true,
      allow_multiple_votes: poll.allow_multiple_votes ?? false,
    },
    { includeId: true, id: poll.id }
  );

  const rows = await supabaseFetch<Record<string, unknown>[]>(
    `/polls?select=${POLL_SELECT}&on_conflict=id`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates, return=representation' },
      body: JSON.stringify({ ...body, id: poll.id }),
    }
  );
  return rows.map((r) => normalizePollRow(r));
}

export async function updatePoll(pollId: string, updates: PollUpdateInput): Promise<PollRow[]> {
  const body = buildPollWriteBody(updates, {});
  const rows = await supabaseFetch<Record<string, unknown>[]>(
    `/polls?id=eq.${encodeURIComponent(pollId)}&select=${POLL_SELECT}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    }
  );
  return rows.map((r) => normalizePollRow(r));
}

export async function upsertOptions(pollId: string, options: PollOptionInput[]): Promise<void> {
  const sanitized: PollOptionInput[] = options.map((o) => ({
    id: o.id,
    poll_id: pollId,
    label: o.label,
    image_url: o.image_url ?? null,
  }));

  await upsertOptionsForPoll(pollId, sanitized);

  const incomingIds = new Set(sanitized.map((o) => o.id));
  const existing = await supabaseFetch<PollOptionRow[]>(
    `/options?select=id&poll_id=eq.${encodeURIComponent(pollId)}`,
    { method: 'GET' }
  );

  const toDelete = existing.filter((o) => !incomingIds.has(o.id)).map((o) => o.id);
  await Promise.all(
    toDelete.map((optionId) =>
      supabaseFetch<unknown>(`/options?id=eq.${encodeURIComponent(optionId)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      })
    )
  );
}

export async function publishPoll(pollId: string): Promise<void> {
  const raw = await supabaseFetch<unknown>('/rpc/admin_publish_poll', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ p_poll_id: pollId }),
  });
  assertRpcOk(unwrapRpcRow<Record<string, unknown>>(raw), 'admin_publish_poll');
}

export async function closePoll(pollId: string): Promise<void> {
  const raw = await supabaseFetch<unknown>('/rpc/admin_close_poll', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ p_poll_id: pollId }),
  });
  assertRpcOk(unwrapRpcRow<Record<string, unknown>>(raw), 'admin_close_poll');
}

export async function pausePoll(pollId: string): Promise<void> {
  const raw = await supabaseFetch<unknown>('/rpc/admin_pause_poll', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ p_poll_id: pollId }),
  });
  assertRpcOk(unwrapRpcRow<Record<string, unknown>>(raw), 'admin_pause_poll');
}

export async function setPollAutoOpenPriority(pollId: string, auto_open_priority: number): Promise<void> {
  await patchPollFields(pollId, { auto_open_priority });
}

export async function duplicatePoll(sourcePollId: string): Promise<PollRow> {
  const raw = await supabaseFetch<unknown>('/rpc/admin_duplicate_poll', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ p_poll_id: sourcePollId }),
  });
  const res = unwrapRpcRow<Record<string, unknown>>(raw);
  assertRpcOk(res, 'admin_duplicate_poll');
  const newId = res.new_poll_id;
  if (typeof newId !== 'string' || !newId) {
    throw new Error('admin_duplicate_poll: new_poll_id ausente');
  }
  const { poll } = await getPollWithOptions(newId);
  return poll;
}

/** Espelha a RPC (já inclui promote interno). */
export async function rpcGetPollsBootstrap(): Promise<unknown> {
  return supabaseFetch<unknown>('/rpc/get_polls_bootstrap', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: '{}',
  });
}

/** `get_active_polls` — enquetes ativas na janela de voto (home hub + paredão). */
export async function rpcGetActivePollsJson(): Promise<{
  polls: Record<string, unknown>[];
}> {
  const raw = await supabaseFetch<unknown>('/rpc/get_active_polls', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: '{}',
  });
  const row = unwrapRpcJsonValue<Record<string, unknown>>(raw);
  const pollsRaw = row.polls;
  const polls = Array.isArray(pollsRaw)
    ? pollsRaw.filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null && !Array.isArray(p))
    : [];
  return { polls };
}

/**
 * Estado de exibição v2 — mesmo contrato que o app valida em `parsePollDisplayStateV2`
 * (schemaVersion 2, homeCard, hub, paredaoFlow, coldStartTarget).
 */
export async function buildPollDisplayStateV2ForApp(): Promise<Record<string, unknown>> {
  const bootstrapRaw = await rpcGetPollsBootstrap();
  const bootstrap = unwrapRpcJsonValue<Record<string, unknown>>(bootstrapRaw);
  const launch = bootstrap.launch_poll as Record<string, unknown> | null | undefined;
  const homePollsRaw = bootstrap.home_polls;
  const homePolls = Array.isArray(homePollsRaw) ? homePollsRaw : [];

  let coldStartTarget: 'none' | 'hub' | 'paredao_flow' = 'none';
  if (launch && typeof launch === 'object' && launch.type != null) {
    const t = String(launch.type);
    if (t === 'home') coldStartTarget = 'hub';
    else if (t === 'paredao') coldStartTarget = 'paredao_flow';
  }

  const firstHome = homePolls[0] as Record<string, unknown> | undefined;
  const homeCardEnabled = homePolls.length > 0;
  const homeCardPollId =
    firstHome && typeof firstHome.id === 'string' ? firstHome.id : null;

  const { polls } = await rpcGetActivePollsJson();
  const paredaoPoll = polls.find((p) => String(p.type) === 'paredao');
  const paredaoEnabled = Boolean(paredaoPoll);
  const paredaoPollId =
    paredaoPoll && typeof paredaoPoll.id === 'string' ? paredaoPoll.id : null;

  const hubTypes = new Set<string>();
  for (const p of polls) {
    const ty = String(p.type ?? '');
    if (ty === 'paredao') {
      hubTypes.add('paredao');
    }
    if (ty === 'home' && p.show_in_home_hub !== false) {
      hubTypes.add('home');
    }
  }
  const listPollTypes = Array.from(hubTypes);
  const hubEnabled = listPollTypes.length > 0;

  return {
    schemaVersion: 2,
    coldStartTarget,
    homeCard: { enabled: homeCardEnabled, pollId: homeCardPollId },
    hub: { enabled: hubEnabled, listPollTypes },
    paredaoFlow: { enabled: paredaoEnabled, pollId: paredaoPollId },
  };
}
