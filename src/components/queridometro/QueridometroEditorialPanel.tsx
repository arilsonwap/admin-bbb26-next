'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheckIcon,
  ArrowPathIcon,
  BookmarkSquareIcon,
} from '@heroicons/react/24/outline';
import type { QueridometroFeatureState } from '../../models/queridometroFeatureTypes';

const PREVIEW_BASE = '/api/hosting-public';

export const QueridometroEditorialPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mode, setMode] = useState<'active' | 'disabled'>('active');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [buttonLabel, setButtonLabel] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/queridometro-feature', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Falha ao carregar (${res.status})`);
      }
      const data = (await res.json()) as QueridometroFeatureState;
      setMode(data.mode);
      setTitle(data.title);
      setMessage(data.message);
      setButtonLabel(data.buttonLabel);
      setUpdatedAt(data.updatedAt);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/queridometro-feature', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          title: title.trim(),
          message: message.trim(),
          buttonLabel: buttonLabel.trim(),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg =
          typeof errBody?.error === 'string'
            ? errBody.error
            : `Falha ao salvar (${res.status})`;
        throw new Error(msg);
      }
      const data = (await res.json()) as QueridometroFeatureState;
      setMode(data.mode);
      setTitle(data.title);
      setMessage(data.message);
      setButtonLabel(data.buttonLabel);
      setUpdatedAt(data.updatedAt);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const blocked = mode === 'disabled';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="h-6 w-6 text-amber-600" />
          <h3 className="text-lg font-semibold text-gray-900">Bloqueio editorial no app</h3>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Recarregar
        </button>
      </div>

      <div className="px-6 py-5 space-y-5">
        <p className="text-sm text-gray-600">
          Estado canônico em{' '}
          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
            tools/bbb-hosting/public/queridometro-feature.json
          </code>
          . Não depende da extração e não é apagado ao gerar novo{' '}
          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">queridometro.json</code>.
        </p>

        {loadError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {loadError}
          </div>
        )}
        {saveError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {saveError}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-gray-900">Bloquear Queridômetro no app</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Quando ligado, o app deve tratar o modo como encerrado (conforme contrato do cliente).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={blocked}
            onClick={() => setMode(blocked ? 'active' : 'disabled')}
            disabled={loading}
            className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 ${
              blocked ? 'bg-red-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition ${
                blocked ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-1">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Título</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Mensagem</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              rows={4}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Texto do botão</span>
            <input
              type="text"
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              disabled={loading}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500"
            />
          </label>
        </div>

        {updatedAt && (
          <p className="text-xs text-gray-500">
            Última atualização (UTC): {updatedAt}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || saving}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar estado editorial'}
          </button>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-2">
            <BookmarkSquareIcon className="h-5 w-5 text-blue-600" />
            Preview (mesmo diretório do deploy)
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Abre o JSON servido a partir de <code className="bg-gray-100 px-1 rounded">tools/bbb-hosting/public/</code>, não da cópia estática em <code className="bg-gray-100 px-1 rounded">public/tools/...</code>.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <li>
              <a
                href={`${PREVIEW_BASE}/queridometro-feature.json`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                queridometro-feature.json
              </a>
            </li>
            <li>
              <a
                href={`${PREVIEW_BASE}/queridometro.json`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                queridometro.json
              </a>
            </li>
            <li>
              <a
                href={`${PREVIEW_BASE}/queridometro-latest.json`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                queridometro-latest.json
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
