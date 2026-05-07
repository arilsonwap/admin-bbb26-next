import { z } from 'zod';
import { AppNotificationTypeSchema, PushPlatformSchema } from './pushTypes';

export const RegisterPushDevicePayloadSchema = z.object({
  deviceId: z.string().min(1),
  platform: PushPlatformSchema.default('unknown'),
  appVersion: z.string().optional(),
  fcmToken: z.string().min(1),
  /** Slugs livres (ex.: news, polls); validação leve para não bloquear evolução do app. */
  topics: z.array(z.string().min(1)).max(32).optional().default([]),
  notificationsEnabled: z.boolean().optional().default(true),
  userId: z.string().uuid().optional().nullable(),
});

export type RegisterPushDevicePayload = z.infer<typeof RegisterPushDevicePayloadSchema>;

const AudienceTokenSchema = z.object({
  type: z.literal('token'),
  token: z.string().min(1),
});

const AudienceTopicSchema = z
  .object({
    type: z.literal('topic'),
    topic: z.string().min(1).optional(),
    /** Um disparo por string (FCM aceita um topic por mensagem). */
    topics: z.array(z.string().min(1)).min(1).optional(),
  })
  .refine((d) => Boolean(d.topic?.trim()) || Boolean(d.topics?.length), {
    message: 'Informe topic ou topics com pelo menos um item.',
    path: ['topic'],
  });

const AudienceSegmentSchema = z.object({
  type: z.literal('segment'),
  platform: PushPlatformSchema.optional(),
  /** Dispositivos com pelo menos um destes tópicos (overlap). */
  topics: z.array(z.string().min(1)).optional(),
});

export const NotificationAudienceSchema = z.union([
  AudienceTokenSchema,
  AudienceTopicSchema,
  AudienceSegmentSchema,
]);

export const AdminSendPushPayloadSchema = z
  .object({
    mode: z.enum(['test', 'live']),
    audience: NotificationAudienceSchema,
    notification: z
      .object({
        title: z.string().min(1),
        body: z.string().min(1),
      })
      .optional(),
    data: z.object({
      type: AppNotificationTypeSchema,
      title: z.string().optional(),
      body: z.string().optional(),
      imageUrl: z.string().optional(),
      targetScreen: z.string().optional(),
      entityId: z.string().optional(),
      url: z.string().optional(),
    }),
  })
  .superRefine((val, ctx) => {
    if (val.mode === 'test') {
      if (val.audience.type !== 'token' || !val.audience.token) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Modo teste exige audience.type = "token" e um FCM token válido.',
          path: ['audience'],
        });
      }
    }
    const title = (val.notification?.title ?? val.data.title ?? '').trim();
    const body = (val.notification?.body ?? val.data.body ?? '').trim();
    if (!title || !body) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe título e corpo em notification ou em data.',
        path: ['notification'],
      });
    }
  });

export type AdminSendPushPayload = z.infer<typeof AdminSendPushPayloadSchema>;
