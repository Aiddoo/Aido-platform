const MILLISECONDS_PER_SECOND = 1_000;

export interface SendCooldown {
  readonly isActive: boolean;
  readonly remainingSeconds: number;
  readonly endsAt: Temporal.Instant | null;
}

const INACTIVE_COOLDOWN: SendCooldown = { isActive: false, remainingSeconds: 0, endsAt: null };

// 남은 초는 ms 차이를 올림한다(옮기기 전 calculateCooldown과 같은 값)
export function evaluateSendCooldown(params: {
  readonly lastSentAt: Temporal.Instant | null;
  readonly cooldownHours: number;
  readonly now: Temporal.Instant;
}): SendCooldown {
  if (params.lastSentAt == null) {
    return INACTIVE_COOLDOWN;
  }
  const endsAt = params.lastSentAt.add({ hours: params.cooldownHours });
  if (Temporal.Instant.compare(params.now, endsAt) >= 0) {
    return INACTIVE_COOLDOWN;
  }
  const remainingMilliseconds = endsAt.epochMilliseconds - params.now.epochMilliseconds;
  return {
    isActive: true,
    remainingSeconds: Math.ceil(remainingMilliseconds / MILLISECONDS_PER_SECOND),
    endsAt,
  };
}
