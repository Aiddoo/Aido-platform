export const WEATHER_PROVIDER = Symbol("WEATHER_PROVIDER");

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
  readonly skyCondition: "CLEAR" | "PARTLY_CLOUDY" | "CLOUDY";
  readonly precipitationType: "NONE" | "RAIN" | "RAIN_SNOW" | "SNOW" | "SHOWER";
  readonly precipitationProbability: number;
  readonly temperatureMin: number;
  readonly temperatureMax: number;
}

export interface WeatherForecast {
  readonly date: Date;
  readonly skyCondition: "CLEAR" | "PARTLY_CLOUDY" | "CLOUDY";
  readonly precipitationType: "NONE" | "RAIN" | "RAIN_SNOW" | "SNOW" | "SHOWER";
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

/** 공급자 중립 예보 계약. 현재 KMA 단일 binding이며 새 지역 지원은 별도 작업이다. */
export interface WeatherProvider {
  /** 프로바이더 식별자 (예: "kma", "openweathermap") — 지역 라우팅·로깅용. */
  readonly name: string;
  /** 정규화한 시간별 예보의 지역 시간대. */
  readonly timeZone: string;
  /** WGS84 위경도로 예보를 조회한다 (격자 변환은 어댑터 내부 책임). */
  getForecast(lat: number, lon: number, date: Date): Promise<WeatherForecast>;
  /** 필수 자격(API 키 등) 구성 여부 — 지역 라우팅 시 가용성 판단. */
  isConfigured(): boolean;
}
