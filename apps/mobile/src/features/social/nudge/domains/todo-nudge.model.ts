import { NUDGE_LIMITS } from '@aido/api/vocabulary';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';

import type { CreateNudgeInput } from '../schemas/nudge-request.schema';
import type { NudgeLimitInfo } from '../schemas/todo-nudge.schema';

const MAX_MESSAGE_LENGTH = NUDGE_LIMITS.MAX_MESSAGE_LENGTH;

/** 보낼 메시지. 앞뒤 공백을 지우고, 남는 글자가 없으면 메시지 없이 보낸다 */
function normalizeMessage(input: Pick<CreateNudgeInput, 'message'>): string | undefined {
  const trimmed = input.message?.trim();

  return trimmed == null || trimmed.length === 0 ? undefined : trimmed;
}

/** 앞뒤 공백을 지운 길이로 판단한다 */
function isMessageTooLong(input: Pick<CreateNudgeInput, 'message'>): boolean {
  return (normalizeMessage(input)?.length ?? 0) > MAX_MESSAGE_LENGTH;
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
