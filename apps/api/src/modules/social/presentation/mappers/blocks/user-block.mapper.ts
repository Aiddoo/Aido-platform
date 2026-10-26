import type { BlockedUser } from "@aido/api";

import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";
import { toISOString } from "#api/shared/domain/date/utils/format";

import type { BlockedUserRecord } from "../../../application/ports/blocks/user-block.repository.port.js";

export abstract class UserBlockMapper {
  static toBlockedUser(record: BlockedUserRecord, appVersion?: string): BlockedUser {
    return {
      id: record.user.id,
      userTag: record.user.userTag,
      name: record.user.profile?.name ?? null,
      profileImage: resolveProfileImage(record.user.profile?.profileImage ?? null, appVersion),
      blockedAt: toISOString(record.blockedAt),
    };
  }
}
