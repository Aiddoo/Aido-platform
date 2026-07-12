import type { Analytics } from '@src/core/ports/analytics';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { ENV } from '@src/shared/config/env';
import { createConsoleAnalytics, createFirebaseAnalytics } from '@src/shared/infra/analytics';
import {
  createConsoleErrorReporter,
  createSentryErrorReporter,
} from '@src/shared/infra/error-reporter';
import { createConsoleLogger } from '@src/shared/infra/logger';

let cachedAnalytics: Analytics | null = null;
let cachedErrorReporter: ErrorReporter | null = null;

/**
 * headless(task handler) 전용 관측 도구 — DI 트리 밖에서 실행되므로 직접 조립한다.
 * DIProvider와 동일 규칙: 프로덕션 = Firebase/Sentry, 그 외 = console.
 * Sentry는 init 전 capture 호출을 안전하게 드롭하므로 headless 선실행에도 안전하다.
 */
export function getWidgetAnalytics(): Analytics {
  if (cachedAnalytics === null) {
    cachedAnalytics = ENV.IS_PRODUCTION
      ? createFirebaseAnalytics(createConsoleLogger({ minLevel: 'warn' }))
      : createConsoleAnalytics();
  }
  return cachedAnalytics;
}

export function getWidgetErrorReporter(): ErrorReporter {
  if (cachedErrorReporter === null) {
    cachedErrorReporter = ENV.IS_PRODUCTION
      ? createSentryErrorReporter()
      : createConsoleErrorReporter();
  }
  return cachedErrorReporter;
}
