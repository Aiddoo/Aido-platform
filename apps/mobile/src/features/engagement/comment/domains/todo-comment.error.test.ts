import { ApiError } from '@src/core/errors/api-error';
import { ServerError } from '@src/shared/errors';

import { isTodoCommentRejectedError } from './todo-comment.error';

describe('isTodoCommentRejectedError', () => {
  it.each([
    ['400', new ApiError('SYS_0002', '거절', 400), true],
    ['499', new ApiError('SYS_0002', '거절', 499), true],
    ['500', new ServerError(500), false],
    ['연결 실패', new Error('offline'), false],
  ])('%s 오류는 같은 글을 다시 보내도 같은 결과인지 %s다', (_label, error, expected) => {
    // When
    const result = isTodoCommentRejectedError(error);

    // Then
    expect(result).toBe(expected);
  });
});
