import * as Device from 'expo-device';
import { Platform } from 'react-native';

export const IS_IOS_APP_ON_MAC =
  process.env.EXPO_OS === 'ios' && Device.deviceType === Device.DeviceType.DESKTOP;

/** iPhone Duo는 휴대폰이라 들지 않는다 */
export const IS_IPAD =
  process.env.EXPO_OS === 'ios' && Device.deviceType === Device.DeviceType.TABLET;

export const DEVICE_MODEL_NAME = Device.modelName;

export const IS_PHYSICAL_DEVICE = Device.isDevice;

/** 알 수 없으면 null */
export const DEVICE_TOTAL_MEMORY_BYTES = Device.totalMemory;

/** Android API 레벨. Android가 아니면 null */
export const ANDROID_API_LEVEL =
  process.env.EXPO_OS === 'android' && typeof Platform.Version === 'number'
    ? Platform.Version
    : null;

/** iOS 주 버전. iOS가 아니면 null */
export const IOS_MAJOR_VERSION =
  process.env.EXPO_OS === 'ios' ? Number.parseInt(String(Platform.Version), 10) : null;
