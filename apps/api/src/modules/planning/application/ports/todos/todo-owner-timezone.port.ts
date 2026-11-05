export const TODO_OWNER_TIMEZONE = Symbol("TODO_OWNER_TIMEZONE");

export interface TodoOwnerTimezonePort {
  /** 저장된 값 그대로의 시간대. 탈퇴했거나 설정이 없으면 null이다. 캐시를 거치지 않는다. */
  findTimezone(userId: string): Promise<string | null>;
}
