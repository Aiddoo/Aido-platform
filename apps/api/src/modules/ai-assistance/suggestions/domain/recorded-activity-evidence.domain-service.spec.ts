import { assert } from "vitest";

import {
  collectRecordedActivities,
  isMeaningfulTitle,
  selectRecordedDays,
  toActivityKey,
} from "./recorded-activity-evidence.domain-service.js";
import type { TodoSummaryForAnalysis } from "./suggestion.constants.js";

const todo = (startDate: string, completed = true): TodoSummaryForAnalysis => ({
  title: "책 읽기 10분",
  startDate,
  completed,
  scheduledTime: null,
  categoryId: 1,
  categoryName: "독서",
});

describe("recorded activity evidence", () => {
  it("월요일 DATE 기록 세 개와 시각을 실제 등록/완료 근거로 구분한다", () => {
    const records = [
      todo("2026-09-21"),
      todo("2026-09-28", false),
      { ...todo("2026-10-05"), scheduledTime: "19:30" },
    ];
    const [evidence] = collectRecordedActivities(records);
    expect(evidence).toEqual({
      key: "책읽기10분",
      title: "책 읽기 10분",
      occurrences: 3,
      completedOccurrences: 2,
      days: [{ day: "MON", total: 3, completed: 2 }],
      recordedTime: null,
      categoryName: "독서",
    });
    assert.exists(evidence);
    expect(selectRecordedDays(evidence)).toEqual(["MON"]);
  });
  it("반복 등록과 실제 완료가 있는 요일을 단발성 완료보다 우선한다", () => {
    const [evidence] = collectRecordedActivities([
      todo("2026-09-21"),
      todo("2026-09-28", false),
      todo("2026-09-23"),
    ]);
    assert.exists(evidence);
    expect(selectRecordedDays(evidence)).toEqual(["MON"]);
  });
  it("요일 반복이 없으면 완료 수, 기록 수, ISO 요일 순의 최빈 한 요일을 제안한다", () => {
    const [evidence] = collectRecordedActivities([
      todo("2026-09-23"),
      todo("2026-09-21"),
      todo("2026-09-22", false),
    ]);
    assert.exists(evidence);
    expect(selectRecordedDays(evidence)).toEqual(["MON"]);
  });
  it("완료가 없으면 성공을 만들지 않고 가장 많이 등록한 요일만 선택한다", () => {
    const [evidence] = collectRecordedActivities([
      todo("2026-09-23", false),
      todo("2026-09-30", false),
      todo("2026-09-21", false),
    ]);
    expect(evidence?.completedOccurrences).toBe(0);
    assert.exists(evidence);
    expect(selectRecordedDays(evidence)).toEqual(["WED"]);
  });
  it("표기만 다른 제목은 한 활동으로 합쳐 세고 가장 많이 쓴 제목을 보이며 의미 없는 제목은 뺀다", () => {
    // Given - 2026-09-21·28 월요일, 09-24 목요일
    const records = [
      { ...todo("2026-09-21"), title: "러닝 🏃", scheduledTime: "07:00" },
      { ...todo("2026-09-24"), title: "러닝", scheduledTime: "07:00" },
      { ...todo("2026-09-28", false), title: "러닝" },
      { ...todo("2026-09-28"), title: "ㅋㅋㅋ" },
    ];
    // When
    const activities = collectRecordedActivities(records);
    // Then
    expect(activities).toEqual([
      expect.objectContaining({
        key: "러닝",
        title: "러닝",
        occurrences: 3,
        completedOccurrences: 2,
        days: [
          { day: "MON", total: 2, completed: 1 },
          { day: "THU", total: 1, completed: 1 },
        ],
        recordedTime: "07:00",
      }),
    ]);
  });
});

describe("toActivityKey", () => {
  it.each([
    ["띄어쓰기", "운동하기", "운동 하기"],
    ["문장부호", "운동하기", "운동하기!"],
    ["이모지", "운동하기", "운동하기 🏃‍♂️"],
    ["전각", "yoga", "ｙｏｇａ"],
    ["대소문자", "Yoga", "YOGA"],
  ])("%s만 다른 제목은 같은 활동이다", (_difference, title, variant) => {
    // When / Then
    expect(toActivityKey(variant)).toBe(toActivityKey(title));
  });

  it.each([
    ["오타", "운동하기", "운동하가"],
    ["숫자", "Read 30 min", "Read 20 min"],
  ])("%s가 다른 제목은 다른 활동이다", (_difference, title, variant) => {
    // When / Then
    expect(toActivityKey(variant)).not.toBe(toActivityKey(title));
  });
});

describe("isMeaningfulTitle", () => {
  it.each([
    ["자모만", "ㅋㅋㅋ", false],
    ["자모와 숫자", "ㅋㅋ123", false],
    ["숫자만", "1234", false],
    ["기호만", "!!!", false],
    ["이모지만", "🏃🏃", false],
    ["한 글자", "밥", false],
    ["숫자 섞인 두 글자", "물 2L", true],
    ["한글 두 글자", "운동", true],
  ])("%s 제목 '%s'는 의미 있는 제목 판정이 %s다", (_kind, title, expected) => {
    // When / Then
    expect(isMeaningfulTitle(title)).toBe(expected);
  });
});
