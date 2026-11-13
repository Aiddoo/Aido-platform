import { toIsoString } from "#api/shared/domain/time/instant";

import {
  planWeatherBriefing,
  type WeatherBriefingHour,
  type WeatherBriefingTodo,
} from "./weather-briefing.domain-service.js";

// 서울 2026-11-02 09:00 (UTC 00:00)
const DAY_START = Temporal.Instant.from("2026-11-02T00:00:00.000Z");
const NOW = Temporal.Instant.from("2026-11-02T00:20:00.000Z");
const SEOUL = "Asia/Seoul";

function hour(offset: number, overrides: Partial<WeatherBriefingHour> = {}): WeatherBriefingHour {
  return {
    startsAt: DAY_START.add({ hours: offset }),
    isDaylight: true,
    apparentTemperature: 20,
    precipitationChance: 10,
    ...overrides,
  };
}

function todo(id: number, offsetHours: number, minutes = 0): WeatherBriefingTodo {
  return {
    id,
    scheduledAt: DAY_START.add({ hours: offsetHours, minutes }),
  };
}

describe("planWeatherBriefing — 날씨와 겹친 할 일과 옮길 시간", () => {
  it("비 오는 시간(확률 50% 이상)에 걸린 할 일만 영향받는다고 보고 시각 순으로 담는다", () => {
    // Given
    const hourly = [
      hour(0),
      hour(1),
      hour(2, { precipitationChance: 50 }),
      hour(3, { precipitationChance: 49 }),
      hour(4, { precipitationChance: 80 }),
      hour(5),
    ];
    const todos = [todo(3, 4, 30), todo(1, 2), todo(2, 3), todo(4, 1)];

    // When
    const briefing = planWeatherBriefing({ hourly, todos, now: NOW, timezone: SEOUL });

    // Then
    expect(briefing.reason).toBe("rain");
    expect(briefing.affectedTodoIds).toEqual([1, 3]);
  });

  it("비 오는 시간 후보는 비 안 오는 같은 날 시간 중 강수 확률이 낮고 할 일에 가까운 순이며 첫 항목이 추천이다", () => {
    // Given
    const hourly = [
      hour(0),
      hour(1, { precipitationChance: 30 }),
      hour(2, { precipitationChance: 70 }),
      hour(3, { precipitationChance: 0 }),
      hour(4, { precipitationChance: 30 }),
      hour(5, { precipitationChance: 0 }),
      hour(6, { precipitationChance: 10 }),
    ];

    // When
    const briefing = planWeatherBriefing({
      hourly,
      todos: [todo(1, 2)],
      now: NOW,
      timezone: SEOUL,
    });

    // Then
    const [entry] = briefing.rescheduleOptions;
    expect(entry?.todoId).toBe(1);
    expect(entry?.options.map((option) => toIsoString(option.startsAt))).toEqual([
      "2026-11-02T03:00:00.000Z",
      "2026-11-02T05:00:00.000Z",
      "2026-11-02T06:00:00.000Z",
      "2026-11-02T01:00:00.000Z",
    ]);
    expect(entry?.options.map((option) => option.isRecommended)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("비가 오는 할 일이 없고 더운 낮에 걸린 할 일이 있으면 heat다", () => {
    // Given
    const hourly = [
      hour(0),
      hour(1, { apparentTemperature: 33 }),
      hour(2, { apparentTemperature: 35, isDaylight: false }),
      hour(3, { apparentTemperature: 31 }),
    ];
    const todos = [todo(1, 1, 10), todo(2, 2)];

    // When
    const briefing = planWeatherBriefing({ hourly, todos, now: NOW, timezone: SEOUL });

    // Then
    expect(briefing.reason).toBe("heat");
    expect(briefing.affectedTodoIds).toEqual([1]);
    expect(briefing.rescheduleOptions[0]?.options.map((o) => toIsoString(o.startsAt))).toEqual([
      "2026-11-02T02:00:00.000Z",
      "2026-11-02T03:00:00.000Z",
    ]);
  });

  it("비와 더위가 함께 있으면 비를 먼저 알린다", () => {
    // Given
    const hourly = [
      hour(0),
      hour(1, { apparentTemperature: 34 }),
      hour(2, { precipitationChance: 90 }),
    ];

    // When
    const briefing = planWeatherBriefing({
      hourly,
      todos: [todo(1, 1), todo(2, 2)],
      now: NOW,
      timezone: SEOUL,
    });

    // Then
    expect(briefing.reason).toBe("rain");
    expect(briefing.affectedTodoIds).toEqual([2]);
  });

  it("이미 지난 시각의 할 일과 예보 범위 밖의 할 일은 보지 않는다", () => {
    // Given
    const hourly = [hour(0, { precipitationChance: 90 }), hour(1, { precipitationChance: 90 })];
    const todos = [todo(1, 0, 10), todo(2, 5)];

    // When
    const briefing = planWeatherBriefing({ hourly, todos, now: NOW, timezone: SEOUL });

    // Then
    expect(briefing).toEqual({
      reason: null,
      affected: [],
      affectedTodoIds: [],
      rescheduleOptions: [],
    });
  });

  it("후보는 할 일과 같은 날(기기 시간대)의 시간만 쓴다", () => {
    // Given - 서울 자정(UTC 15시)을 넘기는 예보에서 서울 기준 같은 날만 후보가 된다
    const lateStart = Temporal.Instant.from("2026-11-02T13:00:00.000Z");
    const at = (offset: number, chance: number): WeatherBriefingHour => ({
      startsAt: lateStart.add({ hours: offset }),
      isDaylight: false,
      apparentTemperature: 10,
      precipitationChance: chance,
    });
    const hourly = [at(0, 80), at(1, 0), at(2, 0), at(3, 0)];
    const now = Temporal.Instant.from("2026-11-02T12:30:00.000Z");
    const todos = [{ id: 1, scheduledAt: Temporal.Instant.from("2026-11-02T13:30:00.000Z") }];

    // When
    const briefing = planWeatherBriefing({ hourly, todos, now, timezone: SEOUL });

    // Then
    expect(briefing.rescheduleOptions[0]?.options.map((o) => toIsoString(o.startsAt))).toEqual([
      "2026-11-02T14:00:00.000Z",
    ]);
  });
});
