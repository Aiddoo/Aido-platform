import * as Device from 'expo-device';
import { Platform } from 'react-native';

const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

/**
 * 가입 알림 등 서버가 기기를 식별하는 데 쓰는 요청 헤더.
 * 헤더 값은 ASCII만 허용되므로 모델명이 그렇지 않으면 생략한다.
 */
export const getDeviceHeaders = (): Record<string, string> => {
  const modelName = Device.modelName?.trim();

  return {
    'X-Device-Type': Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    ...(modelName && PRINTABLE_ASCII.test(modelName) && { 'X-Device-Name': modelName }),
  };
};
