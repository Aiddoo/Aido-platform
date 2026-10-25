import { VERIFICATION_CODE } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/shared/errors/api-error';

import { getResendCooldownAfterError, getResendCooldownAfterSuccess } from './resend-cooldown';

describe('getResendCooldownAfterSuccess', () => {
  it('서버가 알려 준 대기 시간을 우선한다', () => {
    expect(getResendCooldownAfterSuccess(42)).toBe(42);
  });

  it('서버 값이 없으면 기본 재발송 쿨다운을 쓴다', () => {
    expect(getResendCooldownAfterSuccess(undefined)).toBe(
      VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS,
    );
  });
});

describe('getResendCooldownAfterError', () => {
  it('쿨다운 중(VERIFY_0753) 오류면 남은 초만큼 다시 기다리게 한다', () => {
    // Given
    const error = new ApiError(ErrorCode.VERIFY_0753, 'cooldown', 429, { remainingSeconds: 17 });

    // When / Then
    expect(getResendCooldownAfterError(error)).toBe(17);
  });

  it('쿨다운 오류라도 남은 초가 숫자가 아니면 쿨다운을 걸지 않는다', () => {
    // Given
    const error = new ApiError(ErrorCode.VERIFY_0753, 'cooldown', 429, { remainingSeconds: '17' });

    // When / Then
    expect(getResendCooldownAfterError(error)).toBeUndefined();
  });

  it('다른 오류는 쿨다운을 걸지 않는다', () => {
    // Given
    const error = new ApiError(ErrorCode.VERIFY_0751, 'invalid', 400, { remainingSeconds: 17 });

    // When / Then
    expect(getResendCooldownAfterError(error)).toBeUndefined();
    expect(getResendCooldownAfterError(new Error('network'))).toBeUndefined();
  });
});
