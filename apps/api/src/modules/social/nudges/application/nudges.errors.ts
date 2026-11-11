import { ErrorCode } from "@aido/api/errors";
import { match } from "ts-pattern";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DailySendFeatureQuota } from "../../cheers/application/ports/daily-send-usage.reader.port.js";
import type { NudgeId } from "../domain/nudge-id.vo.js";
import type { NudgeThanksRejection } from "../domain/nudge-interaction.domain-service.js";

export function cannotNudgeSelf(): ApplicationException {
  return new ApplicationException(ErrorCode.NUDGE_1104);
}

export function nudgeTargetNotFriend(targetUserId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.NUDGE_1103, { targetUserId: targetUserId.value });
}

// 없는 할 일·남의 할 일·비공개 할 일을 구분하지 않는다
export function nudgeTodoNotFound(todoId: number): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0801, { todoId });
}

export function nudgeTodoNotActiveToday(todoId: number): ApplicationException {
  return new ApplicationException(ErrorCode.NUDGE_1106, { todoId });
}

export function nudgeDailyLimitReached(featureQuota: DailySendFeatureQuota): ApplicationException {
  return new ApplicationException(ErrorCode.NUDGE_1101, { charged: false, featureQuota });
}

export function nudgeCooldownActive(
  targetUserId: UserId,
  remainingSeconds: number,
): ApplicationException {
  return new ApplicationException(ErrorCode.NUDGE_1102, {
    targetUserId: targetUserId.value,
    remainingSeconds,
  });
}

export function remindTargetHasTodayTodos(receiverId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.NUDGE_1107, { receiverId: receiverId.value });
}

export function remindNudgeCooldownActive(
  targetUserId: UserId,
  remainingSeconds: number,
): ApplicationException {
  return new ApplicationException(ErrorCode.NUDGE_1108, {
    targetUserId: targetUserId.value,
    remainingSeconds,
  });
}

export function nudgeNotFound(nudgeId: NudgeId): ApplicationException {
  return new ApplicationException(ErrorCode.NUDGE_1105, { nudgeId: nudgeId.value });
}

// 답장·감사 기능이 꺼졌거나 보고 있는 사람의 콕이 아니면 같은 오류다
export function nudgeInteractionNotFound(): ApplicationException {
  return new ApplicationException(ErrorCode.NUDGE_1105);
}

export function nudgeInteractionClosed(): ApplicationException {
  return new ApplicationException(ErrorCode.NUDGE_1109);
}

export function thanksTodoNotFound(): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0801);
}

export function nudgeThanksRejected(reason: NudgeThanksRejection): ApplicationException {
  return match(reason)
    .with("todo-not-completed", () => new ApplicationException(ErrorCode.NUDGE_1110))
    .with("todo-not-public", () => nudgeInteractionClosed())
    .exhaustive();
}
