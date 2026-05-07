import type { AdminSendPushPayload } from '../../models/pushSchemas';
import type { AppPushData } from '../../models/pushTypes';
import { buildAppPushDataFromParts } from './payload';
import {
  buildFcmMessageForToken,
  buildFcmMessageForTopic,
  sendFcmEach,
  sendFcmMessage,
  type FcmSendResult,
} from './fcm';
import {
  getPushDevicePlatformByFcmToken,
  insertPushNotificationLog,
  listFcmDevicesForSegment,
  type InsertPushLogInput,
} from '../../services/supabasePushService';

export type AdminPushResult = {
  log: Awaited<ReturnType<typeof insertPushNotificationLog>>;
  fcm: FcmSendResult & { messageIds?: string[] };
};

function resolveTitleBody(payload: AdminSendPushPayload): { title: string; body: string } {
  const title = (payload.notification?.title ?? payload.data.title ?? '').trim();
  const body = (payload.notification?.body ?? payload.data.body ?? '').trim();
  return { title, body };
}

function buildDataPayload(payload: AdminSendPushPayload, title: string, body: string): AppPushData {
  return buildAppPushDataFromParts({
    type: payload.data.type,
    title,
    body,
    imageUrl: payload.data.imageUrl?.trim() || undefined,
    targetScreen: payload.data.targetScreen?.trim() || undefined,
    entityId: payload.data.entityId?.trim() || undefined,
    url: payload.data.url?.trim() || undefined,
  });
}

function toLogStatus(
  success: number,
  failure: number
): InsertPushLogInput['status'] {
  if (success === 0 && failure === 0) return 'failed';
  if (failure === 0) return 'sent';
  if (success === 0) return 'failed';
  return 'partial';
}

export async function runAdminPushSend(
  payload: AdminSendPushPayload,
  options: { createdBy?: string | null }
): Promise<AdminPushResult> {
  const { title, body } = resolveTitleBody(payload);
  const imageUrl = payload.data.imageUrl?.trim() || undefined;
  const data = buildDataPayload(payload, title, body);

  const audienceSnapshot: Record<string, unknown> = {
    mode: payload.mode,
    audience: payload.audience,
  };

  const payloadData: Record<string, unknown> = {
    notification: { title, body },
    data,
  };

  let fcmResult: FcmSendResult & { messageIds?: string[] } = {
    successCount: 0,
    failureCount: 0,
    errors: [],
  };

  try {
    if (payload.audience.type === 'token') {
      const platform = await getPushDevicePlatformByFcmToken(payload.audience.token);
      const dataOnly = platform === 'android';
      const msg = buildFcmMessageForToken({
        token: payload.audience.token,
        title,
        body,
        data,
        imageUrl,
        dataOnly,
      });
      const r = await sendFcmMessage(msg);
      fcmResult = {
        successCount: 1,
        failureCount: 0,
        errors: [],
        messageIds: [r.messageId],
        rawResponse: r,
      };
    } else if (payload.audience.type === 'topic') {
      const topicList: string[] =
        payload.audience.topics && payload.audience.topics.length > 0
          ? [...payload.audience.topics]
          : payload.audience.topic
            ? [payload.audience.topic]
            : [];
      if (topicList.length === 0) {
        fcmResult = {
          successCount: 0,
          failureCount: 0,
          errors: [{ message: 'Audiência topic sem topic/topics válidos.' }],
        };
      } else {
        const messages = topicList.map((topic) =>
          buildFcmMessageForTopic({ topic, title, body, data, imageUrl })
        );
        const batch = await sendFcmEach(messages);
        fcmResult = { ...batch, messageIds: undefined };
      }
    } else {
      const devices = await listFcmDevicesForSegment({
        platform: payload.audience.platform,
        topics: payload.audience.topics,
      });
      if (devices.length === 0) {
        fcmResult = {
          successCount: 0,
          failureCount: 0,
          errors: [{ message: 'Nenhum dispositivo encontrado para o segmento.' }],
        };
      } else {
        const chunks: Array<Array<{ fcm_token: string; dataOnly: boolean }>> = [];
        const flat = devices.map((d) => ({
          fcm_token: d.fcm_token,
          dataOnly: d.platform === 'android',
        }));
        for (let i = 0; i < flat.length; i += 500) {
          chunks.push(flat.slice(i, i + 500));
        }
        let totalSuccess = 0;
        let totalFailure = 0;
        const allErrors: Array<{ index?: number; message: string }> = [];
        const allRaw: unknown[] = [];
        for (const chunk of chunks) {
          const msgs = chunk.map(({ fcm_token, dataOnly }) =>
            buildFcmMessageForToken({
              token: fcm_token,
              title,
              body,
              data,
              imageUrl,
              dataOnly,
            })
          );
          const batch = await sendFcmEach(msgs);
          totalSuccess += batch.successCount;
          totalFailure += batch.failureCount;
          allErrors.push(...batch.errors);
          if (batch.rawResponse !== undefined) allRaw.push(batch.rawResponse);
        }
        fcmResult = {
          successCount: totalSuccess,
          failureCount: totalFailure,
          errors: allErrors,
          rawResponse: allRaw,
        };
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    fcmResult = {
      successCount: 0,
      failureCount: 1,
      errors: [{ message }],
    };
  }

  const logInput: InsertPushLogInput = {
    title,
    body,
    type: payload.data.type,
    audienceType: payload.audience.type,
    audienceSnapshot,
    payloadData,
    status: toLogStatus(fcmResult.successCount, fcmResult.failureCount),
    provider: 'fcm',
    providerResponse: fcmResult.rawResponse ?? fcmResult.errors,
    successCount: fcmResult.successCount,
    failureCount: fcmResult.failureCount,
    createdBy: options.createdBy ?? null,
  };

  const log = await insertPushNotificationLog(logInput);
  return { log, fcm: fcmResult };
}
