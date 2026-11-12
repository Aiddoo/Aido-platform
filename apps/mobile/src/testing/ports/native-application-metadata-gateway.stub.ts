import type {
  NativeApplicationMetadata,
  NativeApplicationMetadataGateway,
} from '@src/core/ports/native-application-metadata-gateway';

/** 최신 iOS 앱 설치를 기본으로 한다. 버전 비교를 보는 테스트가 값을 정한다 */
export function createNativeApplicationMetadataGatewayStub(
  installation: NativeApplicationMetadata | null = {
    platform: 'ios',
    currentVersion: '1.15.0',
    currentBuild: null,
    applicationId: null,
  },
): jest.Mocked<NativeApplicationMetadataGateway> {
  return {
    getInstallation: jest.fn(() => installation),
  };
}
