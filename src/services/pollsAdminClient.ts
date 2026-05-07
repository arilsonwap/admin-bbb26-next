import {
  PollCreateInput,
  PollOptionInput,
  PollOptionRow,
  PollRow,
  PollUpdateInput,
} from '../models/pollsTypes';

const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || 'admin-bbb26-dev-key';

export class PollsApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'PollsApiError';
  }
}

function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': ADMIN_API_KEY,
  };
}

async function handleJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const o = body as { message?: string; error?: string; code?: string } | null;
    const message = o?.message ?? o?.error ?? `Erro HTTP ${res.status}`;
    throw new PollsApiError(message, o?.code, res.status);
  }
  return body as T;
}

export async function listPolls(): Promise<PollRow[]> {
  const res = await fetch('/api/polls', {
    method: 'GET',
    headers: adminHeaders(),
    cache: 'no-store',
  });
  return handleJson<PollRow[]>(res);
}

export async function createPoll(payload: {
  poll: PollCreateInput;
  options: PollOptionInput[];
}): Promise<{ poll: PollRow }> {
  const res = await fetch('/api/polls', {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJson<{ poll: PollRow }>(res);
}

export async function getPoll(pollId: string): Promise<{
  poll: PollRow;
  options: PollOptionRow[];
}> {
  const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}`, {
    method: 'GET',
    headers: adminHeaders(),
    cache: 'no-store',
  });
  return handleJson<{ poll: PollRow; options: PollOptionRow[] }>(res);
}

export async function updatePoll(payload: {
  pollId: string;
  poll: PollUpdateInput;
  options: PollOptionInput[];
}): Promise<void> {
  const res = await fetch(`/api/polls/${encodeURIComponent(payload.pollId)}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({
      poll: payload.poll,
      options: payload.options,
    }),
  });
  await handleJson<{ success: true }>(res);
}

export async function publishPoll(pollId: string): Promise<PollRow[]> {
  const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}/publish`, {
    method: 'POST',
    headers: adminHeaders(),
  });
  const data = await handleJson<{ success: true; polls: PollRow[] }>(res);
  return data.polls;
}

export async function closePoll(pollId: string): Promise<PollRow[]> {
  const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}/close`, {
    method: 'POST',
    headers: adminHeaders(),
  });
  const data = await handleJson<{ success: true; polls: PollRow[] }>(res);
  return data.polls;
}

export async function pausePoll(pollId: string): Promise<PollRow[]> {
  const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}/pause`, {
    method: 'POST',
    headers: adminHeaders(),
  });
  const data = await handleJson<{ success: true; polls: PollRow[] }>(res);
  return data.polls;
}

export async function duplicatePoll(pollId: string): Promise<{ poll: PollRow; polls: PollRow[] }> {
  const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}/duplicate`, {
    method: 'POST',
    headers: adminHeaders(),
  });
  return handleJson<{ poll: PollRow; polls: PollRow[] }>(res);
}

export async function setPollAutoOpenPriority(
  pollId: string,
  auto_open_priority: number
): Promise<PollRow[]> {
  const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}/priority`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify({ auto_open_priority }),
  });
  const data = await handleJson<{ success: true; polls: PollRow[] }>(res);
  return data.polls;
}
