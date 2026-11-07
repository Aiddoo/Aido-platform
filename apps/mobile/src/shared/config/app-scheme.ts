import Constants from 'expo-constants';

const DEFAULT_APP_SCHEME = 'aido';

/** env.ts를 거치지 않는 위젯 렌더 경로에서도 같은 값을 쓰도록 expo-constants만 읽는다. */
export function getAppScheme(): string {
  const scheme = Constants.expoConfig?.scheme;
  return Array.isArray(scheme) ? (scheme[0] ?? DEFAULT_APP_SCHEME) : (scheme ?? DEFAULT_APP_SCHEME);
}
