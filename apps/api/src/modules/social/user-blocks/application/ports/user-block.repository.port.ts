import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserBlock } from "../../domain/user-block.aggregate.js";

export abstract class UserBlockRepositoryPort {
  abstract findByPair(blockerId: UserId, blockedId: UserId): Promise<UserBlock | null>;
  abstract save(block: UserBlock): Promise<void>;
  abstract delete(block: UserBlock): Promise<void>;
}
