import { resolveAppEnvironment } from './app.config';

describe('resolveAppEnvironment', () => {
  it.each(['development', 'preview', 'production'])('APP_ENV %s는 그 환경이다', (appEnv) => {
    // When
    const environment = resolveAppEnvironment({ appEnv, nodeEnv: 'production' });
    // Then
    expect(environment).toBe(appEnv);
  });

  it.each<[string | undefined, string]>([
    ['test', 'development'],
    ['development', 'development'],
    [undefined, 'development'],
    ['production', 'production'],
  ])('APP_ENV가 없으면 NODE_ENV %s를 따라 %s다', (nodeEnv, expected) => {
    // When
    const environment = resolveAppEnvironment({ appEnv: undefined, nodeEnv });
    // Then
    expect(environment).toBe(expected);
  });

  it.each(['prod', 'Production', 'staging', ''])(
    '모르는 APP_ENV %p는 개발로 내려가지 않고 실패한다',
    (appEnv) => {
      // When
      const resolve = () => resolveAppEnvironment({ appEnv, nodeEnv: 'development' });
      // Then
      expect(resolve).toThrow('APP_ENV는 development·preview·production 중 하나입니다');
    },
  );

  it('APP_ENV가 없고 NODE_ENV도 모르는 값이면 실패한다', () => {
    // When
    const resolve = () => resolveAppEnvironment({ appEnv: undefined, nodeEnv: 'staging' });
    // Then
    expect(resolve).toThrow('NODE_ENV');
  });
});
