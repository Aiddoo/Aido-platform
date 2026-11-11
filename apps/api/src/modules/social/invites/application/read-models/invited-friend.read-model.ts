import type { RedemptionRejectionReason, RedemptionStatus } from "@aido/api/vocabulary";

import type { CursorPage } from "#api/shared/application/cursor-page";

/** 초대한 친구 목록 한 줄 (사용자·프로필·활동일 수를 한 문장에 읽는다) */
export interface InvitedFriend {
  readonly userId: string;
  readonly name: string | null;
  readonly userTag: string;
  readonly profileImage: string | null;
  readonly status: RedemptionStatus;
  readonly activeDayCount: number;
  readonly joinedAt: Temporal.Instant;
  readonly qualifiedAt: Temporal.Instant | null;
  /** REJECTED가 아니면 null */
  readonly rejectionReason: RedemptionRejectionReason | null;
}

/** 커서는 마지막으로 받은 초대받은 사람 userId다. totalCount는 거른 상태의 전체 수다. */
export interface InvitedFriendsPage extends CursorPage<InvitedFriend, string> {
  readonly totalCount: number;
}
