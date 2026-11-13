import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { CheerId } from "../../domain/cheer-id.vo.js";
import type { CheerReadModel } from "../read-models/cheer.read-model.js";

export interface ListCheersParams {
  readonly userId: UserId;
  readonly afterCheerId: CheerId | null;
  readonly limit: number;
}

// 목록·개수는 서로 차단한 상대와 주고받은 응원을 뺀다
export abstract class CheerReaderPort {
  // 생성 시각·id 내림차순. after 응원 뒤부터 주고, 그 응원이 없으면 빈 목록이다
  abstract listReceived(params: ListCheersParams): Promise<CheerReadModel[]>;
  abstract listSent(params: ListCheersParams): Promise<CheerReadModel[]>;
  abstract countReceived(userId: UserId): Promise<number>;
  abstract countSent(userId: UserId): Promise<number>;
  abstract countUnreadReceived(userId: UserId): Promise<number>;
}
