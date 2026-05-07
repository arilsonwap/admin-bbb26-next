import { z } from 'zod';

/** Semver simples: apenas X.Y.Z com dígitos (sem prerelease). */
export const semverSimpleRegex = /^\d+\.\d+\.\d+$/;

export const semverSimpleString = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(1)
      .regex(semverSimpleRegex, 'Use o formato X.Y.Z (ex.: 1.4.0)')
  );

export const AppVersionPayloadSchema = z.object({
  enabled: z.boolean().optional().default(true),
  latestVersion: semverSimpleString,
  minSupportedVersion: semverSimpleString,
  forceUpdate: z.boolean(),
  message: z
    .string()
    .optional()
    .default('')
    .transform((s) => s.trim()),
  requiredMessage: z
    .string()
    .optional()
    .default('')
    .transform((s) => s.trim()),
  storeUrlAndroid: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'URL da Play Store / market é obrigatória')),
  storeUrlIos: z
    .string()
    .optional()
    .default('')
    .transform((s) => s.trim()),
  showOncePerSession: z.boolean().optional().default(true),
});

export type AppVersionPayloadInput = z.input<typeof AppVersionPayloadSchema>;
export type AppVersionPayload = z.infer<typeof AppVersionPayloadSchema>;
