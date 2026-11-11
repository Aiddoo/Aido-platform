import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { resolveTodoSummaryDate } from "./todo-summary-date.domain-service.js";

describe("resolveTodoSummaryDate", () => {
  it("요청 날짜가 없으면 사용자 오늘을 반환한다", () => {
    // Given
    const today = Temporal.PlainDate.from("2026-07-14");

    // When
    const result = resolveTodoSummaryDate(today);

    // Then
    expect(result).toEqual(today);
  });

  it.each([
    { name: "오늘", requested: "2026-07-14" },
    { name: "내일", requested: "2026-07-15" },
  ])("$name 날짜는 그대로 허용한다", ({ requested }) => {
    // Given
    const today = Temporal.PlainDate.from("2026-07-14");

    // When
    const result = resolveTodoSummaryDate(today, Temporal.PlainDate.from(requested));

    // Then
    expect(result).toEqual(Temporal.PlainDate.from(requested));
  });

  it("윤년 2월 29일의 내일은 3월 1일로 허용한다", () => {
    // Given
    const leapDay = Temporal.PlainDate.from("2028-02-29");

    // When
    const result = resolveTodoSummaryDate(leapDay, Temporal.PlainDate.from("2028-03-01"));

    // Then
    expect(result).toEqual(Temporal.PlainDate.from("2028-03-01"));
  });

  it.each([
    { name: "어제", requested: "2026-07-13" },
    { name: "모레", requested: "2026-07-16" },
  ])("$name 날짜를 요청하면 SYS_0002로 거부한다", ({ requested }) => {
    // Given
    const today = Temporal.PlainDate.from("2026-07-14");

    // When
    const resolve = () => resolveTodoSummaryDate(today, Temporal.PlainDate.from(requested));

    // Then
    expect(resolve).toThrow(DomainException);
    expect(resolve).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }));
  });
});
