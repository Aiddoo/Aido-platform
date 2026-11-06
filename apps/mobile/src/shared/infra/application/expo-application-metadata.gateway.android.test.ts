import Constants, { ExecutionEnvironment } from 'expo-constants';

import { expoApplicationMetadataGateway } from './expo-application-metadata.gateway';

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.10.0',
  nativeBuildVersion: '123',
}));

describe('expoApplicationMetadataGateway (Android)', () => {
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
    expect(expoApplicationMetadataGateway.getInstallation()).toEqual({
      platform: 'android',
      currentVersion: '1.10.0',
      currentBuild: '123',
    });
  });
});
