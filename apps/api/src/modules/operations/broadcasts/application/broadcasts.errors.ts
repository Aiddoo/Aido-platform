import { ErrorCode } from "@aido/api/errors";
import type { BroadcastTargetFilter } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";

export function broadcastCampaignNotFound(campaignId: string): ApplicationException {
  return new ApplicationException(ErrorCode.ADMIN_1404, { campaignId });
}

// 같은 요청 ID로 다른 내용이 다시 왔다
export function broadcastRequestConflict(requestId: string): ApplicationException {
  return new ApplicationException(ErrorCode.ADMIN_1405, { requestId });
}

export function broadcastTargetsEmpty(targetFilter: BroadcastTargetFilter): ApplicationException {
  return new ApplicationException(ErrorCode.ADMIN_1402, { targetFilter });
}

export function targetedUsersNotFound(requestedCount: number): ApplicationException {
  return new ApplicationException(ErrorCode.ADMIN_1402, { requested: requestedCount });
}
