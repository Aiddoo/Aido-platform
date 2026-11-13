import type { RefreshTokensRequest } from '@src/core/ports/token-refresher';
import { ENV } from '@src/shared/config/env';
import ky from 'ky';

import { type AppHeaderSource, createAppHeaders, setPerRequestHeaders } from './request-headers';
import { REFRESH_TIMEOUT_MS } from './request-timeout';

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
