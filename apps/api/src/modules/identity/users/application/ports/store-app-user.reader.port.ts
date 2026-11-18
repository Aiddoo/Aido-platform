import type { StoreAppUserId } from "../../domain/store-app-user-id.vo.js";
import type { StoreAppUserReadModel } from "../read-models/store-app-user.read-model.js";

/** 스토어 앱 사용자 ID는 User.id이거나 별칭(storeAppUserId)이다. 여러 ID를 한 문장으로 읽는다 */
export abstract class StoreAppUserReaderPort {
  /** 우리 사용자로 이어지는 ID의 사용자를 앞선 ID 순으로 주고, 같은 사용자는 한 번만 준다 */
  abstract listByStoreAppUserIds(
    storeAppUserIds: readonly StoreAppUserId[],
  ): Promise<StoreAppUserReadModel[]>;
}
