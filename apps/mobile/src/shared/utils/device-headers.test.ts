import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { getDeviceHeaders } from './device-headers';

jest.mock('expo-device', () => ({ modelName: 'iPhone 15 Pro' }));

const setModelName = (value: string | null) => {
  Object.defineProperty(Device, 'modelName', { value, configurable: true });
};

describe('getDeviceHeaders', () => {
  afterEach(() => {
    Platform.OS = 'ios';
    setModelName('iPhone 15 Pro');
  });

  it('iOS 플랫폼과 모델명을 반환한다', () => {
    Platform.OS = 'ios';

    expect(getDeviceHeaders()).toEqual({
      'X-Device-Type': 'IOS',
      'X-Device-Name': 'iPhone 15 Pro',
    });
  });

  it('Android 플랫폼을 반환한다', () => {
    Platform.OS = 'android';
    setModelName('Galaxy S24');

    expect(getDeviceHeaders()).toEqual({
      'X-Device-Type': 'ANDROID',
      'X-Device-Name': 'Galaxy S24',
    });
  });

  it('웹 플랫폼은 WEB으로 구분한다', () => {
    Platform.OS = 'web';

    expect(getDeviceHeaders()).toEqual({
      'X-Device-Type': 'WEB',
      'X-Device-Name': 'iPhone 15 Pro',
    });
  });

  it('모델명은 40자로 자른다', () => {
    setModelName('a'.repeat(60));

    expect(getDeviceHeaders()).toEqual({
      'X-Device-Type': 'IOS',
      'X-Device-Name': 'a'.repeat(40),
    });
  });

  it('모델명이 없으면 플랫폼만 반환한다', () => {
    setModelName(null);

    expect(getDeviceHeaders()).toEqual({ 'X-Device-Type': 'IOS' });
  });

  it('ASCII가 아닌 모델명은 헤더에서 제외한다', () => {
    setModelName('갤럭시 S24');

    expect(getDeviceHeaders()).toEqual({ 'X-Device-Type': 'IOS' });
  });
});
