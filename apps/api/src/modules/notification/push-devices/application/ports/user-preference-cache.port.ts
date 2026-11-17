import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// user-settings가 소유한 키다. 푸시 기기 보고가 시간대·언어 설정 행을 바꿀 때 함께 비운다
export abstract class UserPreferenceCachePort {
  abstract invalidateUserPreference(userId: UserId): Promise<void>;
}
