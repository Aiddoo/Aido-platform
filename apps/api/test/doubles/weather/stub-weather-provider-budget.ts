import { WeatherProviderBudgetPort } from "#api/modules/weather/weather-reports/application/ports/weather-provider-budget.port";
import type { WeatherProviderBudgetState } from "#api/modules/weather/weather-reports/domain/weather-provider-budget.domain-service";

/** 정한 상태를 돌려주고, 다 쓴 상태가 아니면 예약을 받는다. */
export class StubWeatherProviderBudget extends WeatherProviderBudgetPort {
  state: WeatherProviderBudgetState = "normal";

  async reserveCall(): Promise<boolean> {
    return this.state !== "exhausted";
  }

  currentState(): WeatherProviderBudgetState {
    return this.state;
  }
}
