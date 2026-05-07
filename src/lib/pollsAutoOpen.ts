import type { PollRow } from '../models/pollsTypes';

/** Desempate: maior `auto_open_priority`, depois mais recente. */
export function resolveAutoOpenWinner(polls: PollRow[]): PollRow | null {
  const candidates = polls.filter(
    (p) =>
      p.auto_open_on_app_launch && (p.status === 'active' || p.status === 'scheduled')
  );
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    if (b.auto_open_priority !== a.auto_open_priority) {
      return b.auto_open_priority - a.auto_open_priority;
    }
    const tb = new Date(b.created_at).getTime();
    const ta = new Date(a.created_at).getTime();
    if (!Number.isNaN(tb) && !Number.isNaN(ta) && tb !== ta) return tb - ta;
    return String(b.id).localeCompare(String(a.id));
  })[0]!;
}

export function homeHubActivePolls(polls: PollRow[]): PollRow[] {
  return polls.filter(
    (p) => p.type === 'home' && p.status === 'active' && p.show_in_home_hub !== false
  );
}
