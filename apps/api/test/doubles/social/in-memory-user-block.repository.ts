import { UserBlockRepositoryPort } from "#api/modules/social/blocks/application/ports/user-block.repository.port";
import { UserBlock } from "#api/modules/social/blocks/domain/user-block.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 저장 사본을 두어 save 없이 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(block: UserBlock): UserBlock {
  return UserBlock.reconstitute(block.toPrimitives());
}

export class InMemoryUserBlockRepository extends UserBlockRepositoryPort {
  readonly #blocks = new Map<string, UserBlock>();
  readonly #activeUserIds: ReadonlySet<string>;

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

  async existsActiveUser(userId: UserId): Promise<boolean> {
    return this.#activeUserIds.has(userId.value);
  }

  async findByPair(blockerId: UserId, blockedId: UserId): Promise<UserBlock | null> {
    const found = [...this.#blocks.values()].find(
      (block) => block.blockerId.equals(blockerId) && block.blockedId.equals(blockedId),
    );
    return found == null ? null : copyOf(found);
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
