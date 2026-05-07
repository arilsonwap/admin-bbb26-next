import { z } from 'zod';

/** Estados operacionais (fonte única no banco). */
export const PollLifecycleStatusSchema = z.enum([
  'draft',
  'scheduled',
  'active',
  'paused',
  'closed',
]);
export type PollLifecycleStatus = z.infer<typeof PollLifecycleStatusSchema>;

export const PollTypeSchema = z.enum(['home', 'paredao']);
export type PollType = z.infer<typeof PollTypeSchema>;

export const PollRowSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: PollLifecycleStatusSchema,
  type: PollTypeSchema,
  open_at: z.string().datetime().nullable().optional(),
  close_at: z.string().datetime().nullable().optional(),
  auto_open_on_app_launch: z.boolean(),
  auto_open_priority: z.number().int(),
  show_in_home_hub: z.boolean(),
  allow_multiple_votes: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
});
export type PollRow = z.infer<typeof PollRowSchema>;

export const PollCreateInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: PollLifecycleStatusSchema.optional(),
  type: PollTypeSchema,
  open_at: z.string().datetime().nullable().optional(),
  close_at: z.string().datetime().nullable().optional(),
  auto_open_on_app_launch: z.boolean().optional(),
  auto_open_priority: z.number().int().optional(),
  show_in_home_hub: z.boolean().optional(),
  allow_multiple_votes: z.boolean().optional(),
});
export type PollCreateInput = z.infer<typeof PollCreateInputSchema>;

export const PollUpdateInputSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: PollLifecycleStatusSchema.optional(),
  type: PollTypeSchema,
  open_at: z.string().datetime().nullable().optional(),
  close_at: z.string().datetime().nullable().optional(),
  auto_open_on_app_launch: z.boolean().optional(),
  auto_open_priority: z.number().int().optional(),
  show_in_home_hub: z.boolean().optional(),
  allow_multiple_votes: z.boolean().optional(),
});
export type PollUpdateInput = z.infer<typeof PollUpdateInputSchema>;

/** Opção da enquete — alinhado ao que o painel lê da tabela `options` (REST). */
export const PollOptionRowSchema = z.object({
  id: z.string().min(1),
  poll_id: z.string().min(1),
  label: z.string().min(1),
  image_url: z.string().nullable(),
  created_at: z.string().datetime().optional(),
});
export type PollOptionRow = z.infer<typeof PollOptionRowSchema>;

export const PollOptionInputSchema = z.object({
  id: z.string().min(1),
  poll_id: z.string().min(1),
  label: z.string().min(1),
  image_url: z.string().nullable().optional(),
  participant_id: z.string().nullable().optional(),
});
export type PollOptionInput = z.infer<typeof PollOptionInputSchema>;

/** Alias legível para telas que ainda usam “PollStatus”. */
export type PollStatus = PollLifecycleStatus;
