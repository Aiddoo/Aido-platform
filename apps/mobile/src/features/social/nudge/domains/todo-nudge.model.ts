import { NUDGE_LIMITS } from '@aido/api/vocabulary';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';

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

/** 친구 피드에서 보고 있는 날이 오늘이고 아직 끝나지 않은 할 일만 콕 찌를 수 있다 */
function canNudgeTodoOnDate(
  input: { targetDateKey: string; isCompleted: boolean },
  todayKey: string,
): boolean {
  return !input.isCompleted && input.targetDateKey === todayKey;
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
  normalizeMessage,
  isMessageTooLong,
  isLimitReached,
  canNudgeTodoOnDate,
  canNudgeTodoInRange,
} as const;
