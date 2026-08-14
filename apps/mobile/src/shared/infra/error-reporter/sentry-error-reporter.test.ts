import * as Sentry from '@sentry/react-native';
import type { Severity } from '@src/core/ports/severity';

import { createSentryErrorReporter } from './sentry-error-reporter';

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
}));

const captureException = Sentry.captureException as jest.Mock;
const captureMessage = Sentry.captureMessage as jest.Mock;
const addBreadcrumb = Sentry.addBreadcrumb as jest.Mock;
const setUser = Sentry.setUser as jest.Mock;

describe('createSentryErrorReporter', () => {
  beforeEach(() => {
    captureException.mockClear();
    captureMessage.mockClear();
    addBreadcrumb.mockClear();
    setUser.mockClear();
  });

  it('severity를 Sentry level로 매핑하고 나머지 context를 tags로 넘긴다', () => {
    // Given
    const reporter = createSentryErrorReporter();

    // When
    reporter.captureMessage('session_expired', {
      feature: 'auth',
      severity: 'warning',
      errorCode: 'refresh-rejected-401',
    });

    // Then
    expect(captureMessage).toHaveBeenCalledWith('session_expired', {
      level: 'warning',
      tags: { feature: 'auth', errorCode: 'refresh-rejected-401' },
    });
  });

  it('severity 미지정 시 captureException은 error, captureMessage는 info를 기본으로 한다', () => {
    // Given
    const reporter = createSentryErrorReporter();
    const error = new Error('boom');

    // When
    reporter.captureException(error, { feature: 'auth' });
    reporter.captureMessage('hello');

    // Then
    expect(captureException).toHaveBeenCalledWith(error, {
      level: 'error',
      tags: { feature: 'auth' },
    });
    expect(captureMessage).toHaveBeenCalledWith('hello', { level: 'info', tags: {} });
  });

  it('모든 Severity 값이 유효한 Sentry level로 매핑된다', () => {
    // Given
    const reporter = createSentryErrorReporter();
    const severities: Severity[] = ['debug', 'info', 'warning', 'error', 'fatal'];

    // When / Then
    for (const severity of severities) {
      reporter.captureMessage('e', { severity });
    }
    expect(captureMessage.mock.calls.map((c) => c[1].level)).toEqual([
      'debug',
      'info',
      'warning',
      'error',
      'fatal',
    ]);
  });

  it('addBreadcrumb는 category/level(기본 info)/data를 Sentry breadcrumb로 매핑한다', () => {
    // Given
    const reporter = createSentryErrorReporter();

    // When
    reporter.addBreadcrumb({
      category: 'http',
      level: 'warning',
      message: 'API 요청 실패',
      data: { status: 500 },
    });
    reporter.addBreadcrumb({ category: 'navigation', message: '화면 이동' });

    // Then
    expect(addBreadcrumb).toHaveBeenNthCalledWith(1, {
      category: 'http',
      level: 'warning',
      message: 'API 요청 실패',
      data: { status: 500 },
    });
    expect(addBreadcrumb).toHaveBeenNthCalledWith(2, {
      category: 'navigation',
      level: 'info',
      message: '화면 이동',
      data: undefined,
    });
  });

  it('setUserId(null)은 Sentry user를 해제한다', () => {
    // Given
    const reporter = createSentryErrorReporter();

    // When
    reporter.setUserId('user-1');
    reporter.setUserId(null);

    // Then
    expect(setUser).toHaveBeenNthCalledWith(1, { id: 'user-1' });
    expect(setUser).toHaveBeenNthCalledWith(2, null);
  });
});
