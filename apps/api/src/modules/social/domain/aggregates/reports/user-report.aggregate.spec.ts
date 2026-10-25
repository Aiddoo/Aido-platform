import { ErrorCode } from "@aido/api/errors";
import { describe, expect, it } from "vitest";

import { UserReportTarget } from "../../value-objects/reports/user-report-target.vo.js";
import { UserReport } from "./user-report.aggregate.js";

const createdAt = new Date("2026-10-26T09:00:00.000Z");
const profileTarget = UserReportTarget.of("PROFILE", null);

describe("UserReport", () => {
  it("자기 자신은 신고할 수 없다", () => {
    // Given
    const input = {
      reporterId: "me",
      targetUserId: "me",
      target: profileTarget,
      reason: "SPAM",
      createdAt,
    } as const;

    // When
    const plan = () => UserReport.planCreation(input);

    // Then
    expect(plan).toThrow(expect.objectContaining({ errorCode: ErrorCode.REPORT_2251 }));
  });

  it("공백뿐인 상세 내용은 없는 것으로 저장한다", () => {
    // When
    const plan = UserReport.planCreation({
      reporterId: "me",
      targetUserId: "other",
      target: profileTarget,
      reason: "OTHER",
      detail: "   ",
      createdAt,
    });

    // Then
    expect(plan.detail).toBeNull();
  });

  it("처리를 반복해도 처음 한 번만 상태가 바뀐다", () => {
    // Given
    const report = UserReport.reconstitute({
      id: "report-1",
      reporterId: "me",
      targetUserId: "other",
      target: profileTarget,
      reason: "HARASSMENT",
      detail: null,
      status: "OPEN",
      createdAt,
    });

    // When
    const first = report.resolve();
    const second = report.resolve();

    // Then
    expect([first, second]).toEqual([true, false]);
    expect(report.status).toBe("RESOLVED");
  });
});
