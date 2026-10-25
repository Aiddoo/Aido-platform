import { VERIFICATION_CODE } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

/** 재발송 성공 뒤 다음 재발송까지 기다릴 초. 서버가 알려 주지 않으면 기본 쿨다운을 쓴다. */
export function getResendCooldownAfterSuccess(retryAfterSeconds: number | undefined): number {
  return retryAfterSeconds ?? VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS;
}

/** 재발송 실패가 쿨다운 중(VERIFY_0753)이면 서버가 알려 준 남은 초를, 아니면 undefined를 돌려준다. */
export function getResendCooldownAfterError(error: unknown): number | undefined {
  if (!isApiError(error) || !error.hasCode(ErrorCode.VERIFY_0753)) {
    return undefined;
  }
  const remaining = error.details?.remainingSeconds;
  return typeof remaining === 'number' ? remaining : undefined;
}
