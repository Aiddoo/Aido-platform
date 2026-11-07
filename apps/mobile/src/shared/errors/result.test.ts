import { ApiError } from '@src/core/errors/api-error';
import { isBusinessError } from '@src/core/errors/result';

import { BusinessError } from './business-error';

describe('isBusinessError', () => {
  it('코드를 넘기면 그 코드인 오류만 통과한다', () => {
    // Given
    const error = new BusinessError('FRIEND_EMPTY_TAG');

    // When
    const sameCode = isBusinessError(error, 'FRIEND_EMPTY_TAG');
    const otherCode = isBusinessError(error, 'FRIEND_INVALID_TAG');

    // Then
    expect(sameCode).toBe(true);
    expect(otherCode).toBe(false);
  });

  it('서버 ApiError도 코드로 판별한다', () => {
    // Given
    const error = new ApiError('INVITE_2101', 'message', 404);

    // When
    const result = isBusinessError(error, 'INVITE_2101');

    // Then
    expect(result).toBe(true);
  });

  it('코드가 없는 오류와 Error가 아닌 값은 거른다', () => {
    // When
    const withoutCode = isBusinessError(new TypeError('x'));
    const notError = isBusinessError({ code: 'A' }, 'A');

    // Then
    expect(withoutCode).toBe(false);
    expect(notError).toBe(false);
  });
});
