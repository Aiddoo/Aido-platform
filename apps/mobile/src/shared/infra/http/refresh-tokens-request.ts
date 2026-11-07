import { ENV } from '@src/shared/config/env';
import ky from 'ky';

import { type AppHeaderSource, createAppHeaders, setPerRequestHeaders } from './request-headers';
import type { RefreshTokensRequest } from './token-refresher';

/**
 * 서버의 토큰 재사용 grace(10초)보다 짧게 잡는다.
 *
 * 회전은 성공했는데 응답이 유실된 경우, 다음 재시도가 grace 창을 넘기면 서버가
 * 재사용 공격으로 판정해 토큰 패밀리를 폐기한다(SESSION_0704 → 강제 로그아웃).
 */
const REFRESH_TIMEOUT_MS = 8_000;

/**
 * `TokenRefresher`가 요구하는 HTTP 포트의 ky 구현. 벤더 의존은 이 파일에만 있다.
 * 갱신 요청도 일반 요청과 같은 앱·기기·시간대·언어·요청 ID 헤더를 보낸다.
 */
export function createRefreshTokensRequest(source: AppHeaderSource): RefreshTokensRequest {
  return (refreshToken) => {
    const headers = new Headers({
      ...createAppHeaders(source),
      Authorization: `Bearer ${refreshToken}`,
      'Content-Type': 'application/json',
    });
    setPerRequestHeaders(headers);
    return ky.post('v1/auth/refresh', {
      // v2: prefixUrl → prefix (append 시맨틱 동일)
      prefix: ENV.API_URL,
      retry: 0,
      timeout: REFRESH_TIMEOUT_MS,
      throwHttpErrors: false,
      headers,
    });
  };
}
