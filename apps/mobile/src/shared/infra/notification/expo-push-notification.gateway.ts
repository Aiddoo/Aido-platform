import type {
  IosPushAuthorizationStatus,
  PushNotificationGateway,
  PushNotificationResponse,
  PushPermissionResponse,
} from '@src/core/ports/push-notification-gateway';
import { withTimeout } from 'es-toolkit';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

const DEFAULT_CHANNEL_ID = 'default';

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

export const expoPushNotificationGateway: PushNotificationGateway = {
  getPermission: async () => toPushPermissionResponse(await Notifications.getPermissionsAsync()),
  requestPermission: async () =>
    toPushPermissionResponse(await Notifications.requestPermissionsAsync()),
  ensureChannel: async () => {
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: DEFAULT_CHANNEL_ID,
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  },
  getToken: async () => {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = await withTimeout(
      () => Notifications.getExpoPushTokenAsync({ projectId }),
      PUSH_TOKEN_ISSUE_TIMEOUT_MS,
    );
    return token.data;
  },
  addTokenListener: (listener) => {
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
  addReceivedListener: (listener) => {
    const subscription = Notifications.addNotificationReceivedListener((notification) =>
      listener({ data: notification.request.content.data ?? {} }),
    );
    return () => subscription.remove();
  },
  addResponseListener: (listener) => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      listener(toPushNotificationResponse(response)),
    );
    return () => subscription.remove();
  },
  addResponseClearedListener: (listener) => {
    const subscription = Notifications.addNotificationResponseClearedListener(listener);
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
  openSettings: () => Linking.openSettings(),
};
