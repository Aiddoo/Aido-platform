import { VERIFICATION_CODE } from '@aido/api/vocabulary';

/** 재발송 성공 뒤 다음 재발송까지 기다릴 초. 서버가 알려 주지 않으면 기본 쿨다운을 쓴다. */
export function getResendCooldownAfterSuccess(retryAfterSeconds: number | undefined): number {
  return retryAfterSeconds ?? VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS;
}
