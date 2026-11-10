import {
  UserBlockReaderPort,
  type UserBlockRelation,
} from "#api/modules/social/blocks/social-blocks.public";

// blockerId가 blockedId를 차단한 방향 있는 쌍만 들고 차단 관계를 돌려준다
export class StubUserBlockReader extends UserBlockReaderPort {
  readonly #blocks = new Set<string>();

  block(blockerId: string, blockedId: string): void {
    this.#blocks.add(`${blockerId}>${blockedId}`);
  }

  async findRelation(userId: string, otherUserId: string): Promise<UserBlockRelation> {
    return {
      isBlocking: this.#blocks.has(`${userId}>${otherUserId}`),
      isBlockedBy: this.#blocks.has(`${otherUserId}>${userId}`),
    };
  }

  async findBlockedCounterpartIds(
    viewerId: string,
    candidateUserIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    return new Set(
      candidateUserIds.filter(
        (candidateId) =>
          this.#blocks.has(`${viewerId}>${candidateId}`) ||
          this.#blocks.has(`${candidateId}>${viewerId}`),
      ),
    );
  }
}
