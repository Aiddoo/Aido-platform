import Constants from 'expo-constants';

const DEFAULT_APP_SCHEME = 'aido';

/** 위젯 렌더 경로는 env.ts를 거치지 않으므로 expo-constants만 읽는다 */
export function getAppScheme(): string {
  const scheme = Constants.expoConfig?.scheme;
  return Array.isArray(scheme) ? (scheme[0] ?? DEFAULT_APP_SCHEME) : (scheme ?? DEFAULT_APP_SCHEME);
}
