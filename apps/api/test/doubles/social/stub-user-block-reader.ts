import {
  UserBlockReaderPort,
  type UserBlockRelation,
} from "#api/modules/social/user-blocks/social-user-blocks.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

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

  async listCounterpartIds(userId: UserId): Promise<UserId[]> {
    const counterpartIds = [...this.#blocks].flatMap((pair) => {
      const [blockerId, blockedId] = pair.split(">");
      if (blockerId === userId.value && blockedId != null) {
        return [blockedId];
      }
      if (blockedId === userId.value && blockerId != null) {
        return [blockerId];
      }
      return [];
    });
    return [...new Set(counterpartIds)].map((counterpartId) => UserId.reconstitute(counterpartId));
  }
}
