import { EntityId } from "#api/shared/domain/model/entity-id";

import type { AppReleasePlatform } from "./app-versions.constants.js";

// 스토어마다 최신 릴리스가 하나라 플랫폼이 곧 식별자다
export class AppReleaseId extends EntityId<AppReleasePlatform> {
  static reconstitute(platform: AppReleasePlatform): AppReleaseId {
    return new AppReleaseId(platform);
  }
}
