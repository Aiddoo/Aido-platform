import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { expoApplicationMetadataGateway } from './expo-application-metadata.gateway';

let mockNativeApplicationVersion: string | null = '1.10.0';

jest.mock('expo-application', () => ({
  get nativeApplicationVersion() {
    return mockNativeApplicationVersion;
  },
}));

describe('expoApplicationMetadataGateway', () => {
  const originalEnvironment = Constants.executionEnvironment;
  const originalExpoVersion = Constants.expoVersion;
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    mockNativeApplicationVersion = '1.10.0';
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    Object.defineProperty(Constants, 'executionEnvironment', {
      configurable: true,
      value: ExecutionEnvironment.Bare,
    });
    Object.defineProperty(Constants, 'expoVersion', { configurable: true, value: undefined });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    Object.defineProperty(Constants, 'executionEnvironment', {
      configurable: true,
      value: originalEnvironment,
    });
    Object.defineProperty(Constants, 'expoVersion', {
      configurable: true,
      value: originalExpoVersion,
    });
  });

  it('Expo Go의 호스트 앱 버전은 설치된 서비스 앱 버전으로 표시하지 않는다', () => {
    Object.defineProperty(Constants, 'executionEnvironment', {
      configurable: true,
      value: ExecutionEnvironment.StoreClient,
    });
    expect(expoApplicationMetadataGateway.getInstallation()).toBeUndefined();
  });

  it('expoVersion이 없는 SDK58 개발 빌드의 네이티브 버전을 읽는다', () => {
    expect(expoApplicationMetadataGateway.getInstallation()).toEqual({
      platform: 'ios',
      currentVersion: '1.10.0',
    });
  });

  it('standalone Android 빌드의 네이티브 버전을 읽는다', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    Object.defineProperty(Constants, 'executionEnvironment', {
      configurable: true,
      value: ExecutionEnvironment.Standalone,
    });
    expect(expoApplicationMetadataGateway.getInstallation()).toEqual({
      platform: 'android',
      currentVersion: '1.10.0',
    });
  });

  it('설치 버전을 알 수 없을 때 package 또는 OTA 버전으로 대체하지 않는다', () => {
    mockNativeApplicationVersion = null;
    expect(expoApplicationMetadataGateway.getInstallation()).toEqual({
      platform: 'ios',
      currentVersion: undefined,
    });
  });

  it('웹에서는 네이티브 설치 정보를 제공하지 않는다', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    expect(expoApplicationMetadataGateway.getInstallation()).toBeUndefined();
  });
});
