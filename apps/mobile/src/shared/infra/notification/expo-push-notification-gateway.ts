import type { AppLogger } from '@src/core/ports/app-logger';
import type {
  ForegroundPushPresentation,
  IosPushAuthorizationStatus,
  PushNotificationGateway,
  PushNotificationResponse,
  PushPermissionResponse,
  ReceivedPushNotification,
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

// 앱 아이콘 배지는 안 읽은 수 조회 하나가 맞추므로 알림의 badge 값을 쓰지 않는다
const FOREGROUND_BEHAVIOR = {
  banner: {
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  },
  quiet: {
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  },
} as const satisfies Record<ForegroundPushPresentation, Notifications.NotificationBehavior>;

function presentAsBanner(): ForegroundPushPresentation {
  return 'banner';
}

let decideForegroundPresentation: (
  notification: ReceivedPushNotification,
) => ForegroundPushPresentation = presentAsBanner;

/** 첫 알림을 놓치지 않게 앱이 그려지기 전에 부른다. 화면이 정하기 전과 판단이 실패하면 배너로 보인다 */
export function registerForegroundNotificationPresentation() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      try {
        return FOREGROUND_BEHAVIOR[
          decideForegroundPresentation({ data: notification.request.content.data ?? {} })
        ];
      } catch {
        return FOREGROUND_BEHAVIOR.banner;
      }
    },
  });
}

/** Android 13+는 채널이 있어야 권한 창과 토큰 발급이 동작한다. 못 만들어도 권한 상태는 읽으므로 실패는 기록만 한다 */
async function ensureChannel(logger: AppLogger): Promise<void> {
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

export function createExpoPushNotificationGateway(logger: AppLogger): PushNotificationGateway {
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
      // getExpoPushTokenAsync도 같은 이벤트를 다시 보내므로 값이 바뀔 때만 알린다(보고 → 발급 → 이벤트 무한 루프 방지)
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
    setForegroundPresentation: (decide) => {
      decideForegroundPresentation = decide;
      return () => {
        if (decideForegroundPresentation === decide) {
          decideForegroundPresentation = presentAsBanner;
        }
      };
    },
  };
}
