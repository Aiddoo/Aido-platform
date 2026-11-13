import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 주차 라벨의 올해를 정할 사용자의 저장 시간대. 설정이 없으면 기본값이다 */
export abstract class AchievementOwnerTimezoneReaderPort {
  abstract read(userId: UserId): Promise<string>;
}
