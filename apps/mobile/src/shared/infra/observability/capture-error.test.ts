import * as Sentry from '@sentry/react-native';
import { ApiError } from '@src/core/errors/api-error';
import { ServerError } from '@src/shared/errors/infra-error';
import { createSentryErrorReporter } from '@src/shared/infra/error-reporter/sentry-error-reporter';
import { createSentryLogger } from '@src/shared/infra/logger/sentry-logger';

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
}));

const captureException = jest.mocked(Sentry.captureException);
const addBreadcrumb = jest.mocked(Sentry.addBreadcrumb);

describe('captureError', () => {
  beforeEach(() => {
    captureException.mockClear();
    addBreadcrumb.mockClear();
  });

  it('AppLogger.error와 captureException이 같은 오류를 보고해도 이슈는 한 번이다', () => {
    // Given
    const error = new Error('boom');

    // When
    createSentryLogger().error('todo.submit.failed', error);
    createSentryErrorReporter().captureException(error, { feature: 'todo' });

    // Then
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('순서를 바꿔도 먼저 보고한 쪽의 태그로 한 번만 보낸다', () => {
    // Given
    const error = new Error('boom');

    // When
    createSentryErrorReporter().captureException(error, { feature: 'todo' });
    createSentryLogger().error('todo.submit.failed', error);

    // Then
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(error, {
      level: 'error',
      tags: { feature: 'todo' },
    });
  });

  it('서로 다른 오류는 각각 보낸다', () => {
    // When
    createSentryLogger().error('todo.submit.failed', new Error('a'));
    createSentryErrorReporter().captureException(new Error('b'), { feature: 'todo' });

    // Then
    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it('4xx는 이슈 대신 breadcrumb로 남긴다', () => {
    // Given
    const error = new ApiError('TODO_0801', '없는 할 일', 404);

    // When
    createSentryErrorReporter().captureException(error, { feature: 'todo' });

    // Then
    expect(captureException).not.toHaveBeenCalled();
    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'error',
        level: 'warning',
        data: expect.objectContaining({ feature: 'todo', error: '없는 할 일' }),
      }),
    );
  });

  it('5xx는 requestId를 request_id 태그로 싣는다', () => {
    // Given
    const error = new ServerError(503, {
      serverCode: null,
      details: null,
      requestId: 'req-1',
      request: null,
    });

    // When
    createSentryErrorReporter().captureException(error, { feature: 'todo' });

    // Then
    expect(captureException).toHaveBeenCalledWith(error, {
      level: 'error',
      tags: { feature: 'todo', request_id: 'req-1' },
    });
  });
});
