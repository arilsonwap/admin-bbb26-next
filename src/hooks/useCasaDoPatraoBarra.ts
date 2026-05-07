'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAdminApiKey } from '@/lib/adminClientHeaders';

type CasaDoPatraoBarraStatus = 'idle' | 'running' | 'success' | 'error';

type CasaDoPatraoBarraExecution = {
  startedAt: string;
  finishedAt?: string;
  publishedMainUrl?: string;
  publishedLatestUrl?: string;
};

function parseSseChunks(chunk: string, onEvent: (evt: { event?: string; data?: string }) => void) {
  const parts = chunk.split('\n\n');
  for (const part of parts) {
    const lines = part
      .split('\n')
      .map((l) => l.trimEnd())
      .filter(Boolean);
    if (lines.length === 0) continue;
    let eventName: string | undefined;
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart());
      }
    }
    if (eventName || dataLines.length) {
      onEvent({ event: eventName, data: dataLines.join('\n') });
    }
  }
}

export function useCasaDoPatraoBarra() {
  const [status, setStatus] = useState<CasaDoPatraoBarraStatus>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [lastExecution, setLastExecution] = useState<CasaDoPatraoBarraExecution | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);
  const toggleLogsExpanded = useCallback(() => setLogsExpanded((p) => !p), []);

  const run = useCallback(async () => {
    if (status === 'running') return;

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setStatus('running');
    setError(null);
    setLogs([]);
    setLogsExpanded(true);
    completedRef.current = false;

    const startedAt = new Date().toISOString();
    setLastExecution({
      startedAt,
      publishedMainUrl: '/api/hosting-public/casa-do-patrao-participantes-barra.json',
      publishedLatestUrl: '/api/hosting-public/casa-do-patrao-participantes-barra-latest.json',
    });

    try {
      const res = await fetch('/api/run-casa-do-patrao-barra', {
        method: 'GET',
        headers: {
          'x-api-key': getAdminApiKey(),
          accept: 'text/event-stream',
        },
        signal: abort.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(body || `HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error('Resposta sem body (stream indisponível).');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      const pushLog = (line: string) => {
        setLogs((prev) => [...prev, line]);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        buffer += chunk;
        const lastSep = buffer.lastIndexOf('\n\n');
        if (lastSep === -1) continue;
        const ready = buffer.slice(0, lastSep);
        buffer = buffer.slice(lastSep + 2);

        parseSseChunks(ready, ({ event, data }) => {
          if (typeof data === 'string' && data.length > 0) {
            pushLog(data);
          }

          const statusCandidate = data?.trim();
          if (
            (event === 'status' && (statusCandidate === 'success' || statusCandidate === 'error')) ||
            statusCandidate === 'success' ||
            statusCandidate === 'error'
          ) {
            if (completedRef.current) return;
            completedRef.current = true;
            const finalStatus = statusCandidate === 'success' ? 'success' : 'error';
            setStatus(finalStatus);
            setLastExecution((prev) =>
              prev
                ? { ...prev, finishedAt: new Date().toISOString() }
                : { startedAt, finishedAt: new Date().toISOString() }
            );
          }
        });
      }

      if (!completedRef.current) {
        setStatus('error');
        setError('Conexão encerrada sem status final (success/error).');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setStatus('error');
      setError(msg);
      setLogs((prev) => [...prev, `❌ ${msg}`]);
    } finally {
      abortRef.current = null;
    }
  }, [status]);

  return {
    status,
    isRunning: status === 'running',
    lastExecution,
    logs,
    logsExpanded,
    error,
    run,
    clearLogs,
    toggleLogsExpanded,
  };
}

