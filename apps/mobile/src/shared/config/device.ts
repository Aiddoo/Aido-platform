import * as Device from 'expo-device';

export const IS_IOS_APP_ON_MAC =
  process.env.EXPO_OS === 'ios' && Device.deviceType === Device.DeviceType.DESKTOP;

export const DEVICE_MODEL_NAME = Device.modelName;
