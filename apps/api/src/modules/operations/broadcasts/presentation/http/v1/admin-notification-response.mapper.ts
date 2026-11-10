import type { BroadcastResult } from "@aido/api/contracts/admin";

import type { BroadcastNotificationResult } from "../../../application/use-cases/broadcast-notification.use-case.js";
import type { SendTargetedNotificationResult } from "../../../application/use-cases/send-targeted-notification.use-case.js";

// v1 응답 수는 접수 시점에 발송 대기열에 올릴 대상 수이고 전달 성공 수가 아니다
export function toBroadcastResultResponse(result: BroadcastNotificationResult): BroadcastResult {
  return { successCount: result.targetCount, failCount: 0, totalTargets: result.targetCount };
}

export function toTargetedResultResponse(result: SendTargetedNotificationResult): BroadcastResult {
  return {
    successCount: result.sentCount,
    failCount: result.failedCount,
    totalTargets: result.targetCount,
  };
}
