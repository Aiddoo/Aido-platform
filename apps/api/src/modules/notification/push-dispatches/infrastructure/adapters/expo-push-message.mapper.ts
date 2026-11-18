import { PUSH_DEVICE_PLATFORM } from "@aido/api/vocabulary";
import type { ExpoPushMessage } from "expo-server-sdk";

import type { PushMessage } from "../../application/ports/push-channel.port.js";

export const EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH = 4096;

export type ExpoPushMessageBuildResult =
  | {
      status: "ready";
      message: ExpoPushMessage;
      byteLength: number;
    }
  | {
      status: "rejected";
      reason: "payload-too-large";
      byteLength: number;
      maxByteLength: typeof EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH;
    };

/**
 * Expo에 전송될 완성된 메시지를 JSON UTF-8 byte 기준으로 측정한다.
 * 한글·emoji·escape 문자는 JavaScript string length와 byte 수가 다르다.
 */
export function measureExpoPushMessageByteLength(message: ExpoPushMessage): number {
  return new TextEncoder().encode(JSON.stringify(message)).byteLength;
}

/** PushMessage를 전송 가능한 Expo 메시지로 만들고 provider 한도를 같이 검증한다. */
export function buildExpoPushMessage(payload: PushMessage): ExpoPushMessageBuildResult {
  const message: ExpoPushMessage = {
    to: payload.token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    badge: payload.badge,
    // collapseId는 iOS에서 apns-collapse-id로 보관 중·이미 뜬 알림을 바꾼다. Android에서는 FCM collapse_key라
    // 꺼진 기기에 4개만 남기고 나머지를 버리므로 싣지 않는다. 이미 뜬 Android 알림은 tag가 바꾸고 iOS는 tag를 무시한다
    ...(payload.platform === PUSH_DEVICE_PLATFORM.IOS && { collapseId: payload.collapseKey }),
    tag: payload.collapseKey,
    sound: payload.sound ?? "default",
    // 앱이 등록한 Android 알림 채널은 default 하나다
    channelId: "default",
    categoryId: payload.categoryId?.value,
    priority: payload.priority,
    ttl: payload.ttlSeconds,
  };
  const byteLength = measureExpoPushMessageByteLength(message);

  if (byteLength > EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH) {
    return {
      status: "rejected",
      reason: "payload-too-large",
      byteLength,
      maxByteLength: EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH,
    };
  }

  return { status: "ready", message, byteLength };
}
