import { ErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { BusinessError, NetworkError, ServerError } from '@src/shared/errors';

import {
  AUTH_ERROR_CODE,
  findLoginFailureReason,
  findResendCooldown,
  findVerificationCodeFieldError,
  VERIFICATION_CODE_FIELD_ERROR,
} from './auth.error';

describe('findResendCooldown', () => {
  it('쿨다운 중(VERIFY_0753) 오류면 남은 초만큼 다시 기다리게 한다', () => {
    // Given
    const error = new ApiError(ErrorCode.VERIFY_0753, 'cooldown', 429, { remainingSeconds: 17 });

    // When
    const result = findResendCooldown(error);

    // Then
    expect(result).toBe(17);
  });

  it('쿨다운 오류라도 남은 초가 숫자가 아니면 쿨다운을 걸지 않는다', () => {
    // Given
    const error = new ApiError(ErrorCode.VERIFY_0753, 'cooldown', 429, { remainingSeconds: '17' });

    // When
    const result = findResendCooldown(error);

    // Then
    expect(result).toBeNull();
  });

  it('다른 서버 오류는 남은 초가 실려 있어도 쿨다운을 걸지 않는다', () => {
    // Given
    const error = new ApiError(ErrorCode.VERIFY_0751, 'invalid', 400, { remainingSeconds: 17 });

    // When
    const result = findResendCooldown(error);

    // Then
    expect(result).toBeNull();
  });

  it('서버 오류가 아니면 쿨다운을 걸지 않는다', () => {
    // Given
    const error = new Error('network');

    // When
    const result = findResendCooldown(error);

    // Then
    expect(result).toBeNull();
  });
});

describe('findVerificationCodeFieldError', () => {
  it.each([
    [
      '틀린 코드(VERIFY_0751)',
      new ApiError(ErrorCode.VERIFY_0751, 'x', 400),
      VERIFICATION_CODE_FIELD_ERROR,
    ],
    [
      '만료된 코드(VERIFY_0752)',
      new ApiError(ErrorCode.VERIFY_0752, 'x', 400),
      VERIFICATION_CODE_FIELD_ERROR,
    ],
    [
      '시도 초과(VERIFY_0754)',
      new ApiError(ErrorCode.VERIFY_0754, 'x', 429),
      VERIFICATION_CODE_FIELD_ERROR,
    ],
    ['재발송 쿨다운(VERIFY_0753)', new ApiError(ErrorCode.VERIFY_0753, 'x', 429), null],
    ['다른 서버 오류', new ApiError(ErrorCode.USER_0602, 'x', 401), null],
    ['연결 끊김', new NetworkError(), null],
  ])('%s는 코드 칸으로 돌아갈 오류인지: %o', (_label, error, expected) => {
    // When
    const result = findVerificationCodeFieldError(error);

    // Then
    expect(result).toEqual(expected);
  });
});

describe('findLoginFailureReason', () => {
  const wrongPassword = new ApiError(ErrorCode.USER_0602, 'wrong', 401);

  it.each([
    ['이메일 로그인의 틀린 비밀번호', 'invalid_credentials', wrongPassword, 'email'],
    ['코드 교환의 USER_0602', 'rejected', wrongPassword, 'kakao'],
    ['미인증 이메일', 'email_not_verified', new ApiError(ErrorCode.EMAIL_0503, 'x', 403), 'email'],
    ['연결 끊김', 'network', new NetworkError(), 'google'],
    [
      '열리지 않은 Apple 창',
      'unknown',
      new BusinessError(AUTH_ERROR_CODE.APPLE_UNAVAILABLE),
      'apple',
    ],
    [
      '코드 없이 돌아온 창',
      'unknown',
      new BusinessError(AUTH_ERROR_CODE.NO_CODE_RECEIVED),
      'naver',
    ],
    ['서버 장애', 'unknown', new ServerError(500), 'email'],
  ] as const)('%s는 %s다', (_name, reason, error, method) => {
    // When
    const result = findLoginFailureReason(error, method);

    // Then
    expect(result).toBe(reason);
  });

  it('사용자가 직접 닫은 소셜 창은 실패가 아니다', () => {
    // When
    const result = findLoginFailureReason(
      new BusinessError(AUTH_ERROR_CODE.LOGIN_CANCELLED),
      'apple',
    );

    // Then
    expect(result).toBeNull();
  });
});
