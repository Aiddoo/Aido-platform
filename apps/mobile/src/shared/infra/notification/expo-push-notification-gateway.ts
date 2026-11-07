import type { Logger } from '@src/core/ports/logger';
import type {
  IosPushAuthorizationStatus,
  PushNotificationGateway,
  PushNotificationResponse,
  PushPermissionResponse,
} from '@src/core/ports/push-notification-gateway';
import { getErrorMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { withTimeout } from 'es-toolkit';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import { PUSH_NOTIFICATION_LOG_EVENT } from './push-notification-log-events';

/** 서버가 보내는 푸시의 채널 id와 같다. 바꾸면 기존 설치의 채널과 어긋난다 */
const DEFAULT_CHANNEL_ID = 'default';
/** Expo 알림 문서의 Android 기본 채널 값이다 */
const CHANNEL_VIBRATION_PATTERN = [0, 250, 250, 250];
const CHANNEL_LIGHT_COLOR = '#FF231F7C';

/** APNs·FCM 등록이 끝나지 않으면 발급이 멈춘다. 다음 보고와 로그아웃이 기다리지 않게 끊는다 */
export const PUSH_TOKEN_ISSUE_TIMEOUT_MS = 15_000;

const IOS_AUTHORIZATION_STATUS = {
  [Notifications.IosAuthorizationStatus.NOT_DETERMINED]: 'NOT_DETERMINED',
  [Notifications.IosAuthorizationStatus.DENIED]: 'DENIED',
  [Notifications.IosAuthorizationStatus.AUTHORIZED]: 'AUTHORIZED',
  [Notifications.IosAuthorizationStatus.PROVISIONAL]: 'PROVISIONAL',
  [Notifications.IosAuthorizationStatus.EPHEMERAL]: 'EPHEMERAL',
} as const satisfies Record<Notifications.IosAuthorizationStatus, IosPushAuthorizationStatus>;

function toPushPermissionResponse(
  response: Notifications.NotificationPermissionsStatus,
): PushPermissionResponse {
  return {
    status: response.status,
    canAskAgain: response.canAskAgain,
    iosStatus: response.ios ? IOS_AUTHORIZATION_STATUS[response.ios.status] : null,
  };
}

function toPushNotificationResponse(
  response: Notifications.NotificationResponse,
): PushNotificationResponse {
  return {
    id: response.notification.request.identifier,
    actionIdentifier: response.actionIdentifier,
    data: response.notification.request.content.data ?? {},
  };
}

/** 앱이 켜져 있어도 알림을 보이게 한다. 첫 알림을 놓치지 않게 앱이 그려지기 전에 부른다 */
export function registerForegroundNotificationPresentation() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Android 13+는 채널이 있어야 권한 창과 토큰 발급이 동작한다. 채널이 없는 플랫폼에서도 부르면
 * 아무 일도 없다. 채널을 못 만들어도 권한 상태는 읽고 보고하므로 실패는 기록만 하고 넘어간다.
 */
async function ensureChannel(logger: Logger): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: t('common:pushChannel.default'),
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: CHANNEL_VIBRATION_PATTERN,
      lightColor: CHANNEL_LIGHT_COLOR,
    });
  } catch (error) {
    logger.warn(PUSH_NOTIFICATION_LOG_EVENT.CHANNEL_SETUP_FAILED, {
      error: getErrorMessage(error),
    });
  }
}

export function createExpoPushNotificationGateway(logger: Logger): PushNotificationGateway {
  return {
    getPermission: async () => toPushPermissionResponse(await Notifications.getPermissionsAsync()),
    requestPermission: async () => {
      await ensureChannel(logger);
      return toPushPermissionResponse(await Notifications.requestPermissionsAsync());
    },
    getToken: async () => {
      await ensureChannel(logger);
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      const token = await withTimeout(
        () => Notifications.getExpoPushTokenAsync({ projectId }),
        PUSH_TOKEN_ISSUE_TIMEOUT_MS,
      );
      return token.data;
    },
    subscribeToken: (listener) => {
      // getExpoPushTokenAsync도 같은 이벤트를 다시 보내므로 값이 바뀔 때만 알린다.
      // 그러지 않으면 보고 → 토큰 발급 → 이벤트 → 보고가 끝없이 이어진다.
      let lastDeviceToken: unknown;
      const subscription = Notifications.addPushTokenListener(({ data }) => {
        if (data === lastDeviceToken) {
          return;
        }
        lastDeviceToken = data;
        listener();
      });
      return () => subscription.remove();
    },
    subscribeReceived: (listener) => {
      const subscription = Notifications.addNotificationReceivedListener((notification) =>
        listener({ data: notification.request.content.data ?? {} }),
      );
      return () => subscription.remove();
    },
    subscribeResponse: (listener) => {
      const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
        listener(toPushNotificationResponse(response)),
      );
      return () => subscription.remove();
    },
    getLastResponse: () => {
      const response = Notifications.getLastNotificationResponse();
      return response == null ? null : toPushNotificationResponse(response);
    },
    clearLastResponse: () => Notifications.clearLastNotificationResponse(),
    setCategory: async ({ identifier, actions }) => {
      await Notifications.setNotificationCategoryAsync(
        identifier,
        actions.map(({ identifier: actionIdentifier, title, opensAppToForeground }) => ({
          identifier: actionIdentifier,
          buttonTitle: title,
          options: { opensAppToForeground },
        })),
      );
    },
    setBadgeCount: async (count) => {
      await Notifications.setBadgeCountAsync(count);
    },
  };
}
