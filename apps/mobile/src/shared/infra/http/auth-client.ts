import type { AppLogger } from '@src/core/ports/app-logger';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { TokenRefresher } from '@src/core/ports/token-refresher';
import type { TokenStore } from '@src/core/ports/token-store';
import type { SessionEpoch } from '@src/core/session/session-epoch';
import { ENV } from '@src/shared/config/env';
import ky, { type KyInstance } from 'ky';

import { createApiFailureBreadcrumbHook } from './api-failure-breadcrumb';
import { createAppHeaders, setPerRequestHeaders } from './request-headers';
import { API_REQUEST_TIMEOUT_MS } from './request-timeout';
import { createTokenRefreshHook, type EndSession, markRequestEpoch } from './token-refresh-hook';

interface AuthClientDeps {
  appVersion?: string;
  appBuild?: string;
  tokenStore: TokenStore;
  /** 앱 전체 단일 인스턴스. 갈라지면 single-flight mutex가 분리돼 토큰 패밀리를 소모한다. */
  refresh: TokenRefresher;
  endSession: EndSession;
  sessionEpoch: SessionEpoch;
  logger: Pick<AppLogger, 'warn'>;
  errorReporter: Pick<ErrorReporter, 'addBreadcrumb' | 'captureMessage'>;
}

/** 토큰을 들고 있지 않고 매 요청 `TokenStore`에서 읽으므로 로그아웃 때 재생성할 상태가 없다 */
export function createAuthClient({
  appVersion,
  appBuild,
  tokenStore,
  refresh,
  endSession,
  sessionEpoch,
  logger,
  errorReporter,
}: AuthClientDeps): KyInstance {
  return ky.create({
    prefix: ENV.API_URL,
    timeout: API_REQUEST_TIMEOUT_MS,
    // 재시도 정책은 React Query가 소유한다(`shouldRetryQuery`). limit: 1은 401 갱신 훅의 강제 재시도(`ky.retry()`) 1회를 위한 것이다
    retry: { limit: 1, shouldRetry: () => false },
    headers: {
      'Content-Type': 'application/json',
      ...createAppHeaders({ appVersion, appBuild }),
    },
    hooks: {
      beforeRequest: [
        async ({ request, options }) => {
          // ky v2의 beforeRequest는 최초 1회만 실행돼, 401 갱신 뒤 새 토큰은 token-refresh-hook이 재시도 요청에 직접 넣는다
          setPerRequestHeaders(request.headers);

          // 토큰보다 먼저 읽는다. 사이에 세션이 끝나도 지난 세대로 표시되어 재시도를 막는다
          markRequestEpoch(options.context, sessionEpoch.current());

          const accessToken = await tokenStore.getAccessToken();
          if (accessToken) {
            request.headers.set('Authorization', `Bearer ${accessToken}`);
          }
        },
      ],
      afterResponse: [
        createApiFailureBreadcrumbHook(errorReporter),
        createTokenRefreshHook({
          tokenStore,
          refresh,
          endSession,
          sessionEpoch,
          logger,
          errorReporter,
        }),
      ],
    },
  });
}
