import * as Device from 'expo-device';

const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;
const MAX_MODEL_NAME_LENGTH = 40;
const OS_VERSION = /^[0-9A-Za-z][0-9A-Za-z._-]{0,19}$/;

const getDeviceType = (os: typeof process.env.EXPO_OS) => (os === 'ios' ? 'IOS' : 'ANDROID');

/**
 * 가입 알림 등 서버가 기기를 식별하는 데 쓰는 요청 헤더. 기기 식별자는 보내지 않는다.
 * 헤더 값은 ASCII만 허용되므로 모델명이 그렇지 않으면 생략하고, 서버 표시 한도로 자른다.
 */
export const getDeviceHeaders = (os = process.env.EXPO_OS): Record<string, string> => {
  const modelName = Device.modelName?.trim().slice(0, MAX_MODEL_NAME_LENGTH).trim();
  const osVersion = Device.osVersion?.trim();

  return {
    'X-Device-Type': getDeviceType(os),
    ...(modelName && PRINTABLE_ASCII.test(modelName) && { 'X-Device-Name': modelName }),
    ...(osVersion && OS_VERSION.test(osVersion) && { 'X-OS-Version': osVersion }),
  };
};
