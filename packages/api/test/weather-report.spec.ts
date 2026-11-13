import { describe, expect, it } from "vitest";

import {
  weatherAlertSchema,
  weatherBriefingSchema,
  weatherCurrentConditionsSchema,
  weatherDailyForecastSchema,
  weatherDayPartForecastSchema,
  weatherHourlyForecastSchema,
  weatherNextHourPeriodSchema,
  weatherReportSchema,
} from "../src/contracts/weather/index.js";

/** 서버가 앞으로 더할 수 있는 값. 지금 어휘에는 없다 */
const FUTURE_VALUE = "FUTURE_VALUE";

describe("weatherReportSchema", () => {
  it("앞으로 더할 열거 값은 그 칸만 대체값으로 읽어 출시된 앱이 리포트 전체를 버리지 않는다", () => {
    // When
    const parsed = {
      currentCondition: weatherCurrentConditionsSchema.shape.condition.parse(FUTURE_VALUE),
      hourlyCondition: weatherHourlyForecastSchema.shape.condition.parse(FUTURE_VALUE),
      dailyCondition: weatherDailyForecastSchema.shape.condition.parse(FUTURE_VALUE),
      dayPartCondition: weatherDayPartForecastSchema.shape.condition.parse(FUTURE_VALUE),
      hourlyPrecipitation: weatherHourlyForecastSchema.shape.precipitationType.parse(FUTURE_VALUE),
      nextHourPrecipitation:
        weatherNextHourPeriodSchema.shape.precipitationType.parse(FUTURE_VALUE),
      pressureTrend: weatherCurrentConditionsSchema.shape.pressureTrend.parse(FUTURE_VALUE),
      moonPhase: weatherDailyForecastSchema.shape.moonPhase.parse(FUTURE_VALUE),
      severity: weatherAlertSchema.shape.severity.parse(FUTURE_VALUE),
      reason: weatherBriefingSchema.shape.reason.parse(FUTURE_VALUE),
      airQuality: weatherReportSchema.shape.airQuality.parse({
        pm10: 30,
        pm25: 15,
        source: FUTURE_VALUE,
      }),
    };

    // Then
    expect(parsed).toEqual({
      currentCondition: "CLOUDY",
      hourlyCondition: "CLOUDY",
      dailyCondition: "CLOUDY",
      dayPartCondition: "CLOUDY",
      hourlyPrecipitation: "MIXED",
      nextHourPrecipitation: null,
      pressureTrend: "STEADY",
      moonPhase: "NEW",
      severity: "UNKNOWN",
      reason: null,
      airQuality: null,
    });
  });

  it("아는 값은 그대로 읽는다", () => {
    // When
    const condition = weatherCurrentConditionsSchema.shape.condition.parse("RAIN");
    const airQuality = weatherReportSchema.shape.airQuality.parse({
      pm10: 30,
      pm25: 15,
      source: "AIRKOREA",
    });

    // Then
    expect(condition).toBe("RAIN");
    expect(airQuality).toEqual({ pm10: 30, pm25: 15, source: "AIRKOREA" });
  });
});
