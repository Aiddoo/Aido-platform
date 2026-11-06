import { ApiError } from './api-error';
import { BusinessError } from './business-error';
import { isBusinessError } from './result';

describe('isBusinessError', () => {
  it('코드를 넘기면 그 코드인 오류만 통과한다', () => {
    // Given
    const error = new BusinessError('FRIEND_EMPTY_TAG');

    // When & Then
    expect(isBusinessError(error, 'FRIEND_EMPTY_TAG')).toBe(true);
    expect(isBusinessError(error, 'FRIEND_INVALID_TAG')).toBe(false);
  });

  it('서버 ApiError도 코드로 판별한다', () => {
    // When & Then
    expect(isBusinessError(new ApiError('INVITE_2101', 'message', 404), 'INVITE_2101')).toBe(true);
  });

  it('코드가 없는 오류와 Error가 아닌 값은 거른다', () => {
    // When & Then
    expect(isBusinessError(new TypeError('x'))).toBe(false);
    expect(isBusinessError({ code: 'A' }, 'A')).toBe(false);
  });
});
