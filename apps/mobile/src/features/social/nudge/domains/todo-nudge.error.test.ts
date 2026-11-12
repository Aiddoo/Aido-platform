import { ErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { NetworkError } from '@src/shared/errors';

import { isNudgeUnavailableError, isSentNudgeListDisabledError } from './todo-nudge.error';

describe('isNudgeUnavailableError', () => {
  it.each([
    ['없거나 내 것이 아닌 콕(NUDGE_1105)', new ApiError(ErrorCode.NUDGE_1105, 'x', 404), true],
    ['답장·감사가 꺼짐(NUDGE_1111)', new ApiError(ErrorCode.NUDGE_1111, 'x', 404), true],
    ['코드가 다른 404(할 일 없음)', new ApiError(ErrorCode.TODO_0801, 'x', 404), false],
    ['답장할 수 없는 상태(NUDGE_1109)', new ApiError(ErrorCode.NUDGE_1109, 'x', 409), false],
    ['연결 끊김', new NetworkError(), false],
  ])('%s는 다시 시도해도 같은 상태인지: %s', (_case, error, expected) => {
    // When
    const result = isNudgeUnavailableError(error);

    // Then
    expect(result).toBe(expected);
  });
});

describe('isSentNudgeListDisabledError', () => {
  it.each([
    ['꺼짐(NUDGE_1111)', new ApiError(ErrorCode.NUDGE_1111, 'x', 404), true],
    ['없는 콕(NUDGE_1105)', new ApiError(ErrorCode.NUDGE_1105, 'x', 404), false],
  ])('%s면 보낸 콕 목록이 꺼진 상태인지: %s', (_case, error, expected) => {
    // When
    const result = isSentNudgeListDisabledError(error);

    // Then
    expect(result).toBe(expected);
  });
});
