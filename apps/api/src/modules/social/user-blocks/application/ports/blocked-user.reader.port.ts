import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserBlockId } from "../../domain/user-block-id.vo.js";
import type { BlockedUserReadModel } from "../read-models/blocked-user.read-model.js";

// 탈퇴 중인 사용자는 목록·개수 모두에서 뺀다
export abstract class BlockedUserReaderPort {
  // 최근에 차단한 순서(차단 시각·id 내림차순)다. after 차단 뒤부터 주고 그 차단이 없거나 남의 것이면 빈 목록이다
  abstract listByBlockerId(params: {
    readonly blockerId: UserId;
    readonly afterBlockId: UserBlockId | null;
    readonly limit: number;
  }): Promise<BlockedUserReadModel[]>;
  abstract countByBlockerId(blockerId: UserId): Promise<number>;
}
