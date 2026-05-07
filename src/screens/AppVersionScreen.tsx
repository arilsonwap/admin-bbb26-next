'use client';

import React, { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import {
  ArrowPathIcon,
  ArrowUpRightIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  DocumentTextIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline';
import { adminJsonHeaders, getAdminApiKey } from '@/lib/adminClientHeaders';
import type { AppVersionDocument } from '@/models/appVersionTypes';

type LoadState = 'idle' | 'loading' | 'ok' | 'error';

const SEMVER_DIGITS_RE = /^\d+\.\d+\.\d+$/;

type FormTouched = {
  latestVersion: boolean;
  minSupportedVersion: boolean;
  storeUrlAndroid: boolean;
};

type FormState = {
  baseline: AppVersionDocument | null;
  current: AppVersionDocument;
  touched: FormTouched;
};

type FormAction =
  | { type: 'apply'; payload: AppVersionDocument }
  | { type: 'setEnabled'; value: boolean }
  | { type: 'setLatestVersion'; value: string }
  | { type: 'setMinSupportedVersion'; value: string }
  | { type: 'setForceUpdate'; value: boolean }
  | { type: 'setMessage'; value: string }
  | { type: 'setRequiredMessage'; value: string }
  | { type: 'setStoreUrlAndroid'; value: string }
  | { type: 'setStoreUrlIos'; value: string }
  | { type: 'setShowOncePerSession'; value: boolean }
  | { type: 'touchLatestVersion' }
  | { type: 'touchMinSupportedVersion' }
  | { type: 'touchStoreUrlAndroid' };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'apply': {
      return {
        baseline: action.payload,
        current: action.payload,
        touched: {
          latestVersion: false,
          minSupportedVersion: false,
          storeUrlAndroid: false,
        },
      };
    }
    case 'setEnabled':
      return { ...state, current: { ...state.current, enabled: action.value } };
    case 'setLatestVersion':
      return { ...state, current: { ...state.current, latestVersion: action.value } };
    case 'setMinSupportedVersion':
      return { ...state, current: { ...state.current, minSupportedVersion: action.value } };
    case 'setForceUpdate':
      return { ...state, current: { ...state.current, forceUpdate: action.value } };
    case 'setMessage':
      return { ...state, current: { ...state.current, message: action.value } };
    case 'setRequiredMessage':
      return { ...state, current: { ...state.current, requiredMessage: action.value } };
    case 'setStoreUrlAndroid':
      return { ...state, current: { ...state.current, storeUrlAndroid: action.value } };
    case 'setStoreUrlIos':
      return { ...state, current: { ...state.current, storeUrlIos: action.value } };
    case 'setShowOncePerSession':
      return { ...state, current: { ...state.current, showOncePerSession: action.value } };
    case 'touchLatestVersion':
      return { ...state, touched: { ...state.touched, latestVersion: true } };
    case 'touchMinSupportedVersion':
      return { ...state, touched: { ...state.touched, minSupportedVersion: true } };
    case 'touchStoreUrlAndroid':
      return { ...state, touched: { ...state.touched, storeUrlAndroid: true } };
    default:
      return state;
  }
}

const initialFormState: FormState = {
  baseline: null,
  current: {
    enabled: false,
    latestVersion: '',
    minSupportedVersion: '',
    forceUpdate: false,
    message: '',
    requiredMessage: '',
    storeUrlAndroid: '',
    storeUrlIos: '',
    showOncePerSession: true,
    updatedAt: '',
  },
  touched: {
    latestVersion: false,
    minSupportedVersion: false,
    storeUrlAndroid: false,
  },
};

export function AppVersionScreen() {
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, dispatchForm] = useReducer(formReducer, initialFormState);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMeta, setSaveMeta] = useState<{ bytes: number; version: string } | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'error'>('idle');

  const actionSeqRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const saveAbortRef = useRef<AbortController | null>(null);
  const previewCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    return () => {
      loadAbortRef.current?.abort();
      saveAbortRef.current?.abort();
    };
  }, []);

  const applyDocument = useCallback((d: AppVersionDocument) => {
    dispatchForm({ type: 'apply', payload: d });
  }, []);

  const isDirty = useMemo(() => {
    const base = form.baseline;
    if (!base) return false;
    const norm = (s: string) => s.trim();
    return (
      form.current.enabled !== base.enabled ||
      norm(form.current.latestVersion) !== norm(base.latestVersion) ||
      norm(form.current.minSupportedVersion) !== norm(base.minSupportedVersion) ||
      form.current.forceUpdate !== base.forceUpdate ||
      form.current.message !== base.message ||
      form.current.requiredMessage !== base.requiredMessage ||
      norm(form.current.storeUrlAndroid) !== norm(base.storeUrlAndroid) ||
      norm(form.current.storeUrlIos) !== norm(base.storeUrlIos) ||
      form.current.showOncePerSession !== base.showOncePerSession
    );
  }, [form.baseline, form.current]);

  const latestVersionError = useMemo(() => {
    const v = form.current.latestVersion.trim();
    if (!v) return 'Obrigatório';
    if (!SEMVER_DIGITS_RE.test(v)) return 'Formato inválido. Use X.Y.Z (apenas dígitos).';
    return null;
  }, [form.current.latestVersion]);

  const minSupportedVersionError = useMemo(() => {
    const v = form.current.minSupportedVersion.trim();
    if (!v) return 'Obrigatório';
    if (!SEMVER_DIGITS_RE.test(v)) return 'Formato inválido. Use X.Y.Z (apenas dígitos).';
    return null;
  }, [form.current.minSupportedVersion]);

  const storeUrlAndroidError = useMemo(() => {
    const v = form.current.storeUrlAndroid.trim();
    if (!v) return 'Obrigatório';
    return null;
  }, [form.current.storeUrlAndroid]);

  const canSave = useMemo(() => {
    return !latestVersionError && !minSupportedVersionError && !storeUrlAndroidError;
  }, [latestVersionError, minSupportedVersionError, storeUrlAndroidError]);

  const showLatestVersionError = form.touched.latestVersion || form.current.latestVersion.trim().length > 0;
  const showMinSupportedVersionError =
    form.touched.minSupportedVersion || form.current.minSupportedVersion.trim().length > 0;
  const showStoreUrlAndroidError = form.touched.storeUrlAndroid || form.current.storeUrlAndroid.trim().length > 0;

  const loadConfig = useCallback(async () => {
    actionSeqRef.current += 1;
    const seq = actionSeqRef.current;

    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setLoadState('loading');
    setLoadError(null);
    try {
      const res = await fetch('/api/admin/app-version', {
        headers: { 'x-api-key': getAdminApiKey() },
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: AppVersionDocument;
        details?: unknown;
      };
      if (!res.ok) {
        throw new Error(body.error || `Erro ${res.status}`);
      }
      if (!body.data) {
        throw new Error('Resposta sem dados');
      }
      if (seq !== actionSeqRef.current) return;
      applyDocument(body.data);
      setLoadState('ok');
      setSaveState('idle');
      setSaveError(null);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (seq !== actionSeqRef.current) return;
      setLoadState('error');
      setLoadError(e instanceof Error ? e.message : 'Falha ao carregar');
    }
  }, [applyDocument]);

  React.useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  React.useEffect(() => {
    if (saveState !== 'ok') return;
    const t = setTimeout(() => {
      setSaveState('idle');
    }, 4000);
    return () => clearTimeout(t);
  }, [saveState]);

  const previewJson = useMemo((): AppVersionDocument => {
    return {
      enabled: form.current.enabled,
      latestVersion: form.current.latestVersion.trim() || '0.0.0',
      minSupportedVersion: form.current.minSupportedVersion.trim() || '0.0.0',
      forceUpdate: form.current.forceUpdate,
      message: form.current.message,
      requiredMessage: form.current.requiredMessage,
      storeUrlAndroid: form.current.storeUrlAndroid,
      storeUrlIos: form.current.storeUrlIos,
      showOncePerSession: form.current.showOncePerSession,
      updatedAt: form.current.updatedAt || form.baseline?.updatedAt || '',
    };
  }, [form.baseline?.updatedAt, form.current]);

  React.useLayoutEffect(() => {
    if (!previewOpen) return;
    setCopyState('idle');

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPreviewOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    previewCloseButtonRef.current?.focus();

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewOpen]);

  const previewJsonText = useMemo(() => JSON.stringify(previewJson, null, 2), [previewJson]);

  const handleSave = async () => {
    if (!canSave) {
      dispatchForm({ type: 'touchLatestVersion' });
      dispatchForm({ type: 'touchMinSupportedVersion' });
      dispatchForm({ type: 'touchStoreUrlAndroid' });
      return;
    }

    actionSeqRef.current += 1;
    const seq = actionSeqRef.current;

    saveAbortRef.current?.abort();
    const controller = new AbortController();
    saveAbortRef.current = controller;

    setSaveState('saving');
    setSaveError(null);
    setSaveMeta(null);
    try {
      const res = await fetch('/api/admin/app-version', {
        method: 'PUT',
        headers: adminJsonHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          enabled: form.current.enabled,
          latestVersion: form.current.latestVersion.trim(),
          minSupportedVersion: form.current.minSupportedVersion.trim(),
          forceUpdate: form.current.forceUpdate,
          message: form.current.message,
          requiredMessage: form.current.requiredMessage,
          storeUrlAndroid: form.current.storeUrlAndroid.trim(),
          storeUrlIos: form.current.storeUrlIos.trim(),
          showOncePerSession: form.current.showOncePerSession,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: unknown;
        data?: AppVersionDocument;
        bytes?: number;
        version?: string;
      };
      if (!res.ok) {
        const detail =
          body.details && typeof body.details === 'object'
            ? JSON.stringify(body.details)
            : '';
        throw new Error([body.error, detail].filter(Boolean).join(' — '));
      }
      if (seq !== actionSeqRef.current) return;
      if (body.data) {
        applyDocument(body.data);
      }
      setSaveMeta(
        typeof body.bytes === 'number' && typeof body.version === 'string'
          ? { bytes: body.bytes, version: body.version }
          : null
      );
      setSaveState('ok');
    } catch (e) {
      if (controller.signal.aborted) return;
      if (seq !== actionSeqRef.current) return;
      setSaveState('error');
      setSaveError(e instanceof Error ? e.message : 'Falha ao salvar');
    }
  };

  const publicMain = 'tools/bbb-hosting/public/app-version.json';
  const publicLatest = 'tools/bbb-hosting/public/app-version-latest.json';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <DevicePhoneMobileIcon className="h-8 w-8 text-indigo-600" />
              <h1 className="text-xl font-semibold text-gray-900">Versão do app (OTA)</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-3xl mx-auto space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 space-y-2">
          <p>
            Arquivos publicados no deploy do Hosting (mesmo fluxo de{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">statusbbb.json</code>):
          </p>
          <ul className="list-disc pl-5 space-y-1 font-mono text-xs text-gray-800">
            <li>{publicMain}</li>
            <li>{publicLatest}</li>
          </ul>
          <p className="pt-1">
            Preview público interno:{' '}
            <a
              href="/api/hosting-public/app-version.json"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
            >
              <ArrowUpRightIcon className="h-4 w-4 mr-0.5" />
              /api/hosting-public/app-version.json
            </a>
          </p>
        </div>

        {loadState === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <ArrowPathIcon className="h-5 w-5 animate-spin text-indigo-600" />
            Carregando configuração…
          </div>
        )}
        {loadError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{loadError}</div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
          <div className="p-4 space-y-4">
            <div
              className={[
                'rounded-xl border p-4 transition shadow-sm',
                form.current.enabled
                  ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-white ring-1 ring-indigo-100'
                  : 'border-gray-200 bg-gradient-to-br from-gray-50 via-white to-white ring-1 ring-gray-100',
                loadState === 'loading' || saveState === 'saving' ? 'opacity-60' : '',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">Controle de versão (OTA)</p>
                    <span
                      className={[
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide',
                        form.current.enabled
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                          : 'bg-gray-200 text-gray-800',
                      ].join(' ')}
                    >
                      {form.current.enabled ? 'ATIVO' : 'DESLIGADO'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    Quando desligado, o app pode ignorar este manifesto (depende do cliente respeitar <code className="font-mono">enabled</code>).
                  </p>
                </div>

                <label
                  htmlFor="app-version-enabled"
                  className={[
                    'relative inline-flex h-9 w-16 shrink-0 cursor-pointer items-center rounded-full p-1 transition',
                    form.current.enabled ? 'bg-indigo-600 shadow-md shadow-indigo-600/25' : 'bg-gray-300',
                    loadState === 'loading' || saveState === 'saving' ? 'pointer-events-none' : '',
                  ].join(' ')}
                  aria-label="Alternar controle de versão (OTA)"
                >
                  <input
                    id="app-version-enabled"
                    type="checkbox"
                    className="peer sr-only"
                    checked={form.current.enabled}
                    disabled={loadState === 'loading' || saveState === 'saving'}
                    onChange={(e) => dispatchForm({ type: 'setEnabled', value: e.target.checked })}
                  />
                  <span
                    className={[
                      'h-7 w-7 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform',
                      'translate-x-0 peer-checked:translate-x-7',
                    ].join(' ')}
                  />
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Última versão disponível <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.current.latestVersion}
                onChange={(e) => dispatchForm({ type: 'setLatestVersion', value: e.target.value })}
                onBlur={() => dispatchForm({ type: 'touchLatestVersion' })}
                placeholder="1.4.0"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              {showLatestVersionError && latestVersionError && (
                <p className="mt-1 text-xs text-red-600">{latestVersionError}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Versão mais recente disponível na loja. Formato <code className="font-mono">X.Y.Z</code> (apenas dígitos).
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Versão mínima suportada <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.current.minSupportedVersion}
                onChange={(e) => dispatchForm({ type: 'setMinSupportedVersion', value: e.target.value })}
                onBlur={() => dispatchForm({ type: 'touchMinSupportedVersion' })}
                placeholder="1.3.0"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              {showMinSupportedVersionError && minSupportedVersionError && (
                <p className="mt-1 text-xs text-red-600">{minSupportedVersionError}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Abaixo desta versão, o app deve bloquear ou obrigar atualização. Formato <code className="font-mono">X.Y.Z</code>.
              </p>
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.current.forceUpdate}
                  onChange={(e) => dispatchForm({ type: 'setForceUpdate', value: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-800">Forçar atualização</span>
              </label>
              <p className="text-xs text-gray-500">
                Se ativo, o app deve tratar a atualização como obrigatória (ex.: modal sem “pular”).
              </p>
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.current.showOncePerSession}
                  onChange={(e) => dispatchForm({ type: 'setShowOncePerSession', value: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-800">Mostrar aviso só uma vez por sessão</span>
              </label>
              <p className="text-xs text-gray-500">
                Se ativo, o app pode evitar repetir o aviso a cada tela/refresh na mesma sessão.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem (opcional)</label>
              <textarea
                value={form.current.message}
                onChange={(e) => dispatchForm({ type: 'setMessage', value: e.target.value })}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Texto para quando existe atualização disponível, mas não necessariamente obrigatória.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem se atualização obrigatória</label>
              <textarea
                value={form.current.requiredMessage}
                onChange={(e) => dispatchForm({ type: 'setRequiredMessage', value: e.target.value })}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Texto exibido quando <code className="font-mono">forceUpdate</code> estiver ativo ou quando a versão estiver abaixo da mínima.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Android (Play / market) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.current.storeUrlAndroid}
                onChange={(e) => dispatchForm({ type: 'setStoreUrlAndroid', value: e.target.value })}
                onBlur={() => dispatchForm({ type: 'touchStoreUrlAndroid' })}
                placeholder="market://details?id=..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
              />
              {showStoreUrlAndroidError && storeUrlAndroidError && (
                <p className="mt-1 text-xs text-red-600">{storeUrlAndroidError}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Link que o app abre ao tocar em “Atualizar”. Aceita <code className="font-mono">market://</code> ou URL HTTPS da Play Store.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL iOS (opcional)</label>
              <input
                type="text"
                value={form.current.storeUrlIos}
                onChange={(e) => dispatchForm({ type: 'setStoreUrlIos', value: e.target.value })}
                placeholder="itms-apps:// ou https://apps.apple.com/..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">
                Se vazio, o app pode manter comportamento atual (Android). Quando preenchido, usar para redirecionar ao App Store.
              </p>
            </div>
          </div>

          <div className="p-4 flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
            <button
              type="button"
              onClick={() => {
                if (
                  isDirty &&
                  !window.confirm('Existem alterações não salvas. Recarregar vai descartá-las. Deseja continuar?')
                ) {
                  return;
                }
                void loadConfig();
              }}
              disabled={loadState === 'loading'}
              className="inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Recarregar do disco
            </button>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Preview do JSON
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saveState === 'saving' || loadState === 'loading' || !canSave}
                className="inline-flex justify-center items-center px-6 py-3 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-orange-600 via-orange-600 to-rose-600 shadow-lg shadow-orange-600/25 ring-1 ring-white/25 hover:from-orange-500 hover:via-orange-600 hover:to-rose-500 hover:shadow-xl hover:shadow-orange-600/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 disabled:cursor-not-allowed disabled:from-orange-600 disabled:via-orange-600 disabled:to-rose-600"
              >
                {saveState === 'saving' ? 'Salvando…' : 'Salvar configuração'}
              </button>
            </div>
          </div>
        </div>

        {!loadError && saveState === 'ok' && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 flex items-start gap-2">
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="font-medium">Salvo com escrita atômica.</p>
              {saveMeta && (
                <p className="text-xs mt-1 text-green-800 font-mono">
                  {saveMeta.bytes} bytes · {saveMeta.version}
                </p>
              )}
            </div>
          </div>
        )}
        {!loadError && saveState === 'error' && saveError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{saveError}</div>
        )}
      </main>

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPreviewOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-version-preview-title"
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-gray-200"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 id="app-version-preview-title" className="text-lg font-semibold text-gray-900">
                Preview (JSON que seria publicado)
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(previewJsonText);
                      setCopyState('ok');
                      window.setTimeout(() => setCopyState('idle'), 1500);
                    } catch {
                      setCopyState('error');
                      window.setTimeout(() => setCopyState('idle'), 2000);
                    }
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <ClipboardDocumentIcon className="h-4 w-4 mr-1.5" />
                  Copiar
                </button>
                <button
                  ref={previewCloseButtonRef}
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Fechar
                </button>
              </div>
            </div>
            {copyState === 'ok' && <div className="px-4 py-2 text-xs text-green-800 bg-green-50 border-b border-green-100">Copiado.</div>}
            {copyState === 'error' && (
              <div className="px-4 py-2 text-xs text-red-800 bg-red-50 border-b border-red-100">Não foi possível copiar.</div>
            )}
            <pre tabIndex={0} className="p-4 overflow-auto text-xs font-mono text-gray-800 bg-gray-50 flex-1 outline-none">
              {previewJsonText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
