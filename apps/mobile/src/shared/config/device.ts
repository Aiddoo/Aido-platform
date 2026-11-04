import * as Device from 'expo-device';
import { Platform } from 'react-native';

export const IS_IOS_APP_ON_MAC =
  Platform.OS === 'ios' && Device.deviceType === Device.DeviceType.DESKTOP;

/** 운영 알림에서 기기를 구분하는 이름. 알 수 없으면 null */
export const DEVICE_MODEL_NAME = Device.modelName;
