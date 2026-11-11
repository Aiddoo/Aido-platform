import type { PrecipitationType, SkyCondition } from "@aido/api/vocabulary";

export interface HourlyForecast {
  readonly hour: number;
  readonly temperature: number;
  readonly skyCondition: string;
  readonly precipitationProbability: number;
  readonly precipitationAmount: number;
  readonly snowAmount: number;
}

export interface DailyForecast {
  readonly date: string; // "YYYY-MM-DD"
  readonly skyCondition: SkyCondition;
  readonly precipitationType: PrecipitationType;
  readonly precipitationProbability: number;
  readonly temperatureMin: number;
  readonly temperatureMax: number;
}

/** KMA 단기예보를 공급자 중립으로 정리한 하루치 예보(v1). */
export interface WeatherForecast {
  readonly date: Date;
  readonly skyCondition: SkyCondition;
  readonly precipitationType: PrecipitationType;
  readonly precipitationProbability: number;
  readonly temperatureMin: number;
  readonly temperatureMax: number;
  readonly humidity: number;
  readonly windSpeed: number;
  readonly hourlyForecasts: readonly HourlyForecast[];
  readonly dailyForecasts: readonly DailyForecast[];
}

export interface WeatherConditions {
  readonly feelsLikeTemperature: number | null;
  readonly uvIndex: number | null;
  readonly sunrise: string | null;
  readonly sunset: string | null;
  readonly pm10: number | null;
  readonly pm25: number | null;
}
