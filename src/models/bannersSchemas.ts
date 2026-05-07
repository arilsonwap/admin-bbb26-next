import { z } from 'zod';

/** Slug da seção (ex.: dinamica). Minúsculas, números e hífen. */
export const BannerSectionParamSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use apenas minúsculas, números e hífens');

const HttpUrlSchema = z.string().url('URL inválida').refine(
  (u) => /^https?:\/\//i.test(u),
  'Use http:// ou https://'
);

const OptionalHttpUrlSchema = z
  .union([z.literal(''), z.null(), HttpUrlSchema])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : v));

const OptionalIsoDateSchema = z
  .union([z.literal(''), z.null(), z.string().datetime()])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : v));

export const BannerAdminSchema = z
  .object({
    id: z.string().min(1),
    section: BannerSectionParamSchema,
    title: z.string().max(200).nullable().optional(),
    subtitle: z.string().max(500).nullable().optional(),
    imageUrl: HttpUrlSchema,
    targetUrl: z.union([z.null(), HttpUrlSchema]).optional().default(null),
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(1_000_000),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    startsAt: OptionalIsoDateSchema,
    endsAt: OptionalIsoDateSchema,
    tags: z.array(z.string().min(1).max(64)).max(32).optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startsAt && data.endsAt) {
      const a = Date.parse(data.startsAt);
      const b = Date.parse(data.endsAt);
      if (!Number.isNaN(a) && !Number.isNaN(b) && a >= b) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endsAt deve ser posterior a startsAt',
          path: ['endsAt'],
        });
      }
    }
  });

export const BannerCreatePayloadSchema = z.object({
  section: BannerSectionParamSchema,
  title: z.string().max(200).optional(),
  subtitle: z.string().max(500).optional(),
  imageUrl: HttpUrlSchema,
  targetUrl: OptionalHttpUrlSchema,
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1_000_000).optional(),
  startsAt: OptionalIsoDateSchema,
  endsAt: OptionalIsoDateSchema,
  tags: z.array(z.string().min(1).max(64)).max(32).optional(),
  notes: z.string().max(2000).optional(),
});

/** Atualização parcial: apenas campos enviados são aplicados (exceto `section`, obrigatório). */
export const BannerUpdatePayloadSchema = z
  .object({
    section: BannerSectionParamSchema,
    title: z.union([z.string().max(200), z.null()]).optional(),
    subtitle: z.union([z.string().max(500), z.null()]).optional(),
    imageUrl: HttpUrlSchema.optional(),
    targetUrl: z.union([z.null(), HttpUrlSchema]).optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(1_000_000).optional(),
    startsAt: z.union([z.null(), z.string().datetime()]).optional(),
    endsAt: z.union([z.null(), z.string().datetime()]).optional(),
    tags: z.union([z.array(z.string().min(1).max(64)).max(32), z.null()]).optional(),
    notes: z.union([z.string().max(2000), z.null()]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startsAt && data.endsAt) {
      const a = Date.parse(data.startsAt);
      const b = Date.parse(data.endsAt);
      if (!Number.isNaN(a) && !Number.isNaN(b) && a >= b) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endsAt deve ser posterior a startsAt',
          path: ['endsAt'],
        });
      }
    }
  });

export const BannerReorderPayloadSchema = z.object({
  section: BannerSectionParamSchema,
  orderedIds: z.array(z.string().min(1)).min(1),
});

/** Item enxuto para o app; gerado por `toPublicFile` (ver `bannersPublic.ts`). */
export const BannerPublicItemSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  targetUrl: z.union([z.string(), z.null()]),
  active: z.boolean(),
  sortOrder: z.number(),
});

/** Contrato público por seção; alinhado ao arquivo `{section}-banners.json` e à rota `/api/public/banners/[section]`. */
export const BannerPublicFileSchema = z.object({
  section: z.string(),
  updatedAt: z.string(),
  items: z.array(BannerPublicItemSchema),
});

export const BannersAdminFileSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().datetime(),
  sections: z.record(
    z.string(),
    z.object({
      items: z.array(BannerAdminSchema),
    })
  ),
});
