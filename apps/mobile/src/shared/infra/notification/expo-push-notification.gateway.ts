import type {
  IosPushAuthorizationStatus,
  PushNotificationGateway,
  PushPermissionResponse,
} from '@src/core/ports/push-notification-gateway';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

const DEFAULT_CHANNEL_ID = 'default';

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
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
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
  setBadgeCount: async (count) => {
    await Notifications.setBadgeCountAsync(count);
  },
  openSettings: () => Linking.openSettings(),
};
