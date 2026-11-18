import type { AppPlatform } from "@aido/api/vocabulary";

import { EntityId } from "#api/shared/domain/model/entity-id";

// 스토어마다 최신 릴리스가 하나라 플랫폼이 곧 식별자다
export class AppReleaseId extends EntityId<AppPlatform> {
  static reconstitute(platform: AppPlatform): AppReleaseId {
    return new AppReleaseId(platform);
  }
}
