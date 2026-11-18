import { toUserReportEmailContent } from "./user-report-email.mapper.js";

const SUBMISSION = {
  reportId: "creport000000000000000001",
  reporterId: "clz7x5p8k0001qz0z8z8z8z8z",
  reporterTag: "REPORTER",
  targetUserId: "clz7x5p8k0002qz0z8z8z8z8z",
  targetUserTag: null,
  targetType: "PROFILE",
  targetId: null,
  reason: "IMPERSONATION",
  detail: null,
  submittedAt: Temporal.Instant.from("2026-10-26T09:00:00.000Z"),
} as const;

describe("toUserReportEmailContent — 운영자 신고 알림 내용", () => {
  it.each([
    { submittedAt: "2026-10-26T09:00:00.000Z", formatted: "2026-10-26 18:00 (KST)" },
    { submittedAt: "2026-12-31T15:00:59.999Z", formatted: "2027-01-01 00:00 (KST)" },
    { submittedAt: "2026-03-01T14:59:59.999Z", formatted: "2026-03-01 23:59 (KST)" },
  ])(
    "접수 시각 $submittedAt은 초를 버린 한국 시각 $formatted이다",
    ({ submittedAt, formatted }) => {
      // When
      const content = toUserReportEmailContent({
        ...SUBMISSION,
        submittedAt: Temporal.Instant.from(submittedAt),
      });

      // Then
      expect(content.submittedAt).toBe(formatted);
    },
  );

  it("프로필 신고는 라벨을 붙이고, 태그를 찾지 못한 사용자는 '-'로 둔다", () => {
    // When
    const content = toUserReportEmailContent(SUBMISSION);

    // Then
    expect(content).toMatchObject({
      reporterTag: "REPORTER",
      targetUserTag: "-",
      targetTypeLabel: "프로필·닉네임",
      targetId: null,
      reasonLabel: "사칭",
    });
  });
});
