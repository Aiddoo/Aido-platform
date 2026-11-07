import * as Device from 'expo-device';

export const IS_IOS_APP_ON_MAC =
  process.env.EXPO_OS === 'ios' && Device.deviceType === Device.DeviceType.DESKTOP;

export const DEVICE_MODEL_NAME = Device.modelName;

export const IS_PHYSICAL_DEVICE = Device.isDevice;

/** 알 수 없으면 null */
export const DEVICE_TOTAL_MEMORY_BYTES = Device.totalMemory;
