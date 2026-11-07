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

describe('isOutdated', () => {
  it.each([
    ['1.9.0', '1.9.1', true],
    ['1.9.1', '1.9.1', false],
    ['1.10.0', '1.9.9', false],
  ])('현재 %s, 스토어 최신 %s이면 %s를 반환한다', (currentVersion, latestVersion, expected) => {
    // Given
    const input = createInput(currentVersion, latestVersion);

    // When
    const result = AppVersionPolicy.isOutdated(input);

    // Then
    expect(result).toBe(expected);
  });

  it('두 번째 자리를 숫자로 비교해 1.10.0을 1.9.9보다 새 버전으로 본다', () => {
    // Given
    const input = createInput('1.9.9', '1.10.0');

    // When
    const result = AppVersionPolicy.isOutdated(input);

    // Then
    expect(result).toBe(true);
  });
});

describe('isUpToDate', () => {
  it.each([
    ['1.9.0', '1.9.1', false],
    ['1.9.1', '1.9.1', true],
    ['1.10.0', '1.9.9', true],
  ])('현재 %s, 스토어 최신 %s이면 %s를 반환한다', (currentVersion, latestVersion, expected) => {
    // Given
    const input = createInput(currentVersion, latestVersion);

    // When
    const result = AppVersionPolicy.isUpToDate(input);

    // Then
    expect(result).toBe(expected);
  });
});

describe('canCompareVersions', () => {
  it('점검이 켜져 있고 두 버전이 올바르면 true를 반환한다', () => {
    // Given
    const input = createInput('1.9.0', '1.9.1');

    // When
    const result = AppVersionPolicy.canCompareVersions(input);

    // Then
    expect(result).toBe(true);
  });

  describe.each([
    ['지원하지 않는 플랫폼이면', { ...createInput('1.9.0', '1.9.1'), platform: 'web' }],
    ['현재 버전이 x.y.z 모양이 아니면', createInput('1.9', '1.9.1')],
    [
      '점검이 꺼져 있으면',
      { ...createInput('1.9.0', '1.9.1'), config: { enabled: false } as const },
    ],
  ])('%s', (_reason, input) => {
    it('어떤 안내도 하지 않도록 모두 false를 반환한다', () => {
      // When
      const results = [
        AppVersionPolicy.canCompareVersions(input),
        AppVersionPolicy.isOutdated(input),
        AppVersionPolicy.isUpToDate(input),
      ];

      // Then
      expect(results).toEqual([false, false, false]);
    });
  });
});
