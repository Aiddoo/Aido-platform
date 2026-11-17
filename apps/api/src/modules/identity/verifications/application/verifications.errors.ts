import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

/** 같은 종류 코드를 방금 보냈다. 앱은 남은 초로 다시 보내기 타이머를 켠다(운영 응답에도 싣는 공개 details) */
export function verificationResendCooldown(remainingSeconds: number): ApplicationException {
  return new ApplicationException(ErrorCode.VERIFY_0753, { remainingSeconds });
}

export function verificationAttemptsExceeded(): ApplicationException {
  return new ApplicationException(ErrorCode.VERIFY_0754);
}

export function invalidVerificationCode(): ApplicationException {
  return new ApplicationException(ErrorCode.VERIFY_0751);
}

export function emailAlreadyVerified(email: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0604, {
    email,
    message: "이미 인증이 완료된 계정입니다.",
  });
}

export function emailNotRegistered(email: string): ApplicationException {
  return new ApplicationException(ErrorCode.EMAIL_0502, { email });
}
