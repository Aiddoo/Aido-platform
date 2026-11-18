import type { WeatherReport } from "../../domain/weather-report.aggregate.js";

export interface CellWeatherReportReadModel {
  readonly report: WeatherReport;
  /** 서버가 이 칸 리포트를 공급자에서 다시 받기 시작하는 순간. 마지막 성공 리포트로 폴백했으면 null */
  readonly expiresAt: Temporal.Instant | null;
}
