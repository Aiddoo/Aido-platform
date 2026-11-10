import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 반복 회차 리마인더를 보내기 직전에 소유자가 지금 휴면인지 묻는다. 기준은 planning이 소유한다
export abstract class TodoSeriesOwnerDormancyPort {
  /**
   * 무료 사용자가 휴면이면 마지막 활동일(YYYY-MM-DD)을, 아니면 null을 돌려준다. 유료·ADMIN은 휴면이 아니다.
   * 마지막 활동일은 돌아왔다 다시 쉬기 전까지 그대로라 휴면 기간 하나를 가리킨다.
   */
  abstract findDormantSince(userId: UserId): Promise<string | null>;
}
