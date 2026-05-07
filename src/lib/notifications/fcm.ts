import type { Message } from 'firebase-admin/messaging';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirebaseAdminApp } from '../firebaseAdmin';
import type { AppPushData } from '../../models/pushTypes';
import { serializeAppPushDataToFcm } from './payload';

export type FcmSendResult = {
  successCount: number;
  failureCount: number;
  errors: Array<{ index?: number; message: string }>;
  rawResponse?: unknown;
};

function buildNotificationPart(title: string, body: string) {
  return { title, body };
}

export function buildFcmMessageForToken(params: {
  token: string;
  title: string;
  body: string;
  data: AppPushData;
  imageUrl?: string;
  /**
   * Android + Notifee: sem `notification` no payload FCM evita duplicar notificação do sistema.
   * `title`/`body`/`imageUrl` continuam em `data` (serializeAppPushDataToFcm).
   */
  dataOnly?: boolean;
}): Message {
  const data = serializeAppPushDataToFcm(params.data);
  if (params.dataOnly) {
    return {
      token: params.token,
      data,
      android: { priority: 'high' },
    };
  }
  const msg: Message = {
    token: params.token,
    notification: buildNotificationPart(params.title, params.body),
    data,
    android: {
      priority: 'high',
      notification: params.imageUrl
        ? { imageUrl: params.imageUrl, channelId: 'default' }
        : { channelId: 'default' },
    },
    apns: {
      payload: {
        aps: {
          ...(params.imageUrl ? { 'mutable-content': 1 as const } : {}),
        },
      },
      fcmOptions: params.imageUrl ? { imageUrl: params.imageUrl } : undefined,
    },
  };
  return msg;
}

export function buildFcmMessageForTopic(params: {
  topic: string;
  title: string;
  body: string;
  data: AppPushData;
  imageUrl?: string;
  dataOnly?: boolean;
}): Message {
  const data = serializeAppPushDataToFcm(params.data);
  if (params.dataOnly) {
    return {
      topic: params.topic,
      data,
      android: { priority: 'high' },
    };
  }
  return {
    topic: params.topic,
    notification: buildNotificationPart(params.title, params.body),
    data,
    android: {
      priority: 'high',
      notification: params.imageUrl
        ? { imageUrl: params.imageUrl, channelId: 'default' }
        : { channelId: 'default' },
    },
    apns: {
      payload: {
        aps: {
          ...(params.imageUrl ? { 'mutable-content': 1 as const } : {}),
        },
      },
      fcmOptions: params.imageUrl ? { imageUrl: params.imageUrl } : undefined,
    },
  };
}

export async function sendFcmMessage(message: Message): Promise<{ messageId: string }> {
  const messaging = getMessaging(getFirebaseAdminApp());
  const messageId = await messaging.send(message);
  return { messageId };
}

export async function sendFcmEach(messages: Message[]): Promise<FcmSendResult> {
  if (messages.length === 0) {
    return { successCount: 0, failureCount: 0, errors: [], rawResponse: [] };
  }
  const messaging = getMessaging(getFirebaseAdminApp());
  const res = await messaging.sendEach(messages);
  const errors: Array<{ index?: number; message: string }> = [];
  res.responses.forEach((r, i) => {
    if (!r.success && r.error) {
      errors.push({ index: i, message: r.error.message || String(r.error) });
    }
  });
  return {
    successCount: res.successCount,
    failureCount: res.failureCount,
    errors,
    rawResponse: res.responses.map((r) => ({
      success: r.success,
      messageId: r.messageId,
      error: r.error
        ? { code: r.error.code, message: r.error.message }
        : undefined,
    })),
  };
}
