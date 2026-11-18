import { PushTokenCachePort } from "#api/modules/notification/push-devices/application/ports/push-token-cache.port";
import type { UserPreferenceCachePort } from "#api/modules/notification/push-devices/application/ports/user-preference-cache.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 누구의 토큰·설정 캐시를 비웠는지만 남긴다
export class RecordingPushTokenCache extends PushTokenCachePort implements UserPreferenceCachePort {
  readonly invalidatedPushTokenUserIds: string[] = [];
  readonly invalidatedPreferenceUserIds: string[] = [];
  readonly failPushTokenInvalidationFor = new Set<string>();

  async invalidatePushTokens(user: UserId): Promise<void> {
    const userId = user.value;
    this.invalidatedPushTokenUserIds.push(userId);
    if (this.failPushTokenInvalidationFor.has(userId)) {
      throw new Error("synthetic cache failure");
    }
  }

  async invalidateUserPreference(user: UserId): Promise<void> {
    this.invalidatedPreferenceUserIds.push(user.value);
  }
}
