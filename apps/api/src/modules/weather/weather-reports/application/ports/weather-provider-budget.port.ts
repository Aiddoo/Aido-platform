import type { WeatherProviderBudgetState } from "../../domain/weather-provider-budget.domain-service.js";

/** 날씨 공급자의 월 무료 호출 예산. 유료 호출마다 하나씩 예약한다. */
export abstract class WeatherProviderBudgetPort {
  /** 호출 하나를 이번 달 예산에서 뺀다. 예산을 다 썼으면 false이고 호출하지 않는다. */
  abstract reserveCall(): Promise<boolean>;

  /** 이 프로세스가 마지막 예약에서 본 상태. 예약 전(재시작 직후)에는 normal이다. */
  abstract currentState(): WeatherProviderBudgetState;
}
