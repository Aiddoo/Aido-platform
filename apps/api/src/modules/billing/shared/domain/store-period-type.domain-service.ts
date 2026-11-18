import { STORE_PERIOD_TYPES, type StorePeriodType } from "@aido/api/vocabulary";

/** STORE_PERIOD_TYPES의 값을 이름으로 가리킨다. 문자열을 직접 비교하지 않도록 쓴다. */
export const STORE_PERIOD_TYPE = {
  TRIAL: "TRIAL",
  INTRO: "INTRO",
  NORMAL: "NORMAL",
  PROMOTIONAL: "PROMOTIONAL",
  PREPAID: "PREPAID",
} as const satisfies Record<StorePeriodType, StorePeriodType>;

/** 저장·공급자의 기간 유형 문자열을 알려진 값으로 읽는다. 모르는 값은 null이다. */
export function toStorePeriodType(value: string | null | undefined): StorePeriodType | null {
  return STORE_PERIOD_TYPES.find((periodType) => periodType === value) ?? null;
}
