'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { bannersQueryKeys } from '../../../lib/bannersQueryKeys';
import type { BannerAdmin, BannerCreatePayload, BannerUpdatePayload } from '../../../models/bannersTypes';
import type { BannerSection } from '../../../models/bannersTypes';
import {
  createBanner,
  deleteBanner,
  listBannersBySection,
  reorderBanners,
  updateBanner,
} from '../services/bannersClient';

type UseBannersOptions = {
  section: BannerSection;
};

/**
 * Lista de banners da seção via `useQuery` + `bannersQueryKeys.section(section)`.
 *
 * **Invalidação:** após `create` / `update` / `delete` (`onSuccess`) e após `reorder`
 * (`onSettled`), chama `invalidateQueries({ queryKey })` para alinhar UI com o JSON em disco.
 * Use `invalidate()` para refresh manual ou documente outro consumidor que dependa disso.
 */
export function useBanners({ section }: UseBannersOptions) {
  const queryClient = useQueryClient();
  const queryKey = bannersQueryKeys.section(section);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const query = useQuery({
    queryKey,
    queryFn: () => listBannersBySection(section),
    staleTime: 10_000,
  });

  const createMut = useMutation({
    mutationFn: (payload: BannerCreatePayload) => createBanner(payload),
    onSuccess: invalidate,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BannerUpdatePayload }) =>
      updateBanner(id, payload),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBanner(id),
    onSuccess: invalidate,
  });

  const reorderMut = useMutation({
    mutationFn: (orderedIds: string[]) => reorderBanners({ section, orderedIds }),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BannerAdmin[]>(queryKey);
      if (previous) {
        const byId = new Map(previous.map((b) => [b.id, b] as const));
        const next: BannerAdmin[] = orderedIds
          .map((id) => byId.get(id))
          .filter((b): b is BannerAdmin => b !== undefined)
          .map((b, index) => ({ ...b, sortOrder: index + 1 }));
        if (next.length === previous.length) {
          queryClient.setQueryData(queryKey, next);
        }
      }
      return { previous };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
    },
    onSettled: invalidate,
  });

  return {
    ...query,
    queryKey,
    section,
    createMut,
    updateMut,
    deleteMut,
    reorderMut,
    invalidate,
  };
}
