import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { ENV } from '@src/shared/config/env';
import ky, { type KyInstance } from 'ky';

import { createPublicApiFailureBreadcrumbHook } from './api-failure-breadcrumb';
import { type AppHeaderSource, applyPerRequestHeaders, createAppHeaders } from './request-headers';
import { API_REQUEST_TIMEOUT_MS } from './request-timeout';

interface PublicClientPorts extends AppHeaderSource {
  errorReporter: Pick<ErrorReporter, 'addBreadcrumb'>;
}

export function createPublicClient({
  appVersion,
  appBuild,
  errorReporter,
}: PublicClientPorts): KyInstance {
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
      afterResponse: [createPublicApiFailureBreadcrumbHook(errorReporter)],
    },
  });
}
