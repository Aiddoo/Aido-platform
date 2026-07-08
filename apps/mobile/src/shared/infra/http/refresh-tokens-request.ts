import { ENV } from '@src/shared/config/env';
import ky from 'ky';
import type { RefreshTokensRequest } from './token-refresher';

/**
 * 서버의 토큰 재사용 grace(10초)보다 짧게 잡는다.
 *
 * 회전은 성공했는데 응답이 유실된 경우, 다음 재시도가 grace 창을 넘기면 서버가
 * 재사용 공격으로 판정해 토큰 패밀리를 폐기한다(SESSION_0704 → 강제 로그아웃).
 */
const REFRESH_TIMEOUT_MS = 8_000;

/** `TokenRefresher`가 요구하는 HTTP 포트의 ky 구현. 벤더 의존은 이 파일에만 있다. */
export const requestRefreshTokens: RefreshTokensRequest = (refreshToken) =>
  ky.post('v1/auth/refresh', {
    prefixUrl: ENV.API_URL,
    retry: 0,
    timeout: REFRESH_TIMEOUT_MS,
    throwHttpErrors: false,
    headers: {
      Authorization: `Bearer ${refreshToken}`,
      'Content-Type': 'application/json',
    },
  });
