import { toSentryEnvironment } from './sentry-environment';

describe('toSentryEnvironment', () => {
  it.each(['development', 'preview', 'production'] as const)(
    '실기기의 %s 빌드는 앱 환경 그대로 보낸다',
    (appEnv) => {
      // When
      const environment = toSentryEnvironment(appEnv, true);

      // Then
      expect(environment).toBe(appEnv);
    },
  );

  it('에뮬레이터의 운영 빌드는 운영 알림에 걸리지 않게 환경을 나눈다', () => {
    // When
    const environment = toSentryEnvironment('production', false);

    // Then
    expect(environment).toBe('production-emulator');
  });
});
