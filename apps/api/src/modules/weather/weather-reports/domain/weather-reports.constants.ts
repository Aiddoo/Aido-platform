/** 날씨 공급자 월 호출 예산 상태. 아끼는 동안은 리포트를 오래 두고, 다 쓰면 공급자를 부르지 않는다 */
export const WEATHER_PROVIDER_BUDGET_STATES = ["normal", "saving", "exhausted"] as const;
