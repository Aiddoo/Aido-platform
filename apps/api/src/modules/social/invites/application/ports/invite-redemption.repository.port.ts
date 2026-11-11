import type { RedemptionStatus } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import type { InviteRedemption } from "../../domain/invite-redemption.aggregate.js";
import type { InviteRedemptionSummary } from "../read-models/invite-redemption-summary.read-model.js";
import type { InvitedFriend } from "../read-models/invited-friend.read-model.js";
import type { QualifyReminderCandidate } from "../read-models/qualify-reminder-candidate.read-model.js";

export abstract class InviteRedemptionRepositoryPort {
  abstract nextId(): Promise<InviteRedemptionId>;
  /** 새 수락을 저장한다. 같은 초대받은 사람의 수락이 이미 있으면(inviteeId UNIQUE) 저장하지 않고 false다. */
  abstract add(redemption: InviteRedemption): Promise<boolean>;
  /** add한 수락의 상태·시각을 덮어쓰고 새 활동일을 더한다. 이미 있는 활동일은 그대로 둔다. */
  abstract save(redemption: InviteRedemption): Promise<void>;
  /** 할 일 완료마다 불리므로 inviteeId UNIQUE 인덱스만 확인한다. */
  abstract existsJoinedByInviteeId(inviteeId: UserId): Promise<boolean>;
  abstract findByInviteeIdForUpdate(inviteeId: UserId): Promise<InviteRedemption | null>;
  abstract findByIdForUpdate(redemptionId: InviteRedemptionId): Promise<InviteRedemption | null>;
  abstract summarizeByInviterId(inviterId: UserId): Promise<InviteRedemptionSummary>;
  /**
   * 수락 시각·id 내림차순이다. afterInviteeId 수락 뒤부터 주고 그 수락이 없거나 남의 것이면 빈 목록이다.
   * status가 null이면 모든 상태다.
   */
  abstract listInvitedFriends(params: {
    readonly inviterId: UserId;
    readonly afterInviteeId: UserId | null;
    readonly status: RedemptionStatus | null;
    readonly limit: number;
  }): Promise<InvitedFriend[]>;
  /** 마감이 at 이하인 JOINED를 (expiresAt, id) 순서로 한 묶음씩 SKIP LOCKED로 거절하고 처리 수를 반환한다. */
  abstract expireJoinedBefore(at: Temporal.Instant, limit: number): Promise<number>;
  /**
   * 아직 알리지 않은 JOINED 중 now 뒤·expiresBefore 이하에 마감되는 수락을 (expiresAt, id) 순서로 읽는다.
   * 초대한 사람이 탈퇴했거나 초대한 사람 보상이 없는 수락은 뺀다.
   */
  abstract listQualifyReminderCandidates(params: {
    readonly now: Temporal.Instant;
    readonly expiresBefore: Temporal.Instant;
    /** (expiresAt, id) keyset의 마지막 후보 */
    readonly after: Pick<QualifyReminderCandidate, "expiresAt" | "redemptionId"> | null;
    readonly limit: number;
  }): Promise<QualifyReminderCandidate[]>;
}
