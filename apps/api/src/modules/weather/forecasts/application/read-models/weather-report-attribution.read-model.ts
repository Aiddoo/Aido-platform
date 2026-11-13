import type { WeatherProvider } from "@aido/api/vocabulary";

interface WeatherReportAttributionLogoSet {
  readonly "1x": string;
  readonly "2x": string;
  readonly "3x": string;
}

export interface WeatherReportAttributionLogo {
  readonly light: WeatherReportAttributionLogoSet;
  readonly dark: WeatherReportAttributionLogoSet;
}

/** 리포트 화면에 함께 보일 공급자 표기(상표 로고·출처 고지). 요청 언어를 따른다 */
export interface WeatherReportAttribution {
  readonly provider: WeatherProvider;
  readonly serviceName: string;
  readonly legalPageUrl: string;
  readonly logo: WeatherReportAttributionLogo | null;
}
