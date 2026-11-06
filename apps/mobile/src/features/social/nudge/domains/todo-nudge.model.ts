import { NUDGE_LIMITS } from '@aido/api/vocabulary';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { isSameDay } from '@src/features/planning/todo/utils/calendar-date';

import type { NudgeLimitInfo } from '../schemas/todo-nudge.schema';

const MAX_MESSAGE_LENGTH = NUDGE_LIMITS.MAX_MESSAGE_LENGTH;

function normalizeMessage(message?: string | null): string | undefined {
  if (message == null) {
    return undefined;
  }
  const trimmed = message.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function isMessageTooLong(message?: string | null): boolean {
  if (!message) {
    return false;
  }

  return message.trim().length > MAX_MESSAGE_LENGTH;
}

function isLimitReached(limitInfo: Pick<NudgeLimitInfo, 'remainingToday'>): boolean {
  return limitInfo.remainingToday != null && limitInfo.remainingToday <= 0;
}

function canNudgeOnDate(targetDate: Date, now: Date): boolean {
  return isSameDay(targetDate, now);
}

function canNudgeTodoOnDate(input: { targetDate: Date; isCompleted: boolean }, now: Date): boolean {
  return !input.isCompleted && canNudgeOnDate(input.targetDate, now);
}

/**
 * 상세 화면의 넛지 노출 조건. 서버가 허용한 친구 관계를 전제로, 완료 여부와
 * 오늘이 할 일의 포함 범위[startDate, endDate] 안인지까지 같은 자리에서 판정한다.
 */
function canNudgeTodoInRange(
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
  maxMessageLength: MAX_MESSAGE_LENGTH,
  normalizeMessage,
  isMessageTooLong,
  isLimitReached,
  canNudgeOnDate,
  canNudgeTodoOnDate,
  canNudgeTodoInRange,
} as const;
