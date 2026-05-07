import { z } from 'zod';

export const QueridometroFeatureModeSchema = z.enum(['active', 'disabled']);

export const QueridometroFeatureStateSchema = z.object({
  mode: QueridometroFeatureModeSchema,
  title: z.string().min(1).max(500),
  message: z.string().min(1).max(4000),
  buttonLabel: z.string().min(1).max(200),
  updatedAt: z.string().min(1),
});

export const QueridometroFeatureSaveBodySchema = z.object({
  mode: QueridometroFeatureModeSchema,
  title: z.string().min(1).max(500),
  message: z.string().min(1).max(4000),
  buttonLabel: z.string().min(1).max(200),
});
