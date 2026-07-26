import { err, ok, type Result } from '@src/shared/errors/result';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { type NotificationError, NotificationErrors } from '../models/notification.error';

export class PushTokenService {
  isPhysicalDevice = (): boolean => Device.isDevice;

  requestPermission = async (requestIfUndetermined = true): Promise<boolean> => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus === 'granted') {
      return true;
    }

    if (existingStatus !== 'undetermined') {
      return false;
    }
    if (!requestIfUndetermined) {
      return false;
    }

    const { status } = await Notifications.requestPermissionsAsync();

    return status === 'granted';
  };

  getExpoPushToken = async (
    options: { requestPermission?: boolean } = {},
  ): Promise<Result<string, NotificationError>> => {
    if (!this.isPhysicalDevice()) {
      return err(NotificationErrors.notPhysicalDevice());
    }

    const isGranted = await this.requestPermission(options.requestPermission ?? true);
    if (!isGranted) {
      return err(NotificationErrors.permissionDenied());
    }

    if (Platform.OS === 'android') {
      await this.#setupAndroidChannel();
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

    return ok(tokenData.data);
  };

  async #setupAndroidChannel(): Promise<void> {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
}
