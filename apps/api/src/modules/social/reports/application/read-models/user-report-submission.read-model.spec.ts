import {
  createUserReportFixture,
  USER_REPORT_FIXTURE_REPORTER_ID,
  USER_REPORT_FIXTURE_REPORTER_TAG,
} from "#test/fixtures/social/user-report.fixture";

import { toUserReportSubmission } from "./user-report-submission.read-model.js";

describe("toUserReportSubmission — 운영자 신고 알림 내용", () => {
  it.each([
    { createdAt: "2026-10-26T09:00:00.000Z", submittedAt: "2026-10-26 18:00 (KST)" },
    { createdAt: "2026-12-31T15:00:59.999Z", submittedAt: "2027-01-01 00:00 (KST)" },
    { createdAt: "2026-03-01T14:59:59.999Z", submittedAt: "2026-03-01 23:59 (KST)" },
  ])(
    "접수 시각 $createdAt은 초를 버린 한국 시각 $submittedAt이다",
    ({ createdAt, submittedAt }) => {
      // Given
      const report = createUserReportFixture({ createdAt: Temporal.Instant.from(createdAt) });

      // When
      const submission = toUserReportSubmission(report, new Map());

      // Then
      expect(submission.submittedAt).toBe(submittedAt);
    },
  );

  it("프로필 신고는 라벨을 붙이고, 태그를 찾지 못한 사용자는 '-'로 둔다", () => {
    // Given
    const report = createUserReportFixture({
      targetType: "PROFILE",
      targetId: null,
      reason: "IMPERSONATION",
    });

    // When
    const submission = toUserReportSubmission(
      report,
      new Map([[USER_REPORT_FIXTURE_REPORTER_ID, USER_REPORT_FIXTURE_REPORTER_TAG]]),
    );

    // Then
    expect(submission).toMatchObject({
      reporterTag: USER_REPORT_FIXTURE_REPORTER_TAG,
      targetUserTag: "-",
      targetTypeLabel: "프로필·닉네임",
      targetId: null,
      reasonLabel: "사칭",
    });
  });
});
