// 계정이 있든 없든 같은 이메일의 재설정 요청을 같은 대기로 막아 응답으로 가입 여부가 드러나지 않게 한다
export abstract class PasswordResetCooldownPort {
  /** 다시 보내기 대기 안이면 그 대기를 시작한 시각, 아니면 null */
  abstract findStartedAt(email: string, now: Temporal.Instant): Promise<Temporal.Instant | null>;
  abstract start(email: string, now: Temporal.Instant): Promise<void>;
}
