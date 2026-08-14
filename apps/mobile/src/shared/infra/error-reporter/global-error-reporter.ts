import type { ErrorReporter } from '@src/core/ports/error-reporter';

import { createConsoleErrorReporter } from './console-error-reporter';

/**
 * 전역 ErrorReporter 접근자(`global-logger`와 동일 패턴).
 *
 * DI 컨테이너 밖(HTTP 훅, 화면 추적 등 인프라 계층)에서 포트 구현을 참조하기 위한 싱글턴.
 * 부팅 시 `di-provider`가 `setGlobalErrorReporter`로 실제 구현(Sentry/Console)을 주입한다.
 */
const fallback = createConsoleErrorReporter();
let instance: ErrorReporter = fallback;

export const setGlobalErrorReporter = (reporter: ErrorReporter): void => {
  instance = reporter;
};

export const errorReporter: ErrorReporter = {
  captureException: (...args) => instance.captureException(...args),
  captureMessage: (...args) => instance.captureMessage(...args),
  addBreadcrumb: (...args) => instance.addBreadcrumb(...args),
  setUserId: (...args) => instance.setUserId(...args),
};
