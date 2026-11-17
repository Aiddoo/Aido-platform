/**
 * computeEffectiveStreak 단위 테스트 (DB 접근 없는 순수 계산)
 */
import { computeEffectiveStreak } from "./effective-streak.domain-service.js";

const TODAY = Temporal.PlainDate.from("2024-01-16");
const YESTERDAY = Temporal.PlainDate.from("2024-01-15");

describe("computeEffectiveStreak", () => {
  it("전체 완료 + 오늘 이미 반영 → 현재 스트릭 유지", () => {
    // When
    const r = computeEffectiveStreak({
      currentStreak: 5,
      lastCompletedDate: TODAY,
      todosCompleted: 2,
      todosTotal: 2,
      today: TODAY,
    });

    // Then
    expect(r).toEqual({ streak: 5, isAtRisk: false });
  });

  it("전체 완료 + 어제 완료(미반영) → 스트릭 +1", () => {
    // When
    const r = computeEffectiveStreak({
      currentStreak: 5,
      lastCompletedDate: YESTERDAY,
      todosCompleted: 3,
      todosTotal: 3,
      today: TODAY,
    });

    // Then
    expect(r).toEqual({ streak: 6, isAtRisk: false });
  });

  it("전체 완료 + 연속 아님 → 스트릭 1로 새 시작", () => {
    // When
    const r = computeEffectiveStreak({
      currentStreak: 9,
      lastCompletedDate: null,
      todosCompleted: 1,
      todosTotal: 1,
      today: TODAY,
    });

    // Then
    expect(r).toEqual({ streak: 1, isAtRisk: false });
  });

  it("미완료 + 어제 완료 + 스트릭 2+ → 위기(streak 유지)", () => {
    // When
    const r = computeEffectiveStreak({
      currentStreak: 7,
      lastCompletedDate: YESTERDAY,
      todosCompleted: 0,
      todosTotal: 1,
      today: TODAY,
    });

    // Then
    expect(r).toEqual({ streak: 7, isAtRisk: true });
  });

  it("미완료 + 스트릭 1 → 위기 아님", () => {
    // When
    const r = computeEffectiveStreak({
      currentStreak: 1,
      lastCompletedDate: YESTERDAY,
      todosCompleted: 0,
      todosTotal: 2,
      today: TODAY,
    });

    // Then
    expect(r).toEqual({ streak: 1, isAtRisk: false });
  });

  it("todosTotal 0 → 위기 아님", () => {
    // When
    const r = computeEffectiveStreak({
      currentStreak: 5,
      lastCompletedDate: YESTERDAY,
      todosCompleted: 0,
      todosTotal: 0,
      today: TODAY,
    });

    // Then
    expect(r).toEqual({ streak: 5, isAtRisk: false });
  });
});

describe("computeEffectiveStreak — 시간대 이동과 달력 경계", () => {
  const plainDate = (iso: string) => Temporal.PlainDate.from(iso);
  const allCompleted = { todosCompleted: 3, todosTotal: 3 };

  it("서쪽으로 이동해 오늘이 마지막 완료일보다 앞서면 현재 스트릭을 그대로 준다", () => {
    // When
    const result = computeEffectiveStreak({
      ...allCompleted,
      currentStreak: 4,
      lastCompletedDate: plainDate("2027-01-01"),
      today: plainDate("2026-12-31"),
    });

    // Then
    expect(result).toEqual({ streak: 4, isAtRisk: false });
  });

  it("동쪽으로 이동해 하루를 건너뛰면 1부터 다시 센다", () => {
    // When
    const result = computeEffectiveStreak({
      ...allCompleted,
      currentStreak: 4,
      lastCompletedDate: plainDate("2027-01-01"),
      today: plainDate("2027-01-03"),
    });

    // Then
    expect(result).toEqual({ streak: 1, isAtRisk: false });
  });

  it("12월 31일 완료 뒤 1월 1일 전체 완료는 연속으로 센다", () => {
    // When
    const result = computeEffectiveStreak({
      ...allCompleted,
      currentStreak: 2,
      lastCompletedDate: plainDate("2026-12-31"),
      today: plainDate("2027-01-01"),
    });

    // Then
    expect(result).toEqual({ streak: 3, isAtRisk: false });
  });

  it("윤년 2월 29일 완료 뒤 3월 1일은 연속이고 덜 끝냈으면 위기다", () => {
    // When
    const completed = computeEffectiveStreak({
      ...allCompleted,
      currentStreak: 2,
      lastCompletedDate: plainDate("2028-02-29"),
      today: plainDate("2028-03-01"),
    });
    const atRisk = computeEffectiveStreak({
      todosCompleted: 1,
      todosTotal: 3,
      currentStreak: 2,
      lastCompletedDate: plainDate("2028-02-29"),
      today: plainDate("2028-03-01"),
    });

    // Then
    expect({ completed, atRisk }).toEqual({
      completed: { streak: 3, isAtRisk: false },
      atRisk: { streak: 2, isAtRisk: true },
    });
  });
});
