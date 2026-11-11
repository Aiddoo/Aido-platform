import type { ErrorReporter } from '@src/core/ports/error-reporter';

/** 오류 보고를 확인하지 않는 화면 테스트용. LocalDateProvider처럼 보고만 하는 provider를 띄울 때 넣는다 */
export function createErrorReporterStub(): jest.Mocked<ErrorReporter> {
  return {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setUserId: jest.fn(),
  };
}
