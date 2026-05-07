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

export const ResumoResultadoFinalModal: React.FC<Props> = ({ open, onClose, onSaved }) => {
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
        resultadoFinal?: {
          ranking?: Array<{ id?: string; posicao?: number }>;
        };
      };
      const list = normalizeParticipantes(json.participantes);
      if (list.length < 3) {
        setListError('É necessário haver pelo menos 3 participantes no JSON para definir o pódio.');
        setParticipantes([]);
        return;
      }
      setParticipantes(list);

      const r = json.resultadoFinal?.ranking;
      if (Array.isArray(r) && r.length >= 3) {
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

  const canSave =
    participantes.length >= 3 &&
    primeiroId &&
    segundoId &&
    terceiroId &&
    new Set([primeiroId, segundoId, terceiroId]).size === 3;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/resumo-do-jogo/resultado-final', {
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
      setFeedback({ kind: 'ok', text: 'Resultado final salvo. O preview reflete tools/bbb-hosting/public/statusbbb.json.' });
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
        'Remover o resultado final? O bloco resultadoFinal será apagado e o campo status dos três participantes do pódio será limpo (string vazia), para evitar estado misto com o app.'
      )
    ) {
      return;
    }
    setRemoving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/resumo-do-jogo/resultado-final', {
        method: 'DELETE',
        headers: adminJsonHeaders(),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || `Erro ${res.status}`);
      }
      setFeedback({
        kind: 'ok',
        text: 'Resultado final removido; status do pódio limpos no JSON. Use um novo scrape se quiser repor status vindos do Gshow.',
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
        aria-labelledby="resumo-resultado-final-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 id="resumo-resultado-final-title" className="text-lg font-semibold text-gray-900">
            Definir resultado final
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
            Os participantes são carregados do JSON atual em{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">tools/bbb-hosting/public/statusbbb.json</code> (via
            preview). Três posições distintas são obrigatórias. O 1º lugar grava{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">1º lugar</code> em título e status (texto neutro).
          </p>
          <p className="text-sm text-gray-600">
            Ao remover o resultado final, o bloco editorial some e os <code className="text-xs bg-gray-100 px-1 rounded">status</code> dos três do pódio são esvaziados (não há restauração automática do valor anterior).
          </p>

          {loadingList && <p className="text-sm text-blue-600">Carregando participantes…</p>}
          {listError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{listError}</div>
          )}

          {!loadingList && !listError && participantes.length >= 3 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">1º lugar</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">2º lugar</label>
                <select
                  value={segundoId}
                  onChange={(e) => setSegundoId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">3º lugar</label>
                <select
                  value={terceiroId}
                  onChange={(e) => setTerceiroId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
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
            {removing ? 'Removendo…' : 'Remover resultado final'}
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
