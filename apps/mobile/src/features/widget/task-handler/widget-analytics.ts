import type { Analytics } from '@src/core/ports/analytics';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { createConsoleLogger } from '@src/shared/infra/logger';
import {
  createEnvironmentAnalytics,
  createEnvironmentErrorReporter,
} from '@src/shared/infra/observability-env';

let cachedAnalytics: Analytics | null = null;
let cachedErrorReporter: ErrorReporter | null = null;

/**
 * headless(task handler) 전용 관측 도구 — DI 트리 밖에서 실행되므로 직접 조립한다.
 * 환경별 구현 선택은 DIProvider와 동일한 단일 팩토리(observability-env)를 공유한다.
 * Sentry는 init 전 capture 호출을 안전하게 드롭하므로 headless 선실행에도 안전하다.
 */
export function getWidgetAnalytics(): Analytics {
  if (cachedAnalytics === null) {
    cachedAnalytics = createEnvironmentAnalytics(createConsoleLogger({ minLevel: 'warn' }));
  }
  return cachedAnalytics;
}

export function getWidgetErrorReporter(): ErrorReporter {
  if (cachedErrorReporter === null) {
    cachedErrorReporter = createEnvironmentErrorReporter();
  }
  return cachedErrorReporter;
}
