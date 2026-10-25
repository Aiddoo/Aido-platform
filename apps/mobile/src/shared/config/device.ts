import * as Device from 'expo-device';
import { Platform } from 'react-native';

export const IS_IOS_APP_ON_MAC =
  Platform.OS === 'ios' && Device.deviceType === Device.DeviceType.DESKTOP;
