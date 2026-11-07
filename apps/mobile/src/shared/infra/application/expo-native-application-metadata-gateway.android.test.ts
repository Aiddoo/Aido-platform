import Constants, { ExecutionEnvironment } from 'expo-constants';

import { expoNativeApplicationMetadataGateway } from './expo-native-application-metadata-gateway';

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.10.0',
  nativeBuildVersion: '123',
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
    Object.defineProperty(Constants, 'executionEnvironment', {
      configurable: true,
      value: ExecutionEnvironment.Standalone,
    });
    expect(expoNativeApplicationMetadataGateway.getInstallation()).toEqual({
      platform: 'android',
      currentVersion: '1.10.0',
      currentBuild: '123',
    });
  });
});
