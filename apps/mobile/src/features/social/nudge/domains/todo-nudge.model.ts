import { NUDGE_LIMITS } from '@aido/api/vocabulary';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import type { DateKey } from '@src/shared/date/date-key';
import { instantSchema } from '@src/shared/date/instant';
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

// 친구 피드 행에는 서버 권한이 없어 버튼만 미리 감춘다. 서버 콕 보내기 규칙(끝내지 않은 오늘 할 일, NUDGE_1106)과 같다
export function canNudgeTodoOnDate(todo: Todo, targetDateKey: DateKey, todayKey: DateKey): boolean {
  return !todo.completed && targetDateKey === todayKey;
}

export const TodoNudgePolicy = {
  canNudgeTodoOnDate,
} as const;
