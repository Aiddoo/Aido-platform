import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import type { InviteRedemption } from "../../domain/invite-redemption.aggregate.js";

export abstract class InviteRedemptionRepositoryPort {
  // 할 일 완료마다 불리므로 inviteeId UNIQUE 인덱스만 확인한다
  abstract existsJoinedByInviteeId(inviteeId: UserId): Promise<boolean>;
  abstract findByInviteeIdForUpdate(inviteeId: UserId): Promise<InviteRedemption | null>;
  abstract findByIdForUpdate(redemptionId: InviteRedemptionId): Promise<InviteRedemption | null>;
  // 상태·시각을 덮어쓰고 새 활동일을 더한다(있는 활동일은 그대로). 같은 초대받은 사람의 다른 수락이 이미
  // 있으면(inviteeId UNIQUE) INVITE_2104로 거절한다
  abstract save(redemption: InviteRedemption): Promise<void>;
  // 마감이 at 이하인 JOINED를 (expiresAt, id) 순서로 한 묶음씩 SKIP LOCKED로 거절하고 처리 수를 반환한다.
  // 수백 행을 한 문장으로 바꾸는 정비 경로라 작업 원장 묶음 연산으로 둔다
  abstract expireJoinedBefore(at: Temporal.Instant, limit: number): Promise<number>;
}
