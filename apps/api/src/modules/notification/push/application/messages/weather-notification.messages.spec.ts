import { pushNotificationDataSchema } from "@aido/api";

import type { WeatherBriefingDay } from "#api/modules/weather/forecasts/weather-forecasts.public";

import { formatWeatherNotificationTime } from "./notification-copy-format.messages.js";
import {
  createWeatherEveningNotificationMessage,
  createWeatherMorningNotificationMessage,
  createWeatherRescheduleAction,
} from "./weather-notification.messages.js";

/** 서울 15:00 */
const AFTERNOON = Temporal.Instant.from("2026-07-16T06:00:00.000Z");
const seoulTime = (locale: "ko" | "en") => (instant: Date) =>
  formatWeatherNotificationTime(instant, { locale, timezone: "Asia/Seoul" });

const DAY: WeatherBriefingDay = {
  date: Temporal.PlainDate.from("2026-07-16"),
  condition: "MOSTLY_CLOUDY",
  temperatureMin: 21.4,
  temperatureMax: 28.6,
  precipitationChance: 30,
  precipitationType: "RAIN",
};

describe("날씨 알림 문구", () => {
  it("비와 겹친 할 일은 알림 시간대의 시각과 제목으로 알린다", () => {
    // Given
    const briefing = {
      kind: "todoWet",
      hazard: "rain",
      todo: { id: 1, title: "한강 산책", scheduledAt: AFTERNOON },
      todoIds: [1],
      precipitationChance: 70,
    } as const;
    // When
    const message = createWeatherMorningNotificationMessage({
      briefing,
      locale: "ko",
      formatTime: seoulTime("ko"),
    });
    // Then
    expect(message).toMatchObject({
      title: "오후 3시 ‘한강 산책’ 때 비 소식이 있어요 ☔",
      body: "강수 확률 70% · 시간 옮기기",
    });
  });

  it("영어는 같은 순간을 영어 시각으로 보여 주고 다른 겹친 할 일 수를 알린다", () => {
    // Given
    const briefing = {
      kind: "todoWet",
      hazard: "rain",
      todo: { id: 1, title: "Walk", scheduledAt: AFTERNOON },
      todoIds: [1, 2],
      precipitationChance: 70,
    } as const;
    // When
    const message = createWeatherMorningNotificationMessage({
      briefing,
      locale: "en",
      formatTime: seoulTime("en"),
    });
    // Then
    expect(message.title).toBe("Rain likely at 3 PM for “Walk” ☔");
    expect(message.body).toBe("1 more to-do overlaps · Move to a dry time");
  });

  it.each([
    ["2026-07-16T06:00:00.000Z", "Asia/Seoul", "ko", "오후 3시"],
    ["2026-07-16T06:30:00.000Z", "Asia/Seoul", "ko", "오후 3시 30분"],
    ["2026-07-16T06:05:00.000Z", "Asia/Seoul", "ko", "오후 3시 5분"],
    ["2026-07-16T06:00:00.000Z", "Asia/Seoul", "en", "3 PM"],
    ["2026-07-16T06:30:00.000Z", "Asia/Seoul", "en", "3:30 PM"],
    ["2026-07-16T07:00:00.000Z", "America/Los_Angeles", "ko", "오전 12시"],
    ["2026-07-16T06:30:00.000Z", "America/Los_Angeles", "ko", "오후 11시 30분"],
    ["2026-07-16T07:00:00.000Z", "America/Los_Angeles", "en", "12 AM"],
    ["2026-07-16T06:30:00.000Z", "America/Los_Angeles", "en", "11:30 PM"],
  ] as const)(
    "%s를 %s·%s로 표시하면 정시와 분 표기가 섞이지 않는다 → %s",
    (instant, timezone, locale, expected) => {
      // When
      const label = formatWeatherNotificationTime(new Date(instant), { locale, timezone });
      // Then
      expect(label).toBe(expected);
    },
  );

  it("더위와 겹친 할 일은 반올림한 최고 체감 온도로 알린다", () => {
    // When
    const message = createWeatherMorningNotificationMessage({
      briefing: {
        kind: "todoHot",
        todo: { id: 1, title: "테니스", scheduledAt: AFTERNOON },
        todoIds: [1],
        peakApparentTemperature: 35.4,
      },
      locale: "ko",
      formatTime: seoulTime("ko"),
    });
    // Then
    expect(message.title).toBe("오후 3시 ‘테니스’ 때 체감 35°C예요 ☀️");
  });

  it("할 일이 없으면 오늘 상태·기온·강수 확률을 요약한다", () => {
    // When
    const message = createWeatherMorningNotificationMessage({
      briefing: { kind: "summary", day: DAY },
      locale: "ko",
      formatTime: seoulTime("ko"),
    });
    // Then
    expect(message).toMatchObject({
      title: "오늘은 구름 많음, 21~29°C예요",
      body: "강수 확률 30%예요. 좋은 하루 보내요",
    });
  });

  it("영어 저녁 알림은 시간대 구가 내일을 포함한 완결된 문장이다", () => {
    // When
    const titles = (["dawn", "morning", "afternoon", "evening"] as const).map(
      (dayPart) =>
        createWeatherEveningNotificationMessage({
          briefing: { kind: "wetTomorrow", isSnow: false, dayPart, day: DAY, isChilly: false },
          locale: "en",
        }).title,
    );
    // Then
    expect(titles).toEqual([
      "Rain starting before dawn tomorrow ☔",
      "Rain starting tomorrow morning ☔",
      "Rain starting tomorrow afternoon ☔",
      "Rain starting tomorrow evening ☔",
    ]);
  });

  it("저녁에는 내일 비가 시작하는 때와 쌀쌀함을 함께 알린다", () => {
    // When
    const message = createWeatherEveningNotificationMessage({
      briefing: {
        kind: "wetTomorrow",
        isSnow: false,
        dayPart: "afternoon",
        day: { ...DAY, temperatureMin: 8.6 },
        isChilly: true,
      },
      locale: "ko",
    });
    // Then
    expect(message).toMatchObject({
      title: "내일 오후부터 비 소식이 있어요 ☔",
      body: "아침엔 9°C로 쌀쌀해요. 우산과 겉옷을 챙겨주세요",
    });
  });

  it("같은 컨텍스트면 ko/en은 같은 variant를 고른다", () => {
    // Given
    const variantContext = { campaignKey: "weather", recipientId: "u", occurrenceKey: "d" };
    const briefing = { kind: "summary", day: DAY } as const;
    // When
    const ko = createWeatherMorningNotificationMessage({
      briefing,
      locale: "ko",
      variantContext,
      formatTime: seoulTime("ko"),
    });
    const en = createWeatherMorningNotificationMessage({
      briefing,
      locale: "en",
      variantContext,
      formatTime: seoulTime("en"),
    });
    // Then
    expect(ko.variantId).toBe(en.variantId);
    expect(ko.variantId).toBe("weather.weather.morning.summary.default");
  });
});

describe("날씨 옮기기 deep link", () => {
  it("옮길 할 일 id와 이유를 앱 옮기기 경로에 싣고 기존 push payload 계약을 지킨다", () => {
    // When
    const action = createWeatherRescheduleAction([12, 15], "rain");
    // Then
    expect(action).toEqual({
      type: "DEEP_LINK",
      url: "/weather/reschedule?todoIds=12,15&reason=rain",
    });
    expect(
      pushNotificationDataSchema.safeParse({ notificationId: 1, type: "WEATHER_MORNING", action })
        .success,
    ).toBe(true);
  });

  it("재계산 뒤의 순간은 어느 시간대에서든 고른 벽시계로 적힌다", () => {
    // Given
    const instant = new Date(
      Temporal.ZonedDateTime.from("2026-11-10T10:00[America/New_York]").epochMilliseconds,
    );
    // When
    const label = formatWeatherNotificationTime(instant, {
      locale: "ko",
      timezone: "America/New_York",
    });
    // Then
    expect(label).toBe("오전 10시");
  });
});
