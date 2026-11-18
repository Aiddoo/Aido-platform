// 세션·인증 코드·OAuth state·탈퇴 유예가 같은 경계를 쓴다. 만료 시각과 같은 순간부터 만료다
export function isExpiredAt(expiresAt: Temporal.Instant, now: Temporal.Instant): boolean {
  return Temporal.Instant.compare(now, expiresAt) >= 0;
}
