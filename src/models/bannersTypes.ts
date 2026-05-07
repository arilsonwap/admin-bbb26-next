import { z } from 'zod';
import {
  BannerAdminSchema,
  BannerCreatePayloadSchema,
  BannerPublicFileSchema,
  BannerPublicItemSchema,
  BannerReorderPayloadSchema,
  BannerSectionParamSchema,
  BannerUpdatePayloadSchema,
} from './bannersSchemas';

export type BannerSection = z.infer<typeof BannerSectionParamSchema>;

export type BannerAdmin = z.infer<typeof BannerAdminSchema>;

export type BannerCreatePayload = z.infer<typeof BannerCreatePayloadSchema>;

export type BannerUpdatePayload = z.infer<typeof BannerUpdatePayloadSchema>;

export type BannerReorderPayload = z.infer<typeof BannerReorderPayloadSchema>;

export type BannerPublicItem = z.infer<typeof BannerPublicItemSchema>;

export type BannerPublicFile = z.infer<typeof BannerPublicFileSchema>;
