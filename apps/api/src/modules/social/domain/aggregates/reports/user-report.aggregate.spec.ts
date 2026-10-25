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

  it("처리를 반복해도 첫 처리 기록을 유지한다", () => {
    // Given
    const report = createOpenReport();
    const resolvedAt = new Date("2026-10-26T12:00:00.000Z");

    // When
    const first = report.resolve({ resolvedById: "admin-1", note: " 댓글 삭제 ", resolvedAt });
    const second = report.resolve({
      resolvedById: "admin-2",
      note: "다시 처리",
      resolvedAt: new Date("2026-10-26T13:00:00.000Z"),
    });

    // Then
    expect([first, second]).toEqual([true, false]);
    expect(report).toMatchObject({
      status: "RESOLVED",
      resolvedAt,
      resolvedById: "admin-1",
      resolutionNote: "댓글 삭제",
    });
  });

  it("조치 내용 없이는 처리할 수 없다", () => {
    // Given
    const report = createOpenReport();

    // When
    const resolve = () =>
      report.resolve({ resolvedById: "admin-1", note: "   ", resolvedAt: createdAt });

    // Then
    expect(resolve).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }));
    expect(report.status).toBe("OPEN");
  });
});

function createOpenReport() {
  return UserReport.reconstitute({
    id: "report-1",
    reporterId: "me",
    targetUserId: "other",
    target: profileTarget,
    reason: "HARASSMENT",
    detail: null,
    status: "OPEN",
    createdAt,
    resolvedAt: null,
    resolvedById: null,
    resolutionNote: null,
  });
}
