import { resolveRevenueCatApiKey } from './revenuecat-api-key';

describe('RevenueCat API 키 선택', () => {
  const keys = {
    appleApiKey: 'appl_fixture',
    googleApiKey: 'goog_fixture',
    testApiKey: 'test_fixture',
  };

  it('개발 환경의 Debug 빌드에서는 테스트 키로 결제를 검증한다', () => {
    // Given
    const context = {
      ...keys,
      isDebugBuild: true,
      isDevelopmentEnvironment: true,
      platform: 'ios',
    };

    // When
    const apiKey = resolveRevenueCatApiKey(context);

    // Then
    expect(apiKey).toBe('test_fixture');
  });

  it.each([
    ['ios', 'appl_fixture'],
    ['android', 'goog_fixture'],
  ])('개발 서버에 연결한 %s Release 빌드도 플랫폼 키를 사용한다', (platform, expectedKey) => {
    // Given
    const context = {
      ...keys,
      isDebugBuild: false,
      isDevelopmentEnvironment: true,
      platform,
    };

    // When
    const apiKey = resolveRevenueCatApiKey(context);

    // Then
    expect(apiKey).toBe(expectedKey);
  });

  it('프로덕션 환경을 실행하는 Debug 빌드에도 Apple 플랫폼 키를 사용한다', () => {
    // Given
    const context = {
      ...keys,
      isDebugBuild: true,
      isDevelopmentEnvironment: false,
      platform: 'ios',
    };

    // When
    const apiKey = resolveRevenueCatApiKey(context);

    // Then
    expect(apiKey).toBe('appl_fixture');
  });

  it('플랫폼 키가 없으면 Release 빌드에서 테스트 키로 대체하지 않는다', () => {
    // Given
    const context = {
      testApiKey: 'test_fixture',
      isDebugBuild: false,
      isDevelopmentEnvironment: true,
      platform: 'android',
    };

    // When
    const apiKey = resolveRevenueCatApiKey(context);

    // Then
    expect(apiKey).toBeUndefined();
  });

  it('잘못 등록된 테스트 키를 네이티브 Release SDK로 전달하지 않는다', () => {
    // Given
    const context = {
      ...keys,
      appleApiKey: 'test_misconfigured',
      isDebugBuild: false,
      isDevelopmentEnvironment: false,
      platform: 'ios',
    };

    // When
    const apiKey = resolveRevenueCatApiKey(context);

    // Then
    expect(apiKey).toBeUndefined();
  });

  it('지원하지 않는 플랫폼에는 네이티브 결제 키를 전달하지 않는다', () => {
    // Given
    const context = {
      ...keys,
      isDebugBuild: false,
      isDevelopmentEnvironment: false,
      platform: 'web',
    };

    // When
    const apiKey = resolveRevenueCatApiKey(context);

    // Then
    expect(apiKey).toBeUndefined();
  });
});
