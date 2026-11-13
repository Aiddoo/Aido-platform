import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserBlock } from "../../domain/user-block.aggregate.js";

export abstract class UserBlockRepositoryPort {
  // 탈퇴·비활성 사용자는 차단 대상이 아니다
  abstract existsActiveUser(userId: UserId): Promise<boolean>;
  abstract findByPair(blockerId: UserId, blockedId: UserId): Promise<UserBlock | null>;
  abstract save(block: UserBlock): Promise<void>;
  abstract delete(block: UserBlock): Promise<void>;
}
