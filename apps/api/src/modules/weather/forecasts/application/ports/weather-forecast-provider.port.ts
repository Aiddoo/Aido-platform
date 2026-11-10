import type { KmaForecastTiming } from "../../domain/kma-forecast-availability.domain-service.js";
import type { WeatherForecast } from "../read-models/weather-forecast.read-model.js";

/** 공급자 중립 예보 계약. 현재 KMA 단일 binding이며 새 지역 지원은 별도 작업이다. */
export abstract class WeatherForecastProviderPort {
  /** 프로바이더 식별자 (예: "kma", "openweathermap") — 지역 라우팅·로깅용. */
  abstract readonly name: string;
  /** 정규화한 시간별 예보의 지역 시간대. */
  abstract readonly timeZone: string;
  /** WGS84 위경도로 timing.target 날짜의 예보를 timing.issuance 발표에서 조회한다. */
  abstract getForecast(
    lat: number,
    lon: number,
    timing: KmaForecastTiming,
  ): Promise<WeatherForecast>;
  /** 필수 자격(API 키 등) 구성 여부 — 지역 라우팅 시 가용성 판단. */
  abstract isConfigured(): boolean;
}
