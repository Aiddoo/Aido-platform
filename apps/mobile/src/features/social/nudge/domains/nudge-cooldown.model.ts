import { hasInstantPassed, type Instant, instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const nudgeCooldownSchema = z.object({
  canNudge: z.boolean(),
  remainingSeconds: z.int().nonnegative().nullable(),
  cooldownEndsAt: instantSchema.nullable(),
});
export type NudgeCooldown = z.infer<typeof nudgeCooldownSchema>;

export const NudgeCooldownPolicy = {
  // 서버는 쿨다운 중일 때만 canNudge가 false다. 받은 쿨다운 끝 순간이 지나면 다시 묻지 않아도 찌를 수 있다
  canNudgeAfterCooldown(cooldown: NudgeCooldown, now: Instant): boolean {
    return (
      cooldown.canNudge ||
      (cooldown.cooldownEndsAt != null && hasInstantPassed(cooldown.cooldownEndsAt, now))
    );
  },
};
