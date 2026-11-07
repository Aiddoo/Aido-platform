import type { Href } from 'expo-router';

type AppPath = Extract<Href, string>;

/**
 * 첫 화면이 스스로 받는 경로는 맡지 않는다. 초대는 인증 밖에서 열리고, 인증·로그인은 콜백과 화면이
 * 처리하며, 피드의 위젯 요청은 `useWidgetAppEntry`가 받는다.
 */
const SELF_HANDLED_SEGMENTS: ReadonlySet<string> = new Set([
  '',
  'auth',
  'login',
  'email-login',
  'sign-up',
  'forgot-password',
  'verify-email',
  'invite',
  'i',
  'loading',
  'feed',
  'expo-development-client',
]);

function isAppPath(path: string): path is AppPath {
  return path.startsWith('/');
}

/** `aido://weather/reschedule?a=1`과 `/weather/reschedule?a=1`을 앱 경로로 바꾼다. 다른 스킴과 웹 주소는 null이다 */
export function toColdStartAppPath(url: string, appScheme: string): AppPath | null {
  const schemePrefix = `${appScheme}://`;
  const rawPath = url.startsWith(schemePrefix) ? url.slice(schemePrefix.length) : url;
  if (rawPath.includes('://')) {
    return null;
  }

  const path = `/${rawPath.replace(/^\/+/, '')}`;
  const [firstSegment = ''] = path.slice(1).split(/[/?#]/, 1);
  if (SELF_HANDLED_SEGMENTS.has(firstSegment) || !isAppPath(path)) {
    return null;
  }
  return path;
}

/**
 * 콜드 스타트 때 인증 판정이 끝나기 전에는 보호된 route가 `/`로 돌려보내 처음 연 주소를 잃는다.
 * `+native-intent`는 Provider 밖에서 도니 DI로 받을 수 없어 첫 화면이 가져갈 때까지 여기 둔다.
 */
let pendingPath: AppPath | null = null;

export function rememberColdStartLink(url: string, appScheme: string): void {
  pendingPath = toColdStartAppPath(url, appScheme);
}

export function getColdStartPath(): AppPath | null {
  return pendingPath;
}

export function clearColdStartPath(): void {
  pendingPath = null;
}
