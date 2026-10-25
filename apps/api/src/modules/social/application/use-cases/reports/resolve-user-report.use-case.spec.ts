import { ErrorCode } from "@aido/api/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserReport } from "#api/modules/social/domain/aggregates/reports/user-report.aggregate";
import { UserReportTarget } from "#api/modules/social/domain/value-objects/reports/user-report-target.vo";
import { createUnitOfWorkMock } from "#test/mocks/ports/index";
import { StubUserReportRepository } from "#test/mocks/ports/social-reports.stub";

import { ResolveUserReport } from "./resolve-user-report.use-case.js";

const RESOLVED_AT = new Date("2026-10-26T12:00:00.000Z");

function createOpenReport(id = "report-1") {
  return UserReport.reconstitute({
    id,
    reporterId: "reporter",
    targetUserId: "target",
    target: UserReportTarget.of("PROFILE", null),
    reason: "HARASSMENT",
    detail: null,
    status: "OPEN",
    createdAt: new Date("2026-10-26T09:00:00.000Z"),
    resolvedAt: null,
    resolvedById: null,
    resolutionNote: null,
  });
}

describe("ResolveUserReport", () => {
  let userReportRepository: StubUserReportRepository;
  let useCase: ResolveUserReport;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(RESOLVED_AT);
    userReportRepository = new StubUserReportRepository();
    useCase = new ResolveUserReport({
      userReportRepository,
      unitOfWork: createUnitOfWorkMock(),
    });
  });
  afterEach(() => vi.useRealTimers());

  it("조치 내용을 남기고 처리 완료로 바꾼다", async () => {
    // Given
    userReportRepository.reports.push(createOpenReport());

    // When
    const report = await useCase.execute({
      reportId: "report-1",
      adminId: "admin-1",
      note: "댓글 삭제 후 경고",
    });

    // Then
    expect(report).toMatchObject({
      status: "RESOLVED",
      resolvedAt: RESOLVED_AT,
      resolvedById: "admin-1",
      resolutionNote: "댓글 삭제 후 경고",
    });
  });

  it("없는 신고는 REPORT_2255로 거부한다", async () => {
    // When
    const resolve = useCase.execute({ reportId: "missing", adminId: "admin-1", note: "확인" });

    // Then
    await expect(resolve).rejects.toMatchObject({ errorCode: ErrorCode.REPORT_2255 });
  });

  it("읽은 뒤 다른 운영자가 먼저 처리했으면 먼저 저장된 처리 기록을 돌려준다", async () => {
    // Given
    userReportRepository.reports.push(createOpenReport());
    const winner = createOpenReport();
    winner.resolve({ resolvedById: "admin-2", note: "위반 아님", resolvedAt: RESOLVED_AT });
    userReportRepository.concurrentResolution = winner;

    // When
    const report = await useCase.execute({
      reportId: "report-1",
      adminId: "admin-1",
      note: "댓글 삭제",
    });

    // Then
    expect(report).toMatchObject({ resolvedById: "admin-2", resolutionNote: "위반 아님" });
  });
});
