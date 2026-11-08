import { NUDGE_LIMITS } from '@aido/api/vocabulary';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const nudgeLimitInfoSchema = z.object({
  dailyLimit: z.int().nonnegative().nullable(),
  usedToday: z.int().nonnegative(),
  remainingToday: z.int().nonnegative().nullable(),
  isUnlimited: z.boolean(),
});
export type NudgeLimitInfo = z.infer<typeof nudgeLimitInfoSchema>;

export const nudgeCooldownInfoSchema = z.object({
  canNudge: z.boolean(),
  remainingSeconds: z.int().nonnegative().nullable(),
  cooldownEndsAt: instantSchema.nullable(),
});
export type NudgeCooldownInfo = z.infer<typeof nudgeCooldownInfoSchema>;

export const sendTodoNudgeResultSchema = z.object({
  message: z.string(),
});
export type SendTodoNudgeResult = z.infer<typeof sendTodoNudgeResultSchema>;

interface NudgeMessageInput {
  message?: string;
}

const MAX_MESSAGE_LENGTH = NUDGE_LIMITS.MAX_MESSAGE_LENGTH;

// 앞뒤 공백을 지우고, 남는 글자가 없으면 메시지 없이(undefined) 보낸다
export function normalizeMessage(input: NudgeMessageInput): string | undefined {
  const trimmed = input.message?.trim();

  return trimmed == null || trimmed.length === 0 ? undefined : trimmed;
}

// 앞뒤 공백을 지운 길이로 판단한다
export function isMessageTooLong(input: NudgeMessageInput): boolean {
  return (normalizeMessage(input)?.length ?? 0) > MAX_MESSAGE_LENGTH;
}

export function isLimitReached(limitInfo: Pick<NudgeLimitInfo, 'remainingToday'>): boolean {
  return limitInfo.remainingToday != null && limitInfo.remainingToday <= 0;
}

// 친구 피드에서 보고 있는 날이 오늘이고 아직 끝나지 않은 할 일만 콕 찌를 수 있다
export function canNudgeTodoOnDate(
  input: { targetDateKey: string; isCompleted: boolean },
  todayKey: string,
): boolean {
  return !input.isCompleted && input.targetDateKey === todayKey;
}

// 상세 화면: 서버가 허용한 친구 관계 위에 완료 여부와 오늘이 [startDate, endDate] 안인지를 함께 본다
export function canNudgeTodoInRange(
  input: {
    canNudge: boolean;
    isCompleted: boolean;
    startDate: string;
    endDate: string | null;
  },
  targetDate: string,
): boolean {
  return input.canNudge && !input.isCompleted && TodoPolicy.isTodoOnDate(input, targetDate);
}

export const TodoNudgePolicy = {
  normalizeMessage,
  isMessageTooLong,
  isLimitReached,
  canNudgeTodoOnDate,
  canNudgeTodoInRange,
} as const;
