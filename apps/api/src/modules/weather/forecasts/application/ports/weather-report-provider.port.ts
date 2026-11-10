import type { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import type { WeatherReportLanguage } from "../../domain/weather-report-language.domain-service.js";
import type { WeatherReport, WeatherReportAttribution } from "../../domain/weather-report.vo.js";

export interface WeatherReportRequest {
  readonly timezone: string;
  /** ISO 3166-1 alpha-2. 모르면 null이며 특보·분 단위 예보가 빠질 수 있다. */
  readonly countryCode: string | null;
  readonly language: WeatherReportLanguage;
  readonly signal?: AbortSignal;
}

/** 칸 중심 좌표의 날씨 스냅샷을 공급자에서 받는다. 실패는 예외로 알린다. */
export abstract class WeatherReportProviderPort {
  abstract getReport(cell: GeoCell, request: WeatherReportRequest): Promise<WeatherReport>;

  /** 이 칸의 응답에 요청 언어로 번역되는 문구(특보 제목)가 있는지. 없으면 언어별로 캐시를 나누지 않는다. */
  abstract localizesContent(cell: GeoCell, request: WeatherReportRequest): Promise<boolean>;

  /**
   * 공급자 표기(상표 로고·출처 고지)는 요청 언어를 따르므로 언어 공유 캐시 리포트와 따로 받는다.
   * 로고를 받지 못해도 실패하지 않고 logo만 null로 돌려준다.
   */
  abstract getAttribution(language: WeatherReportLanguage): Promise<WeatherReportAttribution>;
}
