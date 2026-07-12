import type { Analytics } from '@src/core/ports/analytics';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { Logger } from '@src/core/ports/logger';
import { ENV } from '@src/shared/config/env';

import { createConsoleAnalytics, createFirebaseAnalytics } from './analytics';
import { createConsoleErrorReporter, createSentryErrorReporter } from './error-reporter';

/**
 * 환경별 관측 구현 선택의 단일 소스 — 프로덕션 = Firebase/Sentry, 그 외 = console.
 * DIProvider(앱 트리)와 위젯 headless 컨텍스트가 같은 규칙을 공유해 드리프트를 막는다.
 */
export function createEnvironmentAnalytics(logger: Logger): Analytics {
  return ENV.IS_PRODUCTION ? createFirebaseAnalytics(logger) : createConsoleAnalytics();
}

export function createEnvironmentErrorReporter(): ErrorReporter {
  return ENV.IS_PRODUCTION ? createSentryErrorReporter() : createConsoleErrorReporter();
}
