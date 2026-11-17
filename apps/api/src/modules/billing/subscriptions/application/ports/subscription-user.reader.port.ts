import type { SubscriptionUserReadModel } from "../read-models/subscription-user.read-model.js";

/** 스토어 이벤트의 appUserId는 User.id이거나 별칭(storeAppUserId)이다. 여러 ID를 한 문장으로 읽는다. */
export abstract class SubscriptionUserReaderPort {
  /** 앞선 ID부터 보고 처음 우리 사용자로 이어지는 ID의 사용자다. 없으면 null이다. */
  abstract findFirstByAppUserIds(
    appUserIds: readonly string[],
  ): Promise<SubscriptionUserReadModel | null>;
  /** 우리 사용자로 이어지는 ID의 사용자를 앞선 ID 순으로 주고, 같은 사용자는 한 번만 준다. */
  abstract listByAppUserIds(appUserIds: readonly string[]): Promise<SubscriptionUserReadModel[]>;
}
