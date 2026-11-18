/** 자격이 설정되지 않은 환경. 호출자는 일반 공급자 실패처럼 폴백·WEATHER_1901로 처리한다. */
export class WeatherKitNotConfiguredError extends Error {
  constructor() {
    super("WeatherKit credentials are not configured");
    this.name = "WeatherKitNotConfiguredError";
  }
}

export type WeatherKitFailureReason =
  | "http_failure"
  | "auth_rejected"
  | "invalid_structure"
  | "missing_current"
  | "recent_failure"
  | "provider_outage"
  | "provider_busy"
  | "budget_exhausted";

/** 429·5xx·인증 거절·형식 오류 모두 호출자에게는 같은 공급자 실패이며 폴백 대상이다. */
export class WeatherKitRequestError extends Error {
  readonly reason: WeatherKitFailureReason;
  readonly status: number | null;

  constructor(reason: WeatherKitFailureReason, status: number | null = null) {
    super(`WeatherKit request failed: ${reason}`);
    this.name = "WeatherKitRequestError";
    this.reason = reason;
    this.status = status;
  }
}

/** attribution 응답이 2xx가 아니거나(status) 월 예산을 다 써 보내지 않았을 때(null). 응답 본문은 담지 않는다. */
export class WeatherKitAttributionRequestError extends Error {
  readonly status: number | null;

  constructor(status: number | null) {
    super(`WeatherKit attribution request failed: ${status ?? "budget_exhausted"}`);
    this.name = "WeatherKitAttributionRequestError";
    this.status = status;
  }
}
