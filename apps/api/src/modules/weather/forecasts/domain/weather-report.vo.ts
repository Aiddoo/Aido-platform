import {
  type WeatherAlertSeverity,
  type WeatherCondition,
  type WeatherMoonPhase,
  type WeatherNextHourCondition,
  type WeatherPrecipitationType,
  type WeatherPressureTrend,
  type WeatherProvider,
} from "@aido/api/vocabulary";

/** 공급자 중립 날씨 스냅샷. 단위는 °C·m/s·mm·hPa·m, 확률·비율은 0~100 정수다. */
export interface WeatherReport {
  readonly current: WeatherReportCurrent;
  readonly nextHour: WeatherReportNextHour | null;
  readonly hourly: readonly WeatherReportHour[];
  readonly daily: readonly WeatherReportDay[];
  readonly alerts: readonly WeatherReportAlert[];
  readonly fetchedAt: Date;
}

export interface WeatherReportCurrent {
  readonly observedAt: Date;
  readonly condition: WeatherCondition;
  readonly isDaylight: boolean;
  readonly temperature: number;
  readonly apparentTemperature: number;
  readonly dewPoint: number;
  readonly humidity: number;
  readonly cloudCover: number;
  readonly uvIndex: number;
  readonly windSpeed: number;
  readonly windGust: number | null;
  readonly windDirection: number | null;
  readonly visibility: number;
  readonly pressure: number;
  readonly pressureTrend: WeatherPressureTrend;
  readonly precipitationIntensity: number;
}

export interface WeatherReportNextHour {
  readonly periods: readonly WeatherReportNextHourPeriod[];
  readonly minutes: readonly WeatherReportMinute[];
}

interface WeatherReportNextHourPeriod {
  readonly condition: WeatherNextHourCondition;
  /** 공급자가 형태 없이 강수로만 알리면 null */
  readonly precipitationType: WeatherPrecipitationType | null;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly precipitationChance: number;
  readonly precipitationIntensity: number;
}

interface WeatherReportMinute {
  readonly startsAt: Date;
  readonly precipitationChance: number;
  readonly precipitationIntensity: number;
}

export interface WeatherReportHour {
  readonly startsAt: Date;
  readonly condition: WeatherCondition;
  readonly isDaylight: boolean;
  readonly temperature: number;
  readonly apparentTemperature: number;
  readonly humidity: number;
  readonly uvIndex: number;
  readonly windSpeed: number;
  readonly windDirection: number | null;
  readonly precipitationChance: number;
  readonly precipitationAmount: number;
  readonly precipitationType: WeatherPrecipitationType;
}

export interface WeatherReportDayPart {
  readonly condition: WeatherCondition;
  readonly temperatureMin: number | null;
  readonly temperatureMax: number | null;
  readonly precipitationChance: number;
  readonly precipitationAmount: number;
  readonly precipitationType: WeatherPrecipitationType;
}

export interface WeatherReportDay {
  /** 위치 시간대의 달력 날짜 (YYYY-MM-DD) */
  readonly date: string;
  readonly condition: WeatherCondition;
  readonly temperatureMin: number;
  readonly temperatureMax: number;
  readonly precipitationChance: number;
  readonly precipitationAmount: number;
  readonly precipitationType: WeatherPrecipitationType;
  readonly snowfallAmount: number;
  readonly uvIndexMax: number;
  readonly windSpeedMax: number | null;
  readonly windGustMax: number | null;
  readonly sunrise: Date | null;
  readonly sunset: Date | null;
  readonly moonPhase: WeatherMoonPhase;
  readonly moonrise: Date | null;
  readonly moonset: Date | null;
  /** 지금부터 그날 끝까지. 공급자는 오늘 항목에만 준다 */
  readonly restOfDay: WeatherReportDayPart | null;
  readonly daytime: WeatherReportDayPart | null;
  readonly overnight: WeatherReportDayPart | null;
}

export interface WeatherReportAlert {
  readonly id: string;
  readonly title: string;
  readonly severity: WeatherAlertSeverity;
  readonly source: string;
  readonly areaName: string | null;
  readonly effectiveAt: Date;
  readonly expiresAt: Date;
  readonly detailsUrl: string;
}

export interface WeatherReportAttributionLogo {
  readonly light: WeatherReportAttributionLogoSet;
  readonly dark: WeatherReportAttributionLogoSet;
}

interface WeatherReportAttributionLogoSet {
  readonly "1x": string;
  readonly "2x": string;
  readonly "3x": string;
}

export interface WeatherReportAttribution {
  readonly provider: WeatherProvider;
  readonly serviceName: string;
  readonly legalPageUrl: string;
  readonly logo: WeatherReportAttributionLogo | null;
}
