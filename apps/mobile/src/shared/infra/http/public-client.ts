import { ENV } from '@src/shared/config/env';
import ky, { type KyInstance } from 'ky';

import { recordPublicApiFailureBreadcrumb } from './error-handler';
import { type AppHeaderSource, applyPerRequestHeaders, createAppHeaders } from './request-headers';
import { API_REQUEST_TIMEOUT_MS } from './request-timeout';

/**
 * 토큰 없이 호출하는 공개 API용 HTTP 클라이언트
 * - 로그인, 회원가입 등 인증 전 요청에 사용
 */
export function createPublicClient({ appVersion, appBuild }: AppHeaderSource = {}): KyInstance {
  return ky.create({
    prefix: ENV.API_URL,
    timeout: API_REQUEST_TIMEOUT_MS,
    // 재시도 정책은 React Query가 소유한다(`shouldRetryQuery`) — auth-client와 동일.
    retry: 0,
    headers: {
      'Content-Type': 'application/json',
      ...createAppHeaders({ appVersion, appBuild }),
    },
    hooks: {
      beforeRequest: [applyPerRequestHeaders],
      afterResponse: [recordPublicApiFailureBreadcrumb],
    },
  });
}
