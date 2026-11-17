import type { RedemptionStatus } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InvitedFriendReadModel } from "../read-models/invited-friend.read-model.js";

export abstract class InvitedFriendReaderPort {
  // 수락 시각·id 내림차순이다. afterInviteeId 수락 뒤부터 주고 그 수락이 없거나 남의 것이면 빈 목록이다.
  // status가 null이면 모든 상태다
  abstract listInvitedFriends(params: {
    readonly inviterId: UserId;
    readonly afterInviteeId: UserId | null;
    readonly status: RedemptionStatus | null;
    readonly limit: number;
  }): Promise<InvitedFriendReadModel[]>;
}
