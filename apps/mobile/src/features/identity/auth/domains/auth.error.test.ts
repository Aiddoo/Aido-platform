import { ErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';

import { getResendCooldownAfterError } from './auth.error';

describe('getResendCooldownAfterError', () => {
  it('쿨다운 중(VERIFY_0753) 오류면 남은 초만큼 다시 기다리게 한다', () => {
    // Given
    const error = new ApiError(ErrorCode.VERIFY_0753, 'cooldown', 429, { remainingSeconds: 17 });

    // When
    const result = getResendCooldownAfterError(error);

    // Then
    expect(result).toBe(17);
  });

  it('쿨다운 오류라도 남은 초가 숫자가 아니면 쿨다운을 걸지 않는다', () => {
    // Given
    const error = new ApiError(ErrorCode.VERIFY_0753, 'cooldown', 429, { remainingSeconds: '17' });

    // When
    const result = getResendCooldownAfterError(error);

    // Then
    expect(result).toBeNull();
  });

  it('다른 서버 오류는 남은 초가 실려 있어도 쿨다운을 걸지 않는다', () => {
    // Given
    const error = new ApiError(ErrorCode.VERIFY_0751, 'invalid', 400, { remainingSeconds: 17 });

    // When
    const result = getResendCooldownAfterError(error);

    // Then
    expect(result).toBeNull();
  });

  it('서버 오류가 아니면 쿨다운을 걸지 않는다', () => {
    // Given
    const error = new Error('network');

    // When
    const result = getResendCooldownAfterError(error);

    // Then
    expect(result).toBeNull();
  });
});
