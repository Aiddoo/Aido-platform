export const TODO_SERIES_OWNER_DORMANCY = Symbol("TODO_SERIES_OWNER_DORMANCY");

/** 반복 회차 리마인더를 보내기 직전에 소유자가 지금 휴면인지 묻는다. 기준은 planning이 소유한다. */
export interface TodoSeriesOwnerDormancyPort {
  isOwnerDormant(userId: string): Promise<boolean>;
}
