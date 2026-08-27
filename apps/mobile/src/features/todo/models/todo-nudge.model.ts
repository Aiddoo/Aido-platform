import { isSameDay, todoOverlapsDate } from '@src/shared/utils/date';
import { z } from 'zod';

export const nudgeLimitInfoSchema = z.object({
  dailyLimit: z.number().nullable(),
  usedToday: z.number(),
  remainingToday: z.number().nullable(),
  isUnlimited: z.boolean(),
});
export type NudgeLimitInfo = z.infer<typeof nudgeLimitInfoSchema>;

export const nudgeCooldownInfoSchema = z.object({
  canNudge: z.boolean(),
  cooldownEndsAt: z.date().nullable(),
  remainingSeconds: z.number().nullable(),
});
export type NudgeCooldownInfo = z.infer<typeof nudgeCooldownInfoSchema>;

export const sendTodoNudgeInputSchema = z.object({
  receiverId: z.string(),
  todoId: z.number(),
  message: z.string().optional(),
});
export type SendTodoNudgeInput = z.infer<typeof sendTodoNudgeInputSchema>;

export const sendRemindNudgeInputSchema = z.object({
  receiverId: z.string(),
  message: z.string().optional(),
});
export type SendRemindNudgeInput = z.infer<typeof sendRemindNudgeInputSchema>;

export const sendTodoNudgeResultSchema = z.object({
  message: z.string(),
});
export type SendTodoNudgeResult = z.infer<typeof sendTodoNudgeResultSchema>;

export type NudgeBannerState =
  | { type: 'limitReached' }
  | { type: 'available' }
  | { type: 'remaining'; remainingToday: number; dailyLimit: number | null };

const MAX_MESSAGE_LENGTH = 200;

const normalizeMessage = (message?: string | null): string | undefined => {
  if (message == null) return undefined;
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isMessageTooLong = (message?: string | null): boolean => {
  if (!message) return false;
  return message.trim().length > MAX_MESSAGE_LENGTH;
};

const isLimitReached = (limitInfo: NudgeLimitInfo): boolean => {
  return limitInfo.remainingToday !== null && limitInfo.remainingToday <= 0;
};

const getBannerState = (limitInfo: NudgeLimitInfo): NudgeBannerState => {
  if (isLimitReached(limitInfo)) {
    return { type: 'limitReached' };
  }

  if (limitInfo.isUnlimited || limitInfo.usedToday === 0 || limitInfo.remainingToday === null) {
    return { type: 'available' };
  }

  return {
    type: 'remaining',
    remainingToday: limitInfo.remainingToday,
    dailyLimit: limitInfo.dailyLimit,
  };
};

const canNudgeOnDate = (targetDate: Date, now: Date): boolean => {
  return isSameDay(targetDate, now);
};

const canNudgeTodoOnDate = (
  input: { targetDate: Date; isCompleted: boolean },
  now: Date,
): boolean => {
  return !input.isCompleted && canNudgeOnDate(input.targetDate, now);
};

/**
 * 상세 화면의 넛지 노출 조건. 서버가 허용한 친구 관계를 전제로, 완료 여부와
 * 오늘이 할 일의 포함 범위[startDate, endDate] 안인지까지 같은 자리에서 판정한다.
 */
const canNudgeTodoInRange = (
  input: {
    canNudge: boolean;
    isCompleted: boolean;
    startDate: string;
    endDate: string | null;
  },
  targetDate: string,
): boolean => {
  return (
    input.canNudge &&
    !input.isCompleted &&
    todoOverlapsDate(input.startDate, input.endDate, targetDate)
  );
};

export const TodoNudgePolicy = {
  maxMessageLength: MAX_MESSAGE_LENGTH,
  normalizeMessage,
  isMessageTooLong,
  isLimitReached,
  getBannerState,
  canNudgeOnDate,
  canNudgeTodoOnDate,
  canNudgeTodoInRange,
} as const;
