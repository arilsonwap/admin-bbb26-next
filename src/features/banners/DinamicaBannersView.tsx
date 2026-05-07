'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import {
  ArrowPathIcon,
  CodeBracketIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { BannerAdmin, BannerCreatePayload, BannerUpdatePayload } from '../../models/bannersTypes';
import { BANNERS_SECTION_DINAMICA } from '../../constants/banners';
import { BannersApiError } from '../../services/bannersAdminClient';
import { useNotifications } from '../../hooks/useNotifications';
import { ToastContainer } from '../../components/ui/Toast';
import { Card } from '../../components/common/Card';
import { useBanners } from './hooks/useBanners';
import { BannerForm } from './components/BannerForm';
import { BannerList } from './components/BannerList';
import { DeleteBannerModal } from './components/DeleteBannerModal';
import { PublicJsonModal } from './components/PublicJsonModal';

const SECTION = BANNERS_SECTION_DINAMICA;
const SEARCH_DEBOUNCE_MS = 300;

type StatusFilter = 'all' | 'active' | 'inactive';

function friendlyError(err: unknown): string {
  if (err instanceof BannersApiError) {
    if (err.status === 409) {
      return 'Já existe um banner com a mesma URL de imagem nesta seção.';
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Erro desconhecido';
}

/**
 * Busca linear O(n) por banner; com centenas de itens pode pesar — candidato a
 * índice/memoização se a lista crescer muito.
 */
function bannerMatchesSearch(b: BannerAdmin, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    b.title,
    b.subtitle,
    b.imageUrl,
    b.targetUrl ?? '',
    b.notes,
    b.id,
    ...(b.tags ?? []),
  ]
    .filter((x): x is string => typeof x === 'string' && x.length > 0)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

/** Snapshot completo para `updateBanner` — `section` vem do banner (multi-seção). */
function toFullUpdatePayload(b: BannerAdmin, patch: Partial<BannerUpdatePayload> = {}): BannerUpdatePayload {
  return {
    section: b.section,
    title: b.title ?? null,
    subtitle: b.subtitle ?? null,
    imageUrl: b.imageUrl,
    targetUrl: b.targetUrl ?? null,
    active: b.active,
    sortOrder: b.sortOrder,
    startsAt: b.startsAt ?? null,
    endsAt: b.endsAt ?? null,
    tags: b.tags?.length ? b.tags : null,
    notes: b.notes ?? null,
    ...patch,
  };
}

/**
 * Lista: `useBanners` → `useQuery(bannersQueryKeys.section(dinamica))`; dados persistidos
 * são refletidos após mutations via invalidação no próprio hook (ver JSDoc em `useBanners`).
 */
export function DinamicaBannersView() {
  const { showError, showSuccess, toasts, removeToast } = useNotifications();
  const {
    data: rawBanners = [],
    isLoading,
    isError,
    error,
    isFetching,
    invalidate,
    createMut,
    updateMut,
    deleteMut,
    reorderMut,
  } = useBanners({ section: SECTION });

  const formSaving = createMut.isPending || updateMut.isPending;
  const reorderBusy = reorderMut.isPending;
  /** Desabilita ativar/editar/excluir durante outra mutação de linha ou reordenação. */
  const rowActionsBusy = updateMut.isPending || deleteMut.isPending || reorderMut.isPending;

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<BannerAdmin | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BannerAdmin | null>(null);

  const [jsonOpen, setJsonOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchInput === '') {
      setDebouncedSearch('');
      return;
    }
    const id = window.setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setDebouncedSearch('');
  }, []);

  /** Enquanto há texto no campo, trata como filtro ativo (reordenação bloqueada). */
  const reorderBlocked = statusFilter !== 'all' || searchInput.trim().length > 0;

  const filteredBanners = useMemo(() => {
    let list = rawBanners;
    if (statusFilter === 'active') list = list.filter((b) => b.active);
    if (statusFilter === 'inactive') list = list.filter((b) => !b.active);
    const q = debouncedSearch.trim();
    if (q) {
      list = list.filter((b) => bannerMatchesSearch(b, q));
    }
    return list;
  }, [rawBanners, statusFilter, debouncedSearch]);

  const nextSortOrder = useMemo(() => {
    if (!rawBanners.length) return 1;
    return Math.max(...rawBanners.map((b) => b.sortOrder)) + 1;
  }, [rawBanners]);

  const openCreate = () => {
    setFormMode('create');
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (b: BannerAdmin) => {
    setFormMode('edit');
    setEditing(b);
    setFormOpen(true);
  };

  const handleCreate = useCallback(
    async (payload: BannerCreatePayload) => {
      if (formSaving) return false;
      try {
        await createMut.mutateAsync(payload);
        showSuccess('Banner criado', 'Dados publicados em JSON.');
        setFormOpen(false);
        return true;
      } catch (e) {
        showError('Não foi possível criar', friendlyError(e));
        return false;
      }
    },
    [formSaving, createMut, showError, showSuccess]
  );

  const handleUpdate = useCallback(
    async (id: string, payload: BannerUpdatePayload) => {
      if (formSaving) return false;
      try {
        await updateMut.mutateAsync({ id, payload });
        showSuccess('Banner atualizado', 'JSON público atualizado.');
        setFormOpen(false);
        return true;
      } catch (e) {
        showError('Não foi possível salvar', friendlyError(e));
        return false;
      }
    },
    [formSaving, updateMut, showError, showSuccess]
  );

  const handleReorder = useCallback(
    async (orderedIds: string[]) => {
      if (reorderBusy) return;
      try {
        await reorderMut.mutateAsync(orderedIds);
        showSuccess('Ordem atualizada', '');
      } catch (e) {
        showError('Reordenação falhou', friendlyError(e));
      }
    },
    [reorderBusy, reorderMut, showError, showSuccess]
  );

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteMut.isPending) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      showSuccess('Banner removido', '');
      setDeleteTarget(null);
    } catch (e) {
      showError('Exclusão falhou', friendlyError(e));
    }
  };

  const toggleActive = async (b: BannerAdmin) => {
    if (updateMut.isPending) return;
    try {
      await updateMut.mutateAsync({
        id: b.id,
        payload: toFullUpdatePayload(b, { active: !b.active }),
      });
      showSuccess(b.active ? 'Banner desativado' : 'Banner ativado', '');
    } catch (e) {
      showError('Não foi possível alterar status', friendlyError(e));
    }
  };

  const errMessage = error instanceof Error ? error.message : 'Erro ao carregar';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Banners da Dinâmica</h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-600">
                Gerencie banners exibidos remotamente no app
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void invalidate()}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ArrowPathIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <button
                type="button"
                onClick={() => setJsonOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <CodeBracketIcon className="h-4 w-4" />
                Ver JSON público
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                <PlusIcon className="h-4 w-4" />
                Novo banner
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Card
          className="mb-6"
          title="Publicação do JSON (app)"
          subtitle="O painel e o app leem o mesmo contrato: o admin grava `banners-admin.json` e, na mesma operação, regenera o JSON público desta seção."
        >
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              <strong>Quando publica:</strong> a cada salvar, excluir ou reordenar, o servidor atualiza o store e
              reescreve <code className="rounded bg-gray-100 px-1">dinamica-banners.json</code> (e o espelho em{' '}
              <code className="rounded bg-gray-100 px-1">public/content/</code>). O modal &quot;Ver JSON público&quot;
              chama a mesma função que a rota abaixo.
            </p>
            <ul className="list-inside list-disc space-y-1 text-indigo-800">
              <li>
                <strong>Rota dinâmica (recomendada no app):</strong>{' '}
                <code className="rounded bg-gray-100 px-1">GET /api/public/banners/dinamica</code> — lê o disco em
                tempo real; CORS liberado para o mobile.
              </li>
              <li>
                <strong>Arquivo estático:</strong>{' '}
                <code className="rounded bg-gray-100 px-1">/content/dinamica-banners.json</code> — mesmo contrato,
                típico após build/deploy ou espelhamento do hosting; pode ficar defasado até o próximo deploy se o app
                não usar a API.
              </li>
            </ul>
          </div>
        </Card>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600">Status</label>
            <select
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="block text-xs font-medium text-gray-600">Busca</label>
            <div className="relative mt-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-8 text-sm"
                placeholder="Título, subtítulo, URLs, id, tags, notas…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
              />
              {searchInput ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={clearSearch}
                  aria-label="Limpar busca"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {reorderBlocked ? (
          <p className="mb-4 text-xs text-amber-800">
            Reordenação por arrastar está desativada enquanto houver filtro ou busca — a lista pode não refletir a
            ordem completa salva no servidor.
          </p>
        ) : null}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((k) => (
              <div key={k} className="h-32 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : null}

        {isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
            <p className="font-medium">Erro ao carregar banners</p>
            <p className="mt-1 text-sm">{errMessage}</p>
            <button
              type="button"
              onClick={() => void invalidate()}
              className="mt-4 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-200"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {!isLoading && !isError && filteredBanners.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-gray-700">Nenhum banner cadastrado</p>
            <p className="mt-2 text-sm text-gray-500">
              {rawBanners.length > 0 ? 'Nenhum resultado para os filtros atuais.' : 'Clique em &quot;Novo banner&quot; para começar.'}
            </p>
            {rawBanners.length === 0 ? (
              <button
                type="button"
                onClick={openCreate}
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                <PlusIcon className="h-4 w-4" />
                Adicionar banner
              </button>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !isError && filteredBanners.length > 0 ? (
          <BannerList
            banners={filteredBanners}
            reorderDisabled={reorderBlocked}
            reorderBusy={reorderBusy}
            actionsBusy={rowActionsBusy}
            onReorder={handleReorder}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onToggleActive={toggleActive}
          />
        ) : null}
      </main>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/40" />
        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
          <DialogPanel className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                {formMode === 'create' ? 'Novo banner' : 'Editar banner'}
              </DialogTitle>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Fechar"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <BannerForm
              mode={formMode}
              section={SECTION}
              initial={editing}
              nextSortOrder={nextSortOrder}
              onCreate={handleCreate}
              onUpdate={handleUpdate}
              onCancel={() => setFormOpen(false)}
            />
          </DialogPanel>
        </div>
      </Dialog>

      <DeleteBannerModal
        open={!!deleteTarget}
        banner={deleteTarget}
        loading={deleteMut.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <PublicJsonModal open={jsonOpen} section={SECTION} onClose={() => setJsonOpen(false)} />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
