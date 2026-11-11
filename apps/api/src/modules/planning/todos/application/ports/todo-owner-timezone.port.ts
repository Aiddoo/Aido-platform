import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class TodoOwnerTimezonePort {
  /** 저장된 값 그대로의 시간대. 탈퇴했거나 설정이 없으면 null이다. 캐시를 거치지 않는다. */
  abstract findTimezone(userId: UserId): Promise<string | null>;
}
