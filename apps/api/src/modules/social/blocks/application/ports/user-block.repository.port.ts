import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserBlockId } from "../../domain/user-block-id.vo.js";
import type { UserBlock } from "../../domain/user-block.aggregate.js";

export abstract class UserBlockRepositoryPort {
  abstract nextId(): Promise<UserBlockId>;
  // 탈퇴·비활성 사용자는 차단 대상이 아니다
  abstract existsActiveUser(userId: UserId): Promise<boolean>;
  abstract findByPair(blockerId: UserId, blockedId: UserId): Promise<UserBlock | null>;
  // 두 사람 사이 친구 관계와 대기 중인 요청을 방향·상태와 상관없이 지우고 지운 수를 돌려준다. 차단과 같은 UoW에서 불러 차단 뒤 친구 관계가 남지 않게 한다
  abstract removeFriendshipsBetween(userId: UserId, otherUserId: UserId): Promise<number>;
  abstract save(block: UserBlock): Promise<void>;
  abstract delete(block: UserBlock): Promise<void>;
}
