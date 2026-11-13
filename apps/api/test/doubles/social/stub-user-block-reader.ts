import {
  UserBlockReaderPort,
  type UserBlockRelation,
} from "#api/modules/social/blocks/social-block-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// blockerId가 blockedId를 차단한 방향 있는 쌍만 들고 차단 관계를 돌려준다
export class StubUserBlockReader extends UserBlockReaderPort {
  readonly #blocks = new Set<string>();

  block(blockerId: string, blockedId: string): void {
    this.#blocks.add(`${blockerId}>${blockedId}`);
  }

  async findRelation(userId: UserId, otherUserId: UserId): Promise<UserBlockRelation> {
    return {
      isBlocking: this.#blocks.has(`${userId.value}>${otherUserId.value}`),
      isBlockedBy: this.#blocks.has(`${otherUserId.value}>${userId.value}`),
    };
  }

  async findBlockedCounterpartIds(
    viewerId: UserId,
    candidateUserIds: readonly UserId[],
  ): Promise<ReadonlySet<string>> {
    return new Set(
      candidateUserIds
        .map((candidateId) => candidateId.value)
        .filter(
          (candidateId) =>
            this.#blocks.has(`${viewerId.value}>${candidateId}`) ||
            this.#blocks.has(`${candidateId}>${viewerId.value}`),
        ),
    );
  }
}
