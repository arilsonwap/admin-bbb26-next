export const pollsQueryKeys = {
  all: ['polls'] as const,
  list: () => [...pollsQueryKeys.all, 'list'] as const,
};
