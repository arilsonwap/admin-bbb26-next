'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import {
  EDITORIAL_PRESET_LABELS,
  EDITORIAL_PRESET_TO_TYPE,
  EDITORIAL_PUSH_FIELD_PRESETS,
  type EditorialPushPreset,
  type AppNotificationType,
  type PushNotificationLogRow,
} from '../models/pushTypes';
import { PUSH_TOPIC_LABELS, PUSH_TOPIC_SLUGS } from '../constants/pushTopics';
import type { AdminSendPushPayload } from '../models/pushSchemas';
import {
  listPushNotificationLogs,
  sendAdminPush,
  PushAdminApiError,
} from '../services/pushAdminClient';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

function formatDateBR(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}

function buildPayloadFromFormState(input: {
  mode: 'test' | 'live';
  resolvedType: AppNotificationType;
  title: string;
  body: string;
  entityId: string;
  targetScreen: string;
  url: string;
  imageUrl: string;
  audienceMode: (typeof AUDIENCE_MODES)[number]['id'];
  testToken: string;
  topicName: string;
  segmentPlatform: 'all' | 'ios' | 'android' | 'web';
  segmentTopics: string[];
  preview?: boolean;
}): AdminSendPushPayload {
  const data: AdminSendPushPayload['data'] = {
    type: input.resolvedType,
    ...(input.entityId.trim() ? { entityId: input.entityId.trim() } : {}),
    ...(input.targetScreen.trim() ? { targetScreen: input.targetScreen.trim() } : {}),
    ...(input.url.trim() ? { url: input.url.trim() } : {}),
    ...(input.imageUrl.trim() ? { imageUrl: input.imageUrl.trim() } : {}),
  };

  let audience: AdminSendPushPayload['audience'];
  const tokenForPreview = input.testToken.trim() || '<token>';
  if (input.mode === 'test') {
    audience = { type: 'token', token: input.preview ? tokenForPreview : input.testToken.trim() };
  } else if (input.audienceMode === 'token') {
    audience = { type: 'token', token: input.preview ? tokenForPreview : input.testToken.trim() };
  } else if (input.audienceMode === 'topic') {
    audience = { type: 'topic', topic: (input.topicName.trim() || 'news') };
  } else {
    audience = {
      type: 'segment',
      ...(input.segmentPlatform !== 'all' ? { platform: input.segmentPlatform } : {}),
      ...(input.segmentTopics.length ? { topics: input.segmentTopics } : {}),
    };
  }

  return {
    mode: input.mode,
    audience,
    notification: { title: input.title.trim(), body: input.body.trim() },
    data,
  };
}

const AUDIENCE_MODES = [
  { id: 'token', label: 'Token FCM (teste direto)' },
  { id: 'topic', label: 'Tópico FCM' },
  { id: 'segment', label: 'Segmento (banco)' },
] as const;

const DEFAULT_PRESET: EditorialPushPreset = 'paredao_open';
const initialFields = EDITORIAL_PUSH_FIELD_PRESETS[DEFAULT_PRESET];

function formStateFromPreset(next: EditorialPushPreset) {
  const p = EDITORIAL_PUSH_FIELD_PRESETS[next];
  return {
    title: p.title,
    body: p.body,
    entityId: p.entityId ?? '',
    targetScreen: p.targetScreen ?? '',
    url: p.url ?? '',
    imageUrl: p.imageUrl ?? '',
    adminLabel: p.auditLabel ?? '',
  };
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

/** Vários presets mapeiam para o mesmo `type`; escolhe o primeiro na ordem do objeto. */
function presetFromLoggedType(loggedType: string): EditorialPushPreset {
  const presets = Object.keys(EDITORIAL_PRESET_TO_TYPE) as EditorialPushPreset[];
  const hit = presets.find((k) => EDITORIAL_PRESET_TO_TYPE[k] === loggedType);
  return hit ?? 'news_new';
}

export function PushNotificationsScreen() {
  const [preset, setPreset] = useState<EditorialPushPreset>(DEFAULT_PRESET);
  const [form, setForm] = useState(() => ({
    title: initialFields.title,
    body: initialFields.body,
    entityId: initialFields.entityId ?? '',
    targetScreen: initialFields.targetScreen ?? '',
    url: initialFields.url ?? '',
    imageUrl: initialFields.imageUrl ?? '',
    adminLabel: initialFields.auditLabel ?? '',
  }));
  const [audienceMode, setAudienceMode] = useState<(typeof AUDIENCE_MODES)[number]['id']>('topic');
  const [testToken, setTestToken] = useState('');
  const [topicName, setTopicName] = useState('news');
  const [segmentPlatform, setSegmentPlatform] = useState<'all' | 'ios' | 'android' | 'web'>('all');
  const [segmentTopics, setSegmentTopics] = useState<string[]>(['news']);
  const [submitting, setSubmitting] = useState<'idle' | 'test' | 'live'>('idle');
  const [lastResponse, setLastResponse] = useState<unknown>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [repeatFeedback, setRepeatFeedback] = useState<string | null>(null);
  const [highlightUntil, setHighlightUntil] = useState<number>(0);

  const titleLen = useMemo(() => form.title.trim().length, [form.title]);
  const bodyLen = useMemo(() => form.body.trim().length, [form.body]);
  // Limites variam por SO/device; estes são guias práticos para evitar corte visual.
  const TITLE_RECOMMENDED_MAX = 50;
  const BODY_RECOMMENDED_MAX = 120;
  const titleTooLong = titleLen > TITLE_RECOMMENDED_MAX;
  const bodyTooLong = bodyLen > BODY_RECOMMENDED_MAX;

  const resolvedType: AppNotificationType = EDITORIAL_PRESET_TO_TYPE[preset];

  const previewPayload = buildPayloadFromFormState({
    mode: 'live',
    resolvedType,
    title: form.title,
    body: form.body,
    entityId: form.entityId,
    targetScreen: form.targetScreen,
    url: form.url,
    imageUrl: form.imageUrl,
    audienceMode,
    testToken,
    topicName,
    segmentPlatform,
    segmentTopics,
    preview: true,
  });

  const logsQuery = useQuery({
    queryKey: ['push-notification-logs'],
    queryFn: () => listPushNotificationLogs(30),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  function buildPayload(mode: 'test' | 'live'): AdminSendPushPayload {
    return buildPayloadFromFormState({
      mode,
      resolvedType,
      title: form.title,
      body: form.body,
      entityId: form.entityId,
      targetScreen: form.targetScreen,
      url: form.url,
      imageUrl: form.imageUrl,
      audienceMode,
      testToken,
      topicName,
      segmentPlatform,
      segmentTopics,
    });
  }

  async function handleSend(mode: 'test' | 'live') {
    setLastError(null);
    setLastResponse(null);

    if (mode === 'test' && !testToken.trim()) {
      setLastError('Informe o token FCM para envio de teste.');
      return;
    }
    if (mode === 'live' && audienceMode === 'token' && !testToken.trim()) {
      setLastError('Informe o token FCM para audiência “Token”.');
      return;
    }
    if (mode === 'live' && audienceMode === 'topic' && !topicName.trim()) {
      setLastError('Informe o nome do tópico FCM.');
      return;
    }
    if (mode === 'live' && audienceMode === 'segment' && segmentTopics.length === 0) {
      setLastError('Selecione ao menos um tópico de segmento.');
      return;
    }
    if (!form.title.trim() || !form.body.trim()) {
      setLastError('Título e corpo são obrigatórios.');
      return;
    }

    setSubmitting(mode === 'test' ? 'test' : 'live');
    try {
      const payload = buildPayload(mode);
      const res = await sendAdminPush(payload, {
        adminLabel: form.adminLabel.trim() || undefined,
      });
      setLastResponse(res);
      await logsQuery.refetch();
    } catch (e) {
      const msg =
        e instanceof PushAdminApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Erro desconhecido';
      setLastError(msg);
    } finally {
      setSubmitting('idle');
    }
  }

  function toggleSegmentTopic(slug: string) {
    setSegmentTopics((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function fillFormFromLog(row: PushNotificationLogRow) {
    setLastError(null);
    setLastResponse(null);

    const pd = row.payload_data && typeof row.payload_data === 'object' ? row.payload_data : {};
    const notif =
      'notification' in pd && pd.notification && typeof pd.notification === 'object'
        ? (pd.notification as { title?: unknown; body?: unknown })
        : undefined;
    const pdata =
      'data' in pd && pd.data && typeof pd.data === 'object'
        ? (pd.data as Record<string, unknown>)
        : {};

    setPreset(presetFromLoggedType(row.type));
    setForm((prev) => ({
      ...prev,
      title: str(notif?.title ?? row.title ?? pdata.title),
      body: str(notif?.body ?? row.body ?? pdata.body),
      entityId: str(pdata.entityId),
      targetScreen: str(pdata.targetScreen),
      url: str(pdata.url),
      imageUrl: str(pdata.imageUrl),
    }));

    const snap = row.audience_snapshot && typeof row.audience_snapshot === 'object' ? row.audience_snapshot : {};
    const audienceRaw = 'audience' in snap ? snap.audience : undefined;
    const audience =
      audienceRaw && typeof audienceRaw === 'object' ? (audienceRaw as Record<string, unknown>) : {};

    setAudienceMode(row.audience_type);

    if (row.audience_type === 'token') {
      setTestToken(str(audience.token));
    } else if (row.audience_type === 'topic') {
      const single = str(audience.topic);
      const list = audience.topics;
      const firstTopic =
        single.trim() ||
        (Array.isArray(list) && list.length > 0 ? str(list[0]) : '') ||
        'news';
      setTopicName(firstTopic);
    } else {
      const plat = audience.platform;
      setSegmentPlatform(
        plat === 'ios' || plat === 'android' || plat === 'web' ? plat : 'all'
      );
      const tops = audience.topics;
      if (Array.isArray(tops) && tops.length > 0) {
        setSegmentTopics(tops.map((t) => str(t)).filter(Boolean));
      } else {
        setSegmentTopics(['news']);
      }
    }

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const until = Date.now() + 2200;
    setHighlightUntil(until);
    setRepeatFeedback('Formulário preenchido a partir do histórico.');
    window.setTimeout(() => {
      setRepeatFeedback((prev) => (prev === 'Formulário preenchido a partir do histórico.' ? null : prev));
    }, 2200);
    window.setTimeout(() => setHighlightUntil(0), 2200);
  }

  function handlePresetChange(next: EditorialPushPreset) {
    setPreset(next);
    const m = formStateFromPreset(next);
    setForm((prev) => ({
      ...prev,
      title: m.title,
      body: m.body,
      entityId: m.entityId,
      targetScreen: m.targetScreen,
      url: m.url,
      imageUrl: m.imageUrl,
      adminLabel: m.adminLabel,
    }));
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Push editorial</h1>
        <p className="text-sm text-gray-600 mt-1">
          Envio via FCM no servidor; credenciais Firebase não ficam no navegador.
        </p>
      </div>

      {repeatFeedback ? (
        <Card title="Ação" variant="secondary">
          <p className="text-sm text-gray-800">{repeatFeedback}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Composição"
          className={`space-y-4 ${
            Date.now() < highlightUntil ? 'ring-2 ring-indigo-200 border-indigo-200' : ''
          }`}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo editorial</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value as EditorialPushPreset)}
            >
              {(Object.keys(EDITORIAL_PRESET_LABELS) as EditorialPushPreset[]).map((k) => (
                <option key={k} value={k}>
                  {EDITORIAL_PRESET_LABELS[k]}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Técnico: <code className="text-xs">{resolvedType}</code>
            </p>
          </div>

          <div>
            <div className="flex items-end justify-between gap-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <span
                className={`text-xs mb-1 ${
                  titleLen > TITLE_RECOMMENDED_MAX ? 'text-amber-700 font-semibold' : 'text-gray-500'
                }`}
                title={`Guia: até ~${TITLE_RECOMMENDED_MAX} caracteres para reduzir risco de corte`}
              >
                {titleLen}/{TITLE_RECOMMENDED_MAX}
              </span>
            </div>
            <input
              className={`w-full rounded-md border px-3 py-2 text-sm ${
                titleTooLong
                  ? 'border-red-400 ring-2 ring-red-100 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-300'
              } ${Date.now() < highlightUntil ? 'ring-2 ring-indigo-100 border-indigo-200' : ''}`}
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div>
            <div className="flex items-end justify-between gap-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Corpo</label>
              <span
                className={`text-xs mb-1 ${
                  bodyLen > BODY_RECOMMENDED_MAX ? 'text-amber-700 font-semibold' : 'text-gray-500'
                }`}
                title={`Guia: até ~${BODY_RECOMMENDED_MAX} caracteres para reduzir risco de corte`}
              >
                {bodyLen}/{BODY_RECOMMENDED_MAX}
              </span>
            </div>
            <textarea
              className={`w-full rounded-md border px-3 py-2 text-sm min-h-[88px] ${
                bodyTooLong
                  ? 'border-red-400 ring-2 ring-red-100 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-300'
              } ${Date.now() < highlightUntil ? 'ring-2 ring-indigo-100 border-indigo-200' : ''}`}
              value={form.body}
              onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">entityId</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.entityId}
                onChange={(e) => setForm((prev) => ({ ...prev, entityId: e.target.value }))}
                placeholder="opcional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">targetScreen</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.targetScreen}
                onChange={(e) => setForm((prev) => ({ ...prev, targetScreen: e.target.value }))}
                placeholder="opcional"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">url</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.url}
                onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="opcional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">imageUrl</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.imageUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="opcional"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rótulo de auditoria (opcional)
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.adminLabel}
              onChange={(e) => setForm((prev) => ({ ...prev, adminLabel: e.target.value }))}
              placeholder="ex.: redação, nome interno"
            />
          </div>
        </Card>

        <Card title="Audiência e envio" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modo produção: audiência</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={audienceMode}
              onChange={(e) => setAudienceMode(e.target.value as typeof audienceMode)}
            >
              {AUDIENCE_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {audienceMode === 'token' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Token FCM</label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono min-h-[72px]"
                value={testToken}
                onChange={(e) => setTestToken(e.target.value)}
                placeholder="Cole o token do dispositivo (teste ou produção com audiência Token)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Obrigatório para <strong>Enviar teste</strong> e para produção quando a audiência for <strong>Token</strong>.
              </p>
            </div>
          ) : (
            <details className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 select-none">
                Token FCM (apenas para teste)
              </summary>
              <div className="mt-2">
                <textarea
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono min-h-[72px] bg-white"
                  value={testToken}
                  onChange={(e) => setTestToken(e.target.value)}
                  placeholder="Cole o token do dispositivo (usado somente no botão “Enviar teste”)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Em audiência <strong>Tópico</strong> ou <strong>Segmento</strong>, este campo não é usado no envio de produção.
                </p>
              </div>
            </details>
          )}

          {audienceMode === 'topic' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tópico FCM</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                placeholder="ex.: news"
              />
            </div>
          ) : null}

          {audienceMode === 'segment' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plataforma</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={segmentPlatform}
                  onChange={(e) => setSegmentPlatform(e.target.value as typeof segmentPlatform)}
                >
                  <option value="all">Todas</option>
                  <option value="android">Android</option>
                  <option value="ios">iOS</option>
                  <option value="web">Web</option>
                </select>
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-2">
                  Tópicos (overlap)
                </span>
                <div className="flex flex-wrap gap-2">
                  {PUSH_TOPIC_SLUGS.map((slug) => {
                    const active = segmentTopics.includes(slug);
                    return (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => toggleSegmentTopic(slug)}
                        className={[
                          'px-2 py-1 rounded text-xs border',
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
                        ].join(' ')}
                      >
                        {PUSH_TOPIC_LABELS[slug]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Dispositivos com pelo menos um tópico selecionado (até 5000 no servidor).
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleSend('test')}
              disabled={submitting !== 'idle'}
              className="inline-flex items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {submitting === 'test' ? 'Enviando…' : 'Enviar teste'}
            </button>
            <button
              type="button"
              onClick={() => handleSend('live')}
              disabled={submitting !== 'idle'}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting === 'live' ? 'Enviando…' : 'Enviar produção'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Teste força <code>mode=test</code> e exige token. Produção usa a audiência escolhida.
          </p>
        </Card>
      </div>

      <Card title="Preview visual (simulação)" className="bg-gray-50">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="font-medium text-gray-700">Central BBB</span>
              <span>agora</span>
            </div>
            <div className="mt-2">
              <div className="text-sm font-semibold text-gray-900">
                {form.title.trim() || 'Título da notificação'}
              </div>
              <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                {form.body.trim() || 'Corpo da notificação'}
              </div>
            </div>

            {form.imageUrl.trim() ? (
              <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                {/* `<img>` intencional: URLs externas variam; evita configuração do Next/Image. */}
                <img
                  src={form.imageUrl.trim()}
                  alt="Imagem da notificação"
                  className="w-full h-auto max-h-72 object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="mt-3 text-xs text-gray-500">
                Preencha <code className="font-mono">imageUrl</code> para ver a imagem expandida.
              </div>
            )}

            <div className="mt-3 text-[11px] text-gray-500">
              Toque abre: <span className="font-mono">{form.url.trim() || '—'}</span>
            </div>
          </div>

          <div className="text-sm text-gray-700 space-y-2">
            <p>
              Este preview é uma <strong>simulação</strong>. O visual final pode variar por Android/iOS e pela
              implementação do app (Notifee/data-only vs notification).
            </p>
            <ul className="ml-4 list-disc space-y-1 text-sm text-gray-700">
              <li>
                Se <code className="font-mono">imageUrl</code> falhar (403/CORS), a imagem pode não aparecer.
              </li>
              <li>
                Para garantir clique, use <code className="font-mono">url</code> ou <code className="font-mono">targetScreen</code>.
              </li>
            </ul>
          </div>
        </div>
      </Card>

      <Card title="Preview técnico (payload)" className="bg-gray-50">
        <pre className="text-xs overflow-auto max-h-64 p-3 rounded bg-white border border-gray-200">
          {JSON.stringify(previewPayload, null, 2)}
        </pre>
      </Card>

      {lastError ? (
        <Card title="Erro" variant="error">
          <p className="text-sm text-red-800">{lastError}</p>
        </Card>
      ) : null}

      {lastResponse ? (
        <Card title="Última resposta" variant="secondary">
          <pre className="text-xs overflow-auto max-h-64">
            {JSON.stringify(lastResponse, null, 2)}
          </pre>
        </Card>
      ) : null}

      <Card title="Histórico recente">
        {logsQuery.isLoading ? (
          <p className="text-sm text-gray-600">Carregando…</p>
        ) : logsQuery.isError ? (
          <div className="text-sm text-red-700 space-y-2">
            <p className="font-medium">Falha ao carregar histórico</p>
            <p className="text-red-600/90 whitespace-pre-wrap">
              {logsQuery.error instanceof PushAdminApiError
                ? logsQuery.error.message
                : 'Erro desconhecido. Verifique o console e a API.'}
            </p>
          </div>
        ) : (logsQuery.data?.logs ?? []).length === 0 ? (
          <p className="text-sm text-gray-600">Nenhum envio registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Quando</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Audiência</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">OK / falha</th>
                  <th className="py-2 pr-4">Título</th>
                  <th className="py-2 pr-4 w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(logsQuery.data?.logs ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDateBR(row.created_at)}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{row.type}</td>
                    <td className="py-2 pr-4">{row.audience_type}</td>
                    <td className="py-2 pr-4">{row.status}</td>
                    <td className="py-2 pr-4">
                      {row.success_count} ok · {row.failure_count} falha
                    </td>
                    <td className="py-2 pr-4 max-w-xs truncate">{row.title ?? '—'}</td>
                    <td className="py-2 pr-4 align-middle">
                      <button
                        type="button"
                        onClick={() => fillFormFromLog(row)}
                        title="Preenche o formulário com este envio (não dispara envio)"
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-800 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-100 hover:shadow active:scale-[0.98]"
                      >
                        <ArrowUturnLeftIcon className="h-3.5 w-3.5 shrink-0 text-indigo-600" aria-hidden />
                        Repetir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
