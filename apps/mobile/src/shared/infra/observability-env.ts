import type { Analytics } from '@src/core/ports/analytics';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { Logger } from '@src/core/ports/logger';
import { ENV } from '@src/shared/config/env';

import {
  createConsoleAnalytics,
  createFirebaseAnalytics,
  markFirebaseTrafficAsInternal,
} from './analytics';
import { createConsoleErrorReporter, createSentryErrorReporter } from './error-reporter';

/**
 * 환경별 관측 구현 선택의 단일 소스 — 프로덕션 = Firebase/Sentry, 그 외 = console.
 * DIProvider(앱 트리)와 위젯 headless 컨텍스트가 같은 규칙을 공유해 드리프트를 막는다.
 */
export function createEnvironmentAnalytics(logger: Logger): Analytics {
  if (ENV.IS_PRODUCTION) {
    return createFirebaseAnalytics(logger);
  }
  // JS 이벤트는 콘솔로만 남기고, 네이티브 자동 수집 이벤트는 내부 트래픽으로 표시해 운영 지표에서 뺀다
  markFirebaseTrafficAsInternal(logger);
  return createConsoleAnalytics();
}

export function createEnvironmentErrorReporter(): ErrorReporter {
  return ENV.IS_PRODUCTION ? createSentryErrorReporter() : createConsoleErrorReporter();
}
