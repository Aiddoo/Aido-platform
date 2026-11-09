import * as Device from 'expo-device';

import { getDeviceHeaders } from './device-headers';

jest.mock('expo-device', () => ({ modelName: 'iPhone 15 Pro', osVersion: null }));

const setModelName = (value: string | null) => {
  jest.replaceProperty(Device, 'modelName', value);
};

const setOsVersion = (value: string | null) => {
  jest.replaceProperty(Device, 'osVersion', value);
};

describe('getDeviceHeaders', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('iOS 플랫폼과 모델명을 반환한다', () => {
    // When
    const headers = getDeviceHeaders();

    // Then
    expect(headers).toEqual({
      'X-Device-Type': 'IOS',
      'X-Device-Name': 'iPhone 15 Pro',
    });
  });

  it('Android 플랫폼을 반환한다', () => {
    // Given
    setModelName('Galaxy S24');

    // When
    const headers = getDeviceHeaders('android');

    // Then
    expect(headers).toEqual({
      'X-Device-Type': 'ANDROID',
      'X-Device-Name': 'Galaxy S24',
    });
  });

  it('모델명은 40자로 자른다', () => {
    // Given
    setModelName('a'.repeat(60));

    // When
    const headers = getDeviceHeaders();

    // Then
    expect(headers).toEqual({
      'X-Device-Type': 'IOS',
      'X-Device-Name': 'a'.repeat(40),
    });
  });

  it('모델명이 없으면 플랫폼만 반환한다', () => {
    // Given
    setModelName(null);

    // When
    const headers = getDeviceHeaders();

    // Then
    expect(headers).toEqual({ 'X-Device-Type': 'IOS' });
  });

  it('ASCII가 아닌 모델명은 헤더에서 제외한다', () => {
    // Given
    setModelName('갤럭시 S24');

    // When
    const headers = getDeviceHeaders();

    // Then
    expect(headers).toEqual({ 'X-Device-Type': 'IOS' });
  });

  it('OS 버전을 함께 보낸다', () => {
    // Given
    setModelName('Pixel 9');
    setOsVersion('15');

    // When
    const headers = getDeviceHeaders('android');

    // Then
    expect(headers).toEqual({
      'X-Device-Type': 'ANDROID',
      'X-Device-Name': 'Pixel 9',
      'X-OS-Version': '15',
    });
  });

  it('형식에 맞지 않는 OS 버전은 헤더에서 제외한다', () => {
    // Given
    setOsVersion('18.1 beta (22B5034e)');

    // When
    const headers = getDeviceHeaders();

    // Then
    expect(headers).toEqual({ 'X-Device-Type': 'IOS', 'X-Device-Name': 'iPhone 15 Pro' });
  });
});
