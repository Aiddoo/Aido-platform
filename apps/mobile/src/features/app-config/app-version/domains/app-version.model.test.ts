import { type AppVersionConfig, AppVersionPolicy } from './app-version.model';

function createConfig(latestVersion: string): AppVersionConfig {
  return { enabled: true, latestByPlatform: { ios: latestVersion, android: latestVersion } };
}

describe('AppVersionPolicy', () => {
  describe('getUpdateStatus', () => {
    it.each([
      ['1.9.0', '1.9.1', 'outdated'],
      ['1.9.9', '1.10.0', 'outdated'],
      ['1.9.1', '1.9.1', 'up-to-date'],
      ['1.10.0', '1.9.9', 'up-to-date'],
    ])('현재 %s, 스토어 최신 %s이면 %s를 반환한다', (currentVersion, latestVersion, expected) => {
      // Given
      const config = createConfig(latestVersion);

      // When
      const result = AppVersionPolicy.getUpdateStatus(config, { platform: 'ios', currentVersion });

      // Then
      expect(result).toBe(expected);
    });

    it('안드로이드는 안드로이드 최신 버전과 비교한다', () => {
      // Given
      const config: AppVersionConfig = {
        enabled: true,
        latestByPlatform: { ios: '1.9.0', android: '1.9.1' },
      };

      // When
      const result = AppVersionPolicy.getUpdateStatus(config, {
        platform: 'android',
        currentVersion: '1.9.0',
      });

      // Then
      expect(result).toBe('outdated');
    });

    describe.each([
      [
        '지원하지 않는 플랫폼이면',
        createConfig('1.9.1'),
        { platform: 'web', currentVersion: '1.9.0' },
      ],
      [
        '현재 버전이 x.y.z 모양이 아니면',
        createConfig('1.9.1'),
        { platform: 'ios', currentVersion: '1.9' },
      ],
      [
        '점검이 꺼져 있으면',
        { enabled: false } as const,
        { platform: 'ios', currentVersion: '1.9.0' },
      ],
    ])('%s', (_reason, config, installation) => {
      it('어떤 안내도 하지 않도록 unknown을 반환한다', () => {
        // When
        const result = AppVersionPolicy.getUpdateStatus(config, installation);

        // Then
        expect(result).toBe('unknown');
      });
    });
  });
});
