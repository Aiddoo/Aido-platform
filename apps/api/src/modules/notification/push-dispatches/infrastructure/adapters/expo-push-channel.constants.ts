import { Expo } from "expo-server-sdk";

import { HOUR_MS, MINUTE_MS } from "#api/shared/domain/time/time-units";

import type { PushChannelTiming } from "../../application/ports/push-channel.port.js";

/**
 * Expo 채널만의 처리량·시간 설정. 다른 채널은 자기 어댑터 옆에 따로 둔다.
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */
export const EXPO_PUSH_CHANNEL_CONFIG = {
  // 요청 하나에 100건까지다(PUSH_TOO_MANY_NOTIFICATIONS)
  chunkSize: Expo.pushNotificationChunkSizeLimit,
  // 프로젝트 한도(초당 600건)보다 여유를 둔다. 운영 API는 단일 프로세스라 인스턴스를 늘리면 인스턴스 수로 나눈다
  messagesPerSecond: 500,
  // 기기별 MessageRateExceeded는 Expo 안내대로 지수 backoff 뒤 해당 메시지만 다시 보낸다
  rateExceededRetryDelaysMs: [1000, 2000, 4000],
  // 수락 15분 뒤부터 receipt를 물으라고 권하고 약 24시간 보관한다. SDK 전송은 abort signal을 받지 않아
  // 정책 timeout 뒤에도 요청이 이어질 수 있어 lease 여유를 둔다
  timing: {
    receipt: { readyAfterMs: 15 * MINUTE_MS, retentionMs: 24 * HOUR_MS },
    unabortableSendGraceMs: 10 * MINUTE_MS,
  } satisfies PushChannelTiming,
} as const;
