import type {
  InvitedFriendRecord,
  InviteRedemptionRepositoryPort,
} from "../../ports/invites/invite-redemption.repository.port.js";
import type { InviteConfigPort } from "../../ports/invites/invite.config.port.js";
import { assertInviteEnabled } from "../../services/invites/invite-availability.guard.js";

export interface GetInvitedFriendsInput {
  readonly inviterId: string;
  readonly cursor?: string;
  readonly size: number;
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

/** 한 페이지를 한 SQL로 읽고 전체 수는 상태별 집계 한 번으로 더한다. */
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
      }),
      this.#dependencies.inviteRedemptionRepository.summarizeByInviterId(input.inviterId),
    ]);

    return {
      items: rows.slice(0, input.size),
      totalCount:
        summary.joinedCount +
        summary.qualifiedCount +
        summary.rewardedCount +
        summary.rejectedCount,
      hasMore: rows.length > input.size,
    };
  }
}
