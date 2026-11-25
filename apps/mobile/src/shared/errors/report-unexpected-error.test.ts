import { ErrorCode } from '@aido/api/errors';
import { createErrorReporterStub, createApiError } from '@src/testing/core';

import { NetworkError, ParseError, ServerError } from './infra-error';
import { reportUnexpectedError } from './report-unexpected-error';

describe('reportUnexpectedError', () => {
  it('5xx는 상태·서버 코드·실패한 요청을 태그로 붙여 이슈로 보낸다', () => {
    // Given
    const errorReporter = createErrorReporterStub();
    const error = new ServerError(503, {
      serverCode: ErrorCode.SYS_0005,
      details: null,
      requestId: 'req-1',
      request: { method: 'POST', endpoint: '/v1/todos/1/comments' },
    });

    // When
    reportUnexpectedError(errorReporter, error, 'todo_comment');

    // Then
    expect(errorReporter.captureException).toHaveBeenCalledWith(error, {
      feature: 'todo_comment',
      statusCode: 503,
      serverErrorCode: ErrorCode.SYS_0005,
      method: 'POST',
      endpoint: '/v1/todos/1/comments',
    });
  });

  it('호출부가 붙인 기기 작업 이름과 사유를 태그로 함께 보낸다', () => {
    // Given
    const errorReporter = createErrorReporterStub();
    const error = new Error('native widget failure');

    // When
    reportUnexpectedError(errorReporter, error, 'widget', {
      method: 'reloadAll',
      errorCode: 'WIDGET_WRITE',
    });

    // Then
    expect(errorReporter.captureException).toHaveBeenCalledWith(error, {
      feature: 'widget',
      method: 'reloadAll',
      errorCode: 'WIDGET_WRITE',
    });
  });

  it('5xx 요청의 method와 호출부가 넘긴 method가 겹치면 호출부 값을 보낸다', () => {
    // Given
    const errorReporter = createErrorReporterStub();
    const error = new ServerError(500, {
      serverCode: ErrorCode.SYS_0005,
      details: null,
      requestId: 'req-2',
      request: { method: 'PUT', endpoint: '/v1/weather/location' },
    });

    // When
    reportUnexpectedError(errorReporter, error, 'widget', { method: 'reloadAll' });

    // Then
    expect(errorReporter.captureException).toHaveBeenCalledWith(error, {
      feature: 'widget',
      statusCode: 500,
      serverErrorCode: ErrorCode.SYS_0005,
      method: 'reloadAll',
      endpoint: '/v1/weather/location',
    });
  });

  it.each<[string, unknown, number]>([
    ['응답 계약 위반', new ParseError('invalid'), 1],
    ['Error가 아닌 값', 'native failure', 1],
    ['서버가 코드로 거절한 4xx', createApiError(ErrorCode.TODO_0801, { message: '없음' }), 0],
    ['연결 끊김', new NetworkError(), 0],
  ])('%s는 이슈 %i건이다', (_case, error, expectedCount) => {
    // Given
    const errorReporter = createErrorReporterStub();

    // When
    reportUnexpectedError(errorReporter, error, 'todo');

    // Then
    expect(errorReporter.captureException).toHaveBeenCalledTimes(expectedCount);
  });
});
