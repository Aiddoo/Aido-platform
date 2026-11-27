import { ErrorCode } from '@aido/api/errors';
import { NetworkError } from '@src/shared/errors';
import { createApiError } from '@src/testing/core';

import { isNudgeDisabledError, isNudgeUnavailableError } from './todo-nudge.error';

describe('isNudgeUnavailableError', () => {
  it.each([
    [
      '없거나 내 것이 아닌 콕(NUDGE_1105)',
      createApiError(ErrorCode.NUDGE_1105, { message: 'x' }),
      true,
    ],
    ['답장·감사가 꺼짐(NUDGE_1111)', createApiError(ErrorCode.NUDGE_1111, { message: 'x' }), true],
    ['코드가 다른 404(할 일 없음)', createApiError(ErrorCode.TODO_0801, { message: 'x' }), false],
    [
      '답장할 수 없는 상태(NUDGE_1109)',
      createApiError(ErrorCode.NUDGE_1109, { message: 'x' }),
      false,
    ],
    ['연결 끊김', new NetworkError(), false],
  ])('%s는 다시 시도해도 같은 상태인지: %s', (_case, error, expected) => {
    // When
    const result = isNudgeUnavailableError(error);

    // Then
    expect(result).toBe(expected);
  });
});

describe('isNudgeDisabledError', () => {
  it.each([
    ['답장·감사가 꺼짐(NUDGE_1111)', createApiError(ErrorCode.NUDGE_1111, { message: 'x' }), true],
    [
      '없거나 내 것이 아닌 콕(NUDGE_1105)',
      createApiError(ErrorCode.NUDGE_1105, { message: 'x' }),
      false,
    ],
    ['연결 끊김', new NetworkError(), false],
  ])('%s는 기능이 꺼진 상태인지: %s', (_case, error, expected) => {
    // When
    const result = isNudgeDisabledError(error);

    // Then
    expect(result).toBe(expected);
  });
});
