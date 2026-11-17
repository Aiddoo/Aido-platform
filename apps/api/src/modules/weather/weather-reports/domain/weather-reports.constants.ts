/** 저녁 날씨 알림이 내일 비·눈이 시작하는 때로 고르는 하루 구분(알림 시간대). 경계는 `WEATHER_BRIEFING_RULES`다 */
export const WEATHER_DAY_PARTS = ["dawn", "morning", "afternoon", "evening"] as const;

/** 아침 날씨 알림이 할 일과 겹친 날씨를 부르는 종류 */
export const WEATHER_WET_HAZARDS = ["rain", "storm", "snow"] as const;

/** 날씨 공급자 월 호출 예산 상태. 아끼는 동안은 리포트를 오래 두고, 다 쓰면 공급자를 부르지 않는다 */
export const WEATHER_PROVIDER_BUDGET_STATES = ["normal", "saving", "exhausted"] as const;
