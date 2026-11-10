import {
  UserReport,
  type UserReportPrimitives,
} from "#api/modules/social/reports/domain/user-report.aggregate";

// 18:00 KST. 운영자 알림의 접수 시각 문구를 이 값으로 확인한다
export const USER_REPORT_FIXTURE_NOW = Temporal.Instant.from("2026-10-26T09:00:00Z");
export const USER_REPORT_FIXTURE_REPORTER_ID = "clz7x5p8k0201qz0z8z8z8z8z";
export const USER_REPORT_FIXTURE_REPORTER_TAG = "REPORTER";
export const USER_REPORT_FIXTURE_TARGET_USER_ID = "clz7x5p8k0202qz0z8z8z8z8z";
export const USER_REPORT_FIXTURE_TARGET_USER_TAG = "TARGET01";
export const USER_REPORT_FIXTURE_ADMIN_ID = "clz7x5p8k0203qz0z8z8z8z8z";
export const USER_REPORT_FIXTURE_COMMENT_ID = "clz7x5p8k0099qz0z8z8z8z8z";

export function createUserReportFixture(overrides: Partial<UserReportPrimitives> = {}): UserReport {
  return UserReport.reconstitute({
    id: "creport000000000000000001",
    reporterId: USER_REPORT_FIXTURE_REPORTER_ID,
    targetUserId: USER_REPORT_FIXTURE_TARGET_USER_ID,
    targetType: "COMMENT",
    targetId: USER_REPORT_FIXTURE_COMMENT_ID,
    reason: "SPAM",
    detail: null,
    status: "OPEN",
    createdAt: USER_REPORT_FIXTURE_NOW,
    resolvedAt: null,
    resolvedById: null,
    resolutionNote: null,
    ...overrides,
  });
}
