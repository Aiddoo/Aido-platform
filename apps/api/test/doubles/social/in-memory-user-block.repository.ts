import { UserBlockRepositoryPort } from "#api/modules/social/blocks/application/ports/user-block.repository.port";
import { UserBlockId } from "#api/modules/social/blocks/domain/user-block-id.vo";
import { UserBlock } from "#api/modules/social/blocks/domain/user-block.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

interface FollowEdge {
  readonly followerId: string;
  readonly followingId: string;
}

// 저장 사본을 두어 save 없이 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(block: UserBlock): UserBlock {
  return UserBlock.reconstitute(block.toPrimitives());
}

// 친구 관계는 방향 있는 follow 행 목록으로만 들고, 차단이 지우는 것만 흉내 낸다
export class InMemoryUserBlockRepository extends UserBlockRepositoryPort {
  readonly #blocks = new Map<string, UserBlock>();
  readonly #activeUserIds: ReadonlySet<string>;
  #follows: FollowEdge[] = [];
  #sequence = 0;

  constructor(
    params: {
      readonly blocks?: readonly UserBlock[];
      readonly activeUserIds?: readonly string[];
    } = {},
  ) {
    super();
    for (const block of params.blocks ?? []) {
      this.#blocks.set(block.id.value, copyOf(block));
    }
    this.#activeUserIds = new Set(params.activeUserIds ?? []);
  }

  get size(): number {
    return this.#blocks.size;
  }

  get followCount(): number {
    return this.#follows.length;
  }

  seedFollow(followerId: string, followingId: string): void {
    this.#follows.push({ followerId, followingId });
  }

  async nextId(): Promise<UserBlockId> {
    this.#sequence += 1;
    return UserBlockId.reconstitute(`cinmem${String(this.#sequence).padStart(19, "0")}`);
  }

  async existsActiveUser(userId: UserId): Promise<boolean> {
    return this.#activeUserIds.has(userId.value);
  }

  async findByPair(blockerId: UserId, blockedId: UserId): Promise<UserBlock | null> {
    const found = [...this.#blocks.values()].find(
      (block) => block.blockerId.equals(blockerId) && block.blockedId.equals(blockedId),
    );
    return found == null ? null : copyOf(found);
  }

  async removeFriendshipsBetween(userId: UserId, otherUserId: UserId): Promise<number> {
    const isBetween = (edge: FollowEdge) =>
      (edge.followerId === userId.value && edge.followingId === otherUserId.value) ||
      (edge.followerId === otherUserId.value && edge.followingId === userId.value);
    const removedCount = this.#follows.filter(isBetween).length;
    this.#follows = this.#follows.filter((edge) => !isBetween(edge));
    return removedCount;
  }

  async save(block: UserBlock): Promise<void> {
    if (!this.#blocks.has(block.id.value)) {
      this.#blocks.set(block.id.value, copyOf(block));
    }
  }

  async delete(block: UserBlock): Promise<void> {
    this.#blocks.delete(block.id.value);
  }
}
