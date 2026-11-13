import { STORE_PERIOD_TYPES, type StorePeriodType } from "@aido/api/vocabulary";

/** 저장·공급자의 기간 유형 문자열을 알려진 값으로 읽는다. 모르는 값은 null이다. */
export function toStorePeriodType(value: string | null | undefined): StorePeriodType | null {
  return STORE_PERIOD_TYPES.find((periodType) => periodType === value) ?? null;
}
