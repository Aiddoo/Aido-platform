import type { RefreshTokensRequest } from '@src/core/ports/token-refresher';
import { ENV } from '@src/shared/config/env';
import ky from 'ky';

import { type AppHeaderSource, createAppHeaders, setPerRequestHeaders } from './request-headers';

/** 서버 토큰 재사용 grace(10초)보다 짧게 잡는다. 응답이 유실되면 다음 재시도가 grace를 넘겨 재사용 공격으로 판정돼 토큰 패밀리가 폐기된다(SESSION_0704) */
const REFRESH_TIMEOUT_MS = 8_000;

export function createRefreshTokensRequest(source: AppHeaderSource): RefreshTokensRequest {
  return (refreshToken) => {
    const headers = new Headers({
      ...createAppHeaders(source),
      Authorization: `Bearer ${refreshToken}`,
      'Content-Type': 'application/json',
    });
    setPerRequestHeaders(headers);
    return ky.post('v1/auth/refresh', {
      prefix: ENV.API_URL,
      retry: 0,
      timeout: REFRESH_TIMEOUT_MS,
      throwHttpErrors: false,
      headers,
    });
  };
}
