import { AppVersionPolicy, type AppVersionPolicyInput } from './app-version.model';

function createInput(currentVersion: string, latestVersion: string): AppVersionPolicyInput {
  return {
    platform: 'ios',
    currentVersion,
    config: {
      enabled: true,
      latestByPlatform: { ios: latestVersion, android: latestVersion },
    },
  };
}

describe('getUpdateStatus', () => {
  it.each([
    ['1.9.0', '1.9.1', 'outdated'],
    ['1.9.9', '1.10.0', 'outdated'],
    ['1.9.1', '1.9.1', 'up-to-date'],
    ['1.10.0', '1.9.9', 'up-to-date'],
  ])('현재 %s, 스토어 최신 %s이면 %s를 반환한다', (currentVersion, latestVersion, expected) => {
    // Given
    const input = createInput(currentVersion, latestVersion);

    // When
    const result = AppVersionPolicy.getUpdateStatus(input);

    // Then
    expect(result).toBe(expected);
  });

  it('안드로이드는 안드로이드 최신 버전과 비교한다', () => {
    // Given
    const input: AppVersionPolicyInput = {
      ...createInput('1.9.0', '1.9.0'),
      platform: 'android',
      config: { enabled: true, latestByPlatform: { ios: '1.9.0', android: '1.9.1' } },
    };

    // When
    const result = AppVersionPolicy.getUpdateStatus(input);

    // Then
    expect(result).toBe('outdated');
  });

  describe.each([
    ['지원하지 않는 플랫폼이면', { ...createInput('1.9.0', '1.9.1'), platform: 'web' }],
    ['현재 버전이 x.y.z 모양이 아니면', createInput('1.9', '1.9.1')],
    [
      '점검이 꺼져 있으면',
      { ...createInput('1.9.0', '1.9.1'), config: { enabled: false } as const },
    ],
  ])('%s', (_reason, input) => {
    it('어떤 안내도 하지 않도록 unknown을 반환한다', () => {
      // When
      const result = AppVersionPolicy.getUpdateStatus(input);

      // Then
      expect(result).toBe('unknown');
    });
  });
});
