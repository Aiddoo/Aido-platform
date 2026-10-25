import { REDEMPTION_STATUS, type RedemptionStatus } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type {
  InvitedFriendRecord,
  InviteRedemptionRepositoryPort,
  InviteRedemptionSummary,
} from "../../ports/invites/invite-redemption.repository.port.js";
import type { InviteConfigPort } from "../../ports/invites/invite.config.port.js";
import { assertInviteEnabled } from "../../services/invites/invite-availability.guard.js";

export interface GetInvitedFriendsInput {
  readonly inviterId: string;
  readonly cursor?: string;
  readonly size: number;
  readonly status?: RedemptionStatus;
}

export interface InvitedFriendsPage {
  readonly items: readonly InvitedFriendRecord[];
  readonly totalCount: number;
  readonly hasMore: boolean;
}

interface GetInvitedFriendsDependencies {
  readonly inviteRedemptionRepository: Pick<
    InviteRedemptionRepositoryPort,
    "findInvitedFriends" | "summarizeByInviterId"
  >;
  readonly inviteConfig: InviteConfigPort;
}

/** 한 페이지를 한 문장으로 읽고 전체 수는 상태별 집계 한 번에서 고른다. */
export class GetInvitedFriends {
  readonly #dependencies: GetInvitedFriendsDependencies;

  constructor(dependencies: GetInvitedFriendsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetInvitedFriendsInput): Promise<InvitedFriendsPage> {
    assertInviteEnabled(this.#dependencies.inviteConfig);

    const [rows, summary] = await Promise.all([
      this.#dependencies.inviteRedemptionRepository.findInvitedFriends({
        inviterId: input.inviterId,
        cursor: input.cursor,
        size: input.size + 1,
        status: input.status,
      }),
      this.#dependencies.inviteRedemptionRepository.summarizeByInviterId(input.inviterId),
    ]);

    return {
      items: rows.slice(0, input.size),
      totalCount: countOf(summary, input.status),
      hasMore: rows.length > input.size,
    };
  }
}

/** 상태로 거르면 그 상태의 수, 아니면 전체 수를 같은 집계에서 고른다. */
function countOf(summary: InviteRedemptionSummary, status: RedemptionStatus | undefined): number {
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
