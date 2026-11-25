import { NUDGE_LIMITS } from '@aido/api/vocabulary';
import { hasInstantPassed, type Instant, instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const nudgeCooldownInfoSchema = z.object({
  canNudge: z.boolean(),
  remainingSeconds: z.int().nonnegative().nullable(),
  cooldownEndsAt: instantSchema.nullable(),
});
export type NudgeCooldownInfo = z.infer<typeof nudgeCooldownInfoSchema>;

const sendTodoNudgeResultSchema = z.object({
  message: z.string(),
});
export type SendTodoNudgeResult = z.infer<typeof sendTodoNudgeResultSchema>;

interface NudgeMessageInput {
  message?: string;
}

const MAX_MESSAGE_LENGTH = NUDGE_LIMITS.MAX_MESSAGE_LENGTH;

// 보내는 요청의 메시지 칸 규칙이라 Policy 밖에 둔다. 앞뒤 공백을 지우고, 남는 글자가 없으면 메시지 없이(undefined) 보낸다
export function normalizeMessage(input: NudgeMessageInput): string | undefined {
  const trimmed = input.message?.trim();

  return trimmed == null || trimmed.length === 0 ? undefined : trimmed;
}

// 앞뒤 공백을 지운 길이로 판단한다
export function isMessageTooLong(input: NudgeMessageInput): boolean {
  return (normalizeMessage(input)?.length ?? 0) > MAX_MESSAGE_LENGTH;
}

export const NudgeCooldownPolicy = {
  // 서버는 쿨다운 중일 때만 canNudge가 false다. 받은 쿨다운 끝 순간이 지나면 다시 묻지 않아도 찌를 수 있다
  canNudgeAfterCooldown(cooldown: NudgeCooldownInfo, now: Instant): boolean {
    return (
      cooldown.canNudge ||
      (cooldown.cooldownEndsAt != null && hasInstantPassed(cooldown.cooldownEndsAt, now))
    );
  },
};
