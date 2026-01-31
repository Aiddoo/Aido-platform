import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  NotificationNotPhysicalDeviceError,
  NotificationPermissionDeniedError,
} from '../models/notification.error';

export class PushTokenService {
  isPhysicalDevice = (): boolean => Device.isDevice;

  requestPermission = async (): Promise<boolean> => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus === 'granted') {
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync();

    return status === 'granted';
  };

  getExpoPushToken = async (): Promise<string> => {
    if (!this.isPhysicalDevice()) {
      throw new NotificationNotPhysicalDeviceError();
    }

    const isGranted = await this.requestPermission();
    if (!isGranted) {
      throw new NotificationPermissionDeniedError();
    }

    if (Platform.OS === 'android') {
      await this._setupAndroidChannel();
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

    if (__DEV__) {
      console.log('[PushToken]', tokenData.data);
    }

    return tokenData.data;
  };

  private _setupAndroidChannel = async (): Promise<void> => {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  };
}
