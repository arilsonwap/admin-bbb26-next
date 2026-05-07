import React from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  LockClosedIcon,
  PauseCircleIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import type { PollLifecycleStatus } from '../../models/pollsTypes';

const LABELS: Record<PollLifecycleStatus, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  active: 'Ativa',
  paused: 'Pausada',
  closed: 'Encerrada',
};

export function PollStatusBadge({ status }: { status: PollLifecycleStatus }) {
  const styles: Record<PollLifecycleStatus, string> = {
    draft: 'bg-gray-100 border-gray-200 text-gray-800',
    scheduled: 'bg-blue-50 border-blue-200 text-blue-900',
    active: 'bg-green-50 border-green-200 text-green-900',
    paused: 'bg-amber-50 border-amber-200 text-amber-900',
    closed: 'bg-slate-100 border-slate-200 text-slate-800',
  };

  const icon =
    status === 'active' ? (
      <CheckCircleIcon className="h-4 w-4 mr-1.5 text-green-600 shrink-0" aria-hidden />
    ) : status === 'closed' ? (
      <LockClosedIcon className="h-4 w-4 mr-1.5 text-slate-600 shrink-0" aria-hidden />
    ) : status === 'scheduled' ? (
      <ClockIcon className="h-4 w-4 mr-1.5 text-blue-600 shrink-0" aria-hidden />
    ) : status === 'paused' ? (
      <PauseCircleIcon className="h-4 w-4 mr-1.5 text-amber-600 shrink-0" aria-hidden />
    ) : (
      <PencilSquareIcon className="h-4 w-4 mr-1.5 text-gray-500 shrink-0" aria-hidden />
    );

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${styles[status]}`}
    >
      {icon}
      {LABELS[status]}
    </span>
  );
}
