import { ErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { createErrorReporterStub } from '@src/testing/core';

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

  it.each<[string, unknown, number]>([
    ['응답 계약 위반', new ParseError('invalid'), 1],
    ['Error가 아닌 값', 'native failure', 1],
    ['서버가 코드로 거절한 4xx', new ApiError(ErrorCode.TODO_0801, '없음', 404), 0],
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
