import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { resolveTodoSummaryDate } from "./todo-summary-date.policy.js";

describe("resolveTodoSummaryDate", () => {
  it("요청 날짜가 없으면 사용자 오늘을 반환한다", () => {
    // Given
    const today = new Date("2026-07-14T00:00:00Z");

    // When
    const result = resolveTodoSummaryDate(today);

    // Then
    expect(result).toEqual(today);
  });

  it.each([
    { name: "오늘", requested: "2026-07-14T00:00:00Z" },
    { name: "내일", requested: "2026-07-15T00:00:00Z" },
  ])("$name 날짜는 그대로 허용한다", ({ requested }) => {
    // Given
    const today = new Date("2026-07-14T00:00:00Z");

    // When
    const result = resolveTodoSummaryDate(today, new Date(requested));

    // Then
    expect(result).toEqual(new Date(requested));
  });

  it("윤년 2월 29일의 내일은 3월 1일로 허용한다", () => {
    // Given
    const leapDay = new Date("2028-02-29T00:00:00Z");

    // When
    const result = resolveTodoSummaryDate(leapDay, new Date("2028-03-01T00:00:00Z"));

    // Then
    expect(result).toEqual(new Date("2028-03-01T00:00:00Z"));
  });

  it.each([
    { name: "어제", requested: "2026-07-13T00:00:00Z" },
    { name: "모레", requested: "2026-07-16T00:00:00Z" },
  ])("$name 날짜를 요청하면 SYS_0002로 거부한다", ({ requested }) => {
    // Given
    const today = new Date("2026-07-14T00:00:00Z");

    // When
    const resolve = () => resolveTodoSummaryDate(today, new Date(requested));

    // Then
    expect(resolve).toThrow(DomainException);
    expect(resolve).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }));
  });
});
