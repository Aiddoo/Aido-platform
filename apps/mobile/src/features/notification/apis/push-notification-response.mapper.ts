import { NOTIFICATION_ACTION_TYPE } from '@aido/api/vocabulary';
import type { AppLifecycleState } from '@src/core/ports/app-lifecycle-gateway';
import type { PushNotificationResponse as OsPushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import type { Instant } from '@src/shared/date/instant';

import type { PushNotificationResponse } from '../domains/push-notification-response.model';
import type { PushNotification } from '../domains/push-notification.model';
import { parsePushNotification } from './push-notification.mapper';

/** OS가 준 응답. data는 앱 밖에서 온 값이라 모양을 믿지 않고 읽는다 */
interface OsPushNotificationResponseInput extends Omit<OsPushNotificationResponse, 'data'> {
  data: unknown;
}

/** 응답을 받은 순간의 앱. 시계와 앱 상태는 부르는 쪽이 읽어 넘긴다 */
interface PushNotificationResponseContext {
  receivedAt: Instant;
  isLaunchResponse: boolean;
  appState: AppLifecycleState;
  activeSince: Instant | null;
}

/** 읽은 응답과 버린 칸. 로그는 부르는 쪽이 남긴다 */
interface ParsedPushNotificationResponse {
  response: PushNotificationResponse;
  /** 계약에 맞지 않아 버린 data 칸의 경로. 값은 싣지 않는다 */
  droppedPaths: readonly string[];
  /** data를 읽지 못해 알림함을 여는 대체 푸시로 바꿨으면 false */
  isReadable: boolean;
}

/**
 * 눌린 OS 응답을 읽는 곳은 여기 하나다. 버튼 응답의 알림은 처리한 뒤에 지우므로(지우기가 실패하거나 그 전에) 버튼을
 * 누른 뒤 본문을 또 누를 수 있어, 응답 id는 알림 identifier에 누른 동작(본문 탭도 expo-notifications 기본 동작 id가
 * 있다)을 더한다. 같은 응답이 다시 오면(콜드 스타트의 마지막 응답과 리스너) 같은 id라 한 번만 연다
 */
export function parsePushNotificationResponse(
  osResponse: OsPushNotificationResponseInput,
  context: PushNotificationResponseContext,
): ParsedPushNotificationResponse {
  const { notification, droppedPaths } = parsePushNotification(osResponse.data);
  return {
    response: {
      id: JSON.stringify([osResponse.id, osResponse.actionIdentifier]),
      notificationIdentifier: osResponse.id,
      actionIdentifier: osResponse.actionIdentifier,
      notification: notification ?? createUnreadablePushNotification(),
      ...context,
    },
    droppedPaths,
    isReadable: notification != null,
  };
}

/**
 * 읽지 못한 푸시. 칸마다 깨졌을 때와 같은 값이다: 서버 기록이 없고(0) 종류를 모르며 알림함으로 연다.
 * 누른 사람을 아무 데도 데려가지 않는 것보다 알림함이 낫다
 */
function createUnreadablePushNotification(): PushNotification {
  return {
    notificationId: 0,
    type: null,
    target: { kind: 'NOTIFICATIONS' },
    marketingOptOutToken: null,
    actionType: NOTIFICATION_ACTION_TYPE.DEEP_LINK,
    campaignKey: null,
    variantId: null,
    purpose: null,
  };
}
