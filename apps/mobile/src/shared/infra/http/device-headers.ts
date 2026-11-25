import { DEVICE_NAME_MAX_LENGTH, type DeviceType, OS_VERSION_PATTERN } from '@aido/api/vocabulary';
import * as Device from 'expo-device';

const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

function getDeviceType(os: typeof process.env.EXPO_OS): Exclude<DeviceType, 'WEB'> {
  return os === 'ios' ? 'IOS' : 'ANDROID';
}

/** 헤더 값은 ASCII만 허용되므로 모델명이 그렇지 않으면 생략하고 서버 표시 한도로 자른다. 기기 식별자는 보내지 않는다 */
export function getDeviceHeaders(os = process.env.EXPO_OS): Record<string, string> {
  const modelName = Device.modelName?.trim().slice(0, DEVICE_NAME_MAX_LENGTH).trim();
  const osVersion = Device.osVersion?.trim();

  return {
    'X-Device-Type': getDeviceType(os),
    ...(modelName && PRINTABLE_ASCII.test(modelName) && { 'X-Device-Name': modelName }),
    ...(osVersion && OS_VERSION_PATTERN.test(osVersion) && { 'X-OS-Version': osVersion }),
  };
}
