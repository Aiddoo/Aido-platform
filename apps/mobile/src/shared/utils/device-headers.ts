import * as Device from 'expo-device';
import { Platform } from 'react-native';

const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;
const MAX_MODEL_NAME_LENGTH = 40;

const getDeviceType = () => {
  if (Platform.OS === 'ios') {
    return 'IOS';
  }
  if (Platform.OS === 'web') {
    return 'WEB';
  }
  return 'ANDROID';
};

/**
 * 가입 알림 등 서버가 기기를 식별하는 데 쓰는 요청 헤더.
 * 헤더 값은 ASCII만 허용되므로 모델명이 그렇지 않으면 생략하고, 서버 표시 한도로 자른다.
 */
export const getDeviceHeaders = (): Record<string, string> => {
  const modelName = Device.modelName?.trim().slice(0, MAX_MODEL_NAME_LENGTH).trim();

  return {
    'X-Device-Type': getDeviceType(),
    ...(modelName && PRINTABLE_ASCII.test(modelName) && { 'X-Device-Name': modelName }),
  };
};
