import Constants, { ExecutionEnvironment } from 'expo-constants';

import { expoNativeApplicationMetadataGateway } from './expo-native-application-metadata-gateway';

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.10.0',
  nativeBuildVersion: '123',
  applicationId: 'com.aido.mobile',
}));

describe('expoNativeApplicationMetadataGateway (Android)', () => {
  const originalEnvironment = Constants.executionEnvironment;

  afterEach(() => {
    Object.defineProperty(Constants, 'executionEnvironment', {
      configurable: true,
      value: originalEnvironment,
    });
  });

  it('standalone Android 빌드의 네이티브 버전을 읽는다', () => {
    // Given
    Object.defineProperty(Constants, 'executionEnvironment', {
      configurable: true,
      value: ExecutionEnvironment.Standalone,
    });

    // When
    const installation = expoNativeApplicationMetadataGateway.getInstallation();

    // Then
    expect(installation).toEqual({
      platform: 'android',
      currentVersion: '1.10.0',
      currentBuild: '123',
      applicationId: 'com.aido.mobile',
    });
  });
});
