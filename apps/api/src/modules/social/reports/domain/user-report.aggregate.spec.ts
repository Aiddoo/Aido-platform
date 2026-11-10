import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserReportId } from "./user-report-id.vo.js";
import { UserReportResolutionNote } from "./user-report-resolution-note.vo.js";
import { UserReportTarget } from "./user-report-target.vo.js";
import { UserReport } from "./user-report.aggregate.js";

const REPORT_ID = UserReportId.reconstitute("c0123456789abcdef01234567");
const CREATED_AT = Temporal.Instant.from("2026-10-26T09:00:00Z");
const RESOLVED_AT = Temporal.Instant.from("2026-10-26T12:00:00Z");
const PROFILE_TARGET = UserReportTarget.create({ type: "PROFILE", contentId: null });

function createReport(overrides: { reporterId?: string; detail?: string } = {}): UserReport {
  return UserReport.create({
    id: REPORT_ID,
    reporterId: UserId.reconstitute(overrides.reporterId ?? "me"),
    targetUserId: UserId.reconstitute("other"),
    target: PROFILE_TARGET,
    reason: "HARASSMENT",
    detail: overrides.detail,
    now: CREATED_AT,
  });
}

describe("UserReport", () => {
  it("상세 내용 앞뒤 공백을 지우고 접수 상태로 만든다", () => {
    // When
    const report = createReport({ detail: "  계속 욕설을 해요 " });

    // Then
    expect(report.toPrimitives()).toEqual({
      id: REPORT_ID.value,
      reporterId: "me",
      targetUserId: "other",
      targetType: "PROFILE",
      targetId: null,
      reason: "HARASSMENT",
      detail: "계속 욕설을 해요",
      status: "OPEN",
      createdAt: CREATED_AT,
      resolvedAt: null,
      resolvedById: null,
      resolutionNote: null,
    });
  });

  it("공백뿐인 상세 내용은 없는 것으로 저장한다", () => {
    // When
    const report = createReport({ detail: "   " });

    // Then
    expect(report.detail.value).toBeNull();
  });

  it("자기 자신은 너무 긴 상세 내용보다 먼저 REPORT_2251로 거부한다", () => {
    // When
    const create = () => createReport({ reporterId: "other", detail: "가".repeat(501) });

    // Then
    expect(create).toThrow(expect.objectContaining({ errorCode: ErrorCode.REPORT_2251 }));
  });

  it("너무 긴 상세 내용은 SYS_0002로 거부한다", () => {
    // When
    const create = () => createReport({ detail: "가".repeat(501) });

    // Then
    expect(create).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0002, details: { maxLength: 500 } }),
    );
  });

  it("처리를 반복해도 첫 처리 기록을 유지하고 두 번째는 false다", () => {
    // Given
    const report = createReport();

    // When
    const first = report.resolve({
      resolvedById: UserId.reconstitute("admin-1"),
      note: UserReportResolutionNote.create(" 댓글 삭제 "),
      now: RESOLVED_AT,
    });
    const second = report.resolve({
      resolvedById: UserId.reconstitute("admin-2"),
      note: UserReportResolutionNote.create("다시 처리"),
      now: RESOLVED_AT.add({ hours: 1 }),
    });

    // Then
    expect([first, second]).toEqual([true, false]);
    expect(report.toPrimitives()).toMatchObject({
      status: "RESOLVED",
      resolvedAt: RESOLVED_AT,
      resolvedById: "admin-1",
      resolutionNote: "댓글 삭제",
    });
  });

  it.each(["   ", "가".repeat(501)])(
    "조치 내용이 비었거나 너무 길면 SYS_0002로 거부한다",
    (note) => {
      // When
      const create = () => UserReportResolutionNote.create(note);

      // Then
      expect(create).toThrow(
        expect.objectContaining({ errorCode: ErrorCode.SYS_0002, details: { maxLength: 500 } }),
      );
    },
  );
});
