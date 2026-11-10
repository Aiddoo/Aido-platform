import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserLocation } from "../../domain/user-location.entity.js";

export abstract class UserLocationRepositoryPort {
  abstract findByUserId(userId: UserId): Promise<UserLocation | null>;
  /** 사용자당 위치는 하나라 있으면 덮어쓴다. */
  abstract save(location: UserLocation): Promise<void>;
}
