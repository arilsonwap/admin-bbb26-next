import type { BannerSection } from '../models/bannersTypes';

export const bannersQueryKeys = {
  all: ['banners'] as const,
  section: (section: BannerSection) => [...bannersQueryKeys.all, 'section', section] as const,
};
