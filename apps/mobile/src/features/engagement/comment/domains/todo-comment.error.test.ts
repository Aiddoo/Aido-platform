import { ServerError } from '@src/shared/errors';
import { createApiError } from '@src/testing/core';

import { isTodoCommentRejectedError } from './todo-comment.error';

describe('isTodoCommentRejectedError', () => {
  it.each([
    ['400', createApiError('SYS_0002', { message: '거절' }), true],
    ['499', createApiError('SYS_0002', { message: '거절', status: 499 }), true],
    ['500', new ServerError(500), false],
    ['연결 실패', new Error('offline'), false],
  ])('%s 오류는 같은 글을 다시 보내도 같은 결과인지 %s다', (_label, error, expected) => {
    // When
    const result = isTodoCommentRejectedError(error);

    // Then
    expect(result).toBe(expected);
  });
});
