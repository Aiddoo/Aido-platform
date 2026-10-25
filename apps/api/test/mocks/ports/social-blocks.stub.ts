import type {
  UserBlockReaderPort,
  UserBlockRelation,
} from "#api/modules/social/application/ports/blocks/user-block-reader.port";
import type {
  BlockedUserRecord,
  FindBlockedUsersParams,
  UserBlockRepositoryPort,
} from "#api/modules/social/application/ports/blocks/user-block.repository.port";
import {
  UserBlock,
  type UserBlockCreationPlan,
  type UserBlockProps,
} from "#api/modules/social/domain/aggregates/blocks/user-block.aggregate";

import type { StubFollowRepository } from "./social-friends.stub.js";

let blockSequence = 0;

/** 차단 저장소와 공개 reader를 함께 흉내 낸다. 친구 관계는 같은 fixture의 follow stub에서 지운다. */
export class StubUserBlockRepository implements UserBlockRepositoryPort, UserBlockReaderPort {
  readonly blocks = new Map<string, UserBlockProps>();

  constructor(private readonly followRepository: StubFollowRepository) {}

  seed(blockerId: string, blockedId: string, createdAt = new Date()): UserBlockProps {
    blockSequence += 1;
    const props = { id: `block-${blockSequence}`, blockerId, blockedId, createdAt };
    this.blocks.set(props.id, props);
    return structuredClone(props);
  }

  async userExists(userId: string): Promise<boolean> {
    return this.followRepository.users.has(userId);
  }

  async findByPair(blockerId: string, blockedId: string): Promise<UserBlock | null> {
    const props = this.#find(blockerId, blockedId);
    return props == null ? null : UserBlock.reconstitute(props);
  }

  async create(plan: UserBlockCreationPlan): Promise<UserBlock> {
    return UserBlock.reconstitute(this.seed(plan.blockerId, plan.blockedId, plan.createdAt));
  }

  async delete(blockerId: string, blockedId: string): Promise<boolean> {
    const props = this.#find(blockerId, blockedId);
    return props == null ? false : this.blocks.delete(props.id);
  }

  async removeFriendshipsBetween(userId: string, otherUserId: string): Promise<number> {
    const between = [...this.followRepository.follows.values()].filter(
      (follow) =>
        (follow.followerId === userId && follow.followingId === otherUserId) ||
        (follow.followerId === otherUserId && follow.followingId === userId),
    );
    for (const follow of between) {
      this.followRepository.follows.delete(follow.id);
    }
    return between.length;
  }

  async findBlockedUsers(params: FindBlockedUsersParams): Promise<BlockedUserRecord[]> {
    return [...this.blocks.values()]
      .filter((block) => block.blockerId === params.blockerId)
      .toSorted((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, params.size + 1)
      .flatMap((block) => {
        const user = this.followRepository.users.get(block.blockedId);
        return user == null ? [] : [{ id: block.id, blockedAt: block.createdAt, user }];
      });
  }

  async countBlockedUsers(blockerId: string): Promise<number> {
    return [...this.blocks.values()].filter((block) => block.blockerId === blockerId).length;
  }

  async findRelation(userId: string, otherUserId: string): Promise<UserBlockRelation> {
    return {
      isBlocking: this.#find(userId, otherUserId) != null,
      isBlockedBy: this.#find(otherUserId, userId) != null,
    };
  }

  async findBlockedCounterpartIds(
    viewerId: string,
    candidateUserIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    return new Set(
      candidateUserIds.filter(
        (userId) => this.#find(viewerId, userId) != null || this.#find(userId, viewerId) != null,
      ),
    );
  }

  #find(blockerId: string, blockedId: string): UserBlockProps | undefined {
    return [...this.blocks.values()].find(
      (block) => block.blockerId === blockerId && block.blockedId === blockedId,
    );
  }
}
