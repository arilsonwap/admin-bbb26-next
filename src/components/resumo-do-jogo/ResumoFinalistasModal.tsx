'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { adminJsonHeaders } from '@/lib/adminClientHeaders';

type ParticipanteRow = { id: string; nome: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

function normalizeParticipantes(raw: unknown): ParticipanteRow[] {
  const rows: { id: string }[] = [];
  if (Array.isArray(raw)) {
    for (const p of raw) {
      if (p && typeof p === 'object' && 'id' in p && typeof (p as { id: unknown }).id === 'string') {
        if (!('error' in p && (p as { error?: unknown }).error)) {
          rows.push({ id: (p as { id: string }).id });
        }
      }
    }
  } else if (raw && typeof raw === 'object' && 'id' in (raw as object)) {
    const p = raw as { id: string; error?: unknown };
    if (!p.error) {
      rows.push({ id: p.id });
    }
  }
  const idToNome = (id: string) =>
    id
      .split('-')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  return rows
    .map((r) => ({ id: r.id, nome: idToNome(r.id) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export const ResumoFinalistasModal: React.FC<Props> = ({ open, onClose, onSaved }) => {
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteRow[]>([]);

  const [primeiroId, setPrimeiroId] = useState('');
  const [segundoId, setSegundoId] = useState('');
  const [terceiroId, setTerceiroId] = useState('');

  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    setFeedback(null);
    try {
      const res = await fetch('/api/hosting-public/statusbbb.json', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'Arquivo statusbbb.json não encontrado.' : `Erro ${res.status}`);
      }
      const json = (await res.json()) as {
        participantes?: unknown;
        finalistas?: {
          ranking?: Array<{ id?: string; posicao?: number }>;
        };
      };
      const list = normalizeParticipantes(json.participantes);
      if (list.length < 1) {
        setListError('Não há participantes no JSON para escolher finalistas.');
        setParticipantes([]);
        return;
      }
      setParticipantes(list);

      const r = json.finalistas?.ranking;
      if (Array.isArray(r) && r.length >= 1) {
        const a = r.find((x) => x.posicao === 1)?.id ?? '';
        const b = r.find((x) => x.posicao === 2)?.id ?? '';
        const c = r.find((x) => x.posicao === 3)?.id ?? '';
        setPrimeiroId(typeof a === 'string' ? a : '');
        setSegundoId(typeof b === 'string' ? b : '');
        setTerceiroId(typeof c === 'string' ? c : '');
      } else {
        setPrimeiroId('');
        setSegundoId('');
        setTerceiroId('');
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Falha ao carregar JSON');
      setParticipantes([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadData();
    }
  }, [open, loadData]);

  useEffect(() => {
    if (!primeiroId) {
      setSegundoId('');
      setTerceiroId('');
    }
  }, [primeiroId]);

  useEffect(() => {
    if (!segundoId && terceiroId) {
      setTerceiroId('');
    }
  }, [segundoId, terceiroId]);

  const optionsFor = useMemo(() => {
    return (field: 'p' | 's' | 't') => {
      const selected =
        field === 'p'
          ? { self: primeiroId, other: [segundoId, terceiroId] }
          : field === 's'
            ? { self: segundoId, other: [primeiroId, terceiroId] }
            : { self: terceiroId, other: [primeiroId, segundoId] };
      return participantes.filter(
        (p) => !selected.other.includes(p.id) || p.id === selected.self
      );
    };
  }, [participantes, primeiroId, segundoId, terceiroId]);

  const idsPreenchidos = [primeiroId, segundoId, terceiroId].filter((id) => id.length > 0);
  const ordemValida = !terceiroId || Boolean(segundoId);
  const canSave =
    participantes.length >= 1 &&
    Boolean(primeiroId) &&
    ordemValida &&
    new Set(idsPreenchidos).size === idsPreenchidos.length;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/resumo-do-jogo/finalistas', {
        method: 'POST',
        headers: adminJsonHeaders(),
        body: JSON.stringify({
          primeiroId,
          segundoId,
          terceiroId,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || `Erro ${res.status}`);
      }
      setFeedback({ kind: 'ok', text: 'Finalistas salvos. O preview reflete tools/bbb-hosting/public/statusbbb.json.' });
      onSaved?.();
    } catch (e) {
      setFeedback({
        kind: 'err',
        text: e instanceof Error ? e.message : 'Falha ao salvar',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (
      !confirm(
        'Remover os finalistas? O bloco será apagado e a marcação "Nº finalista" será retirada do status de cada um (demais tags como vip/xepa permanecem).'
      )
    ) {
      return;
    }
    setRemoving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/resumo-do-jogo/finalistas', {
        method: 'DELETE',
        headers: adminJsonHeaders(),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || `Erro ${res.status}`);
      }
      setFeedback({
        kind: 'ok',
        text: 'Finalistas removidos; status dos envolvidos limpos no JSON. Use um novo scrape se quiser repor status vindos do Gshow.',
      });
      setPrimeiroId('');
      setSegundoId('');
      setTerceiroId('');
      onSaved?.();
    } catch (e) {
      setFeedback({
        kind: 'err',
        text: e instanceof Error ? e.message : 'Falha ao remover',
      });
    } finally {
      setRemoving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resumo-finalistas-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 id="resumo-finalistas-title" className="text-lg font-semibold text-gray-900">
            Definir finalistas
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fechar"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            Os participantes vêm do JSON em{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">tools/bbb-hosting/public/statusbbb.json</code> (via
            preview). O <strong>1º finalista</strong> é obrigatório; 2º e 3º são opcionais (preencha em ordem, sem
            repetir). Cada um recebe <code className="text-xs bg-gray-100 px-1 rounded">1º finalista</code> … em
            título e status.
          </p>
          <p className="text-sm text-gray-600">
            Ao remover, o bloco editorial some e a marcação <code className="text-xs bg-gray-100 px-1 rounded">Nº finalista</code>{' '}
            é retirada do <code className="text-xs bg-gray-100 px-1 rounded">status</code> (vip, xepa etc. permanecem).
          </p>

          {loadingList && <p className="text-sm text-blue-600">Carregando participantes…</p>}
          {listError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{listError}</div>
          )}

          {!loadingList && !listError && participantes.length >= 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">1º finalista</label>
                <select
                  value={primeiroId}
                  onChange={(e) => setPrimeiroId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
                >
                  <option value="">Selecione…</option>
                  {optionsFor('p').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">2º finalista (opcional)</label>
                <select
                  value={segundoId}
                  onChange={(e) => setSegundoId(e.target.value)}
                  disabled={!primeiroId}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Selecione…</option>
                  {optionsFor('s').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">3º finalista (opcional)</label>
                <select
                  value={terceiroId}
                  onChange={(e) => setTerceiroId(e.target.value)}
                  disabled={!segundoId}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Selecione…</option>
                  {optionsFor('t').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {feedback && (
            <div
              className={`text-sm rounded-md p-3 ${
                feedback.kind === 'ok'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-end px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing || saving || loadingList}
            className="order-2 sm:order-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {removing ? 'Removendo…' : 'Remover finalistas'}
          </button>
          <div className="flex gap-2 order-1 sm:order-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave || saving || removing}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
