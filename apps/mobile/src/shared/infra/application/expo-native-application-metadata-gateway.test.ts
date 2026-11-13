import Constants, { ExecutionEnvironment } from 'expo-constants';

import { expoNativeApplicationMetadataGateway } from './expo-native-application-metadata-gateway';

let mockNativeApplicationVersion: string | null = '1.10.0';
let mockNativeBuildVersion: string | null = '123';

jest.mock('expo-application', () => ({
  get nativeApplicationVersion() {
    return mockNativeApplicationVersion;
  },
  get nativeBuildVersion() {
    return mockNativeBuildVersion;
  },
  applicationId: 'com.aido.mobile',
}));

describe('expoNativeApplicationMetadataGateway', () => {
  const originalEnvironment = Constants.executionEnvironment;
  const originalExpoVersion = Constants.expoVersion;

  beforeEach(() => {
    mockNativeApplicationVersion = '1.10.0';
    mockNativeBuildVersion = '123';
    Object.defineProperty(Constants, 'executionEnvironment', {
      configurable: true,
      value: ExecutionEnvironment.Bare,
    });
    Object.defineProperty(Constants, 'expoVersion', { configurable: true, value: undefined });
  });

  afterEach(() => {
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
    // Given
    Object.defineProperty(Constants, 'executionEnvironment', {
      configurable: true,
      value: ExecutionEnvironment.StoreClient,
    });

    // When
    const installation = expoNativeApplicationMetadataGateway.getInstallation();

    // Then
    expect(installation).toBeNull();
  });

  it('expoVersion이 없는 SDK58 개발 빌드의 네이티브 버전을 읽는다', () => {
    // When
    const installation = expoNativeApplicationMetadataGateway.getInstallation();

    // Then
    expect(installation).toEqual({
      platform: 'ios',
      currentVersion: '1.10.0',
      currentBuild: '123',
      applicationId: 'com.aido.mobile',
    });
  });

  it('설치 버전을 알 수 없을 때 package 또는 OTA 버전으로 대체하지 않는다', () => {
    // Given
    mockNativeApplicationVersion = null;
    mockNativeBuildVersion = null;

    // When
    const installation = expoNativeApplicationMetadataGateway.getInstallation();

    // Then
    expect(installation).toEqual({
      platform: 'ios',
      currentVersion: null,
      currentBuild: null,
      applicationId: 'com.aido.mobile',
    });
  });
});
