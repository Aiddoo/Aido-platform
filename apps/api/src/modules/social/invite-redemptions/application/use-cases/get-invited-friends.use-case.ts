import { REDEMPTION_STATUS, type RedemptionStatus } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import {
  assertInviteEnabled,
  type InviteConfigPort,
} from "#api/modules/social/invites/social-invites.public";
import { clampPageSize, toCursorPage } from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviteRedemptionReaderPort } from "../ports/invite-redemption.reader.port.js";
import type { InviteRedemptionSummary } from "../read-models/invite-redemption-summary.read-model.js";
import type { InvitedFriendsPage } from "../read-models/invited-friend.read-model.js";

export interface GetInvitedFriendsQuery {
  readonly inviterId: string;
  /** 마지막으로 받은 초대받은 사람 userId */
  readonly cursor?: string;
  readonly size?: number;
  /** 없으면 모든 상태 */
  readonly status?: RedemptionStatus;
}

export interface GetInvitedFriendsDependencies {
  readonly inviteRedemptionReader: Pick<
    InviteRedemptionReaderPort,
    "listInvitedFriends" | "summarizeByInviterId"
  >;
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
}

/** 상태로 거르면 그 상태의 수, 아니면 전체 수를 같은 집계에서 고른다. */
function countOf(summary: InviteRedemptionSummary, status: RedemptionStatus | null): number {
  if (status == null) {
    return (
      summary.joinedCount + summary.qualifiedCount + summary.rewardedCount + summary.rejectedCount
    );
  }
  return match(status)
    .with(REDEMPTION_STATUS.JOINED, () => summary.joinedCount)
    .with(REDEMPTION_STATUS.QUALIFIED, () => summary.qualifiedCount)
    .with(REDEMPTION_STATUS.REWARDED, () => summary.rewardedCount)
    .with(REDEMPTION_STATUS.REJECTED, () => summary.rejectedCount)
    .exhaustive();
}

/** 한 페이지를 한 문장으로 읽고 전체 수는 상태별 집계 한 번에서 고른다. */
export class GetInvitedFriendsUseCase {
  readonly #dependencies: GetInvitedFriendsDependencies;

  constructor(dependencies: GetInvitedFriendsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetInvitedFriendsQuery): Promise<InvitedFriendsPage> {
    const { inviteRedemptionReader, inviteConfig } = this.#dependencies;
    assertInviteEnabled(inviteConfig);

    const inviterId = UserId.reconstitute(query.inviterId);
    const size = clampPageSize(query.size);
    const status = query.status ?? null;
    const [friends, summary] = await Promise.all([
      inviteRedemptionReader.listInvitedFriends({
        inviterId,
        afterInviteeId: query.cursor == null ? null : UserId.reconstitute(query.cursor),
        status,
        limit: size + 1,
      }),
      inviteRedemptionReader.summarizeByInviterId(inviterId),
    ]);

    return {
      ...toCursorPage({ rows: friends, size, toCursor: (friend) => friend.userId }),
      totalCount: countOf(summary, status),
    };
  }
}
