import { z } from 'zod';
import {
  PollOptionInputSchema,
  PollLifecycleStatusSchema,
  PollCreateInputSchema,
  PollUpdateInputSchema,
} from './pollsTypes';

export const PollOptionPayloadSchema = PollOptionInputSchema.extend({
  label: z.string().min(1),
});

export const PollCreatePayloadSchema = z.object({
  poll: PollCreateInputSchema,
  options: z.array(PollOptionPayloadSchema).default([]),
});

export const PollUpdatePayloadSchema = z.object({
  poll: PollUpdateInputSchema.extend({
    status: PollLifecycleStatusSchema.optional(),
  }),
  options: z.array(PollOptionPayloadSchema).default([]),
});

export const PollPriorityPayloadSchema = z.object({
  auto_open_priority: z.number().int(),
});
