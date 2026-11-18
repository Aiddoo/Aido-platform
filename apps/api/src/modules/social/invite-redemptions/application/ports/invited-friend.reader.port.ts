import type { RedemptionStatus } from "@aido/api/vocabulary";

import type { CursorPage } from "#api/shared/application/cursor-page";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InvitedFriendReadModel } from "../read-models/invited-friend.read-model.js";

export abstract class InvitedFriendReaderPort {
  // 수락 시각·id 내림차순이다. afterInviteeId 수락 뒤부터 주고 그 수락이 없거나 남의 것이면 빈 쪽이다.
  // status가 null이면 모든 상태다. 커서는 초대받은 사람 id다
  abstract listInvitedFriends(params: {
    readonly inviterId: UserId;
    readonly afterInviteeId: UserId | null;
    readonly status: RedemptionStatus | null;
    readonly size: number;
  }): Promise<CursorPage<InvitedFriendReadModel, string>>;
}
