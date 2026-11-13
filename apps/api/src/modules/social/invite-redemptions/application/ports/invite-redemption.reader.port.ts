import type { RedemptionStatus } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviterRewardTotal } from "../../domain/invite-reward.domain-service.js";
import type { InviteRedemptionSummary } from "../read-models/invite-redemption-summary.read-model.js";
import type { InvitedFriend } from "../read-models/invited-friend.read-model.js";
import type { QualifyReminderCandidate } from "../read-models/qualify-reminder-candidate.read-model.js";

export abstract class InviteRedemptionReaderPort {
  abstract summarizeByInviterId(inviterId: UserId): Promise<InviteRedemptionSummary>;
  // 초대한 사람으로 받은 보상을 종류별로 한 번에 집계한다. 받은 수와 관계없이 결과는 종류 수만큼이다.
  // 자기가 초대받아 받은 보상과, 자동 재시도를 다 쓴 FAILED 지급(받지 못한 보상)은 뺀다
  abstract summarizeInviterRewards(
    inviterId: UserId,
    windowStart: Temporal.Instant,
  ): Promise<InviterRewardTotal[]>;
  // 수락 시각·id 내림차순이다. afterInviteeId 수락 뒤부터 주고 그 수락이 없거나 남의 것이면 빈 목록이다.
  // status가 null이면 모든 상태다
  abstract listInvitedFriends(params: {
    readonly inviterId: UserId;
    readonly afterInviteeId: UserId | null;
    readonly status: RedemptionStatus | null;
    readonly limit: number;
  }): Promise<InvitedFriend[]>;
  // 아직 알리지 않은 JOINED 중 now 뒤·expiresBefore 이하에 마감되는 수락을 (expiresAt, id) 순서로 읽는다.
  // 초대한 사람이 탈퇴했거나 초대한 사람 보상이 없는 수락은 뺀다
  abstract listQualifyReminderCandidates(params: {
    readonly now: Temporal.Instant;
    readonly expiresBefore: Temporal.Instant;
    // (expiresAt, id) keyset의 마지막 후보
    readonly after: Pick<QualifyReminderCandidate, "expiresAt" | "redemptionId"> | null;
    readonly limit: number;
  }): Promise<QualifyReminderCandidate[]>;
}
