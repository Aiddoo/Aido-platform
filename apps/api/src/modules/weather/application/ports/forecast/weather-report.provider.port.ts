import type { GeoCell } from "../../../domain/value-objects/forecast/geo-cell.vo.js";
import type { WeatherReportLanguage } from "../../models/forecast/weather-report-language.js";
import type { WeatherReport } from "../../models/forecast/weather-report.model.js";

export const WEATHER_REPORT_PROVIDER = Symbol("WEATHER_REPORT_PROVIDER");

export interface WeatherReportRequest {
  readonly timezone: string;
  /** ISO 3166-1 alpha-2. 모르면 null이며 특보·분 단위 예보가 빠질 수 있다. */
  readonly countryCode: string | null;
  readonly language: WeatherReportLanguage;
  readonly signal?: AbortSignal;
}

/** 칸 중심 좌표의 날씨 스냅샷을 공급자에서 받는다. 실패는 예외로 알린다. */
export interface WeatherReportProviderPort {
  getReport(cell: GeoCell, request: WeatherReportRequest): Promise<WeatherReport>;
}
