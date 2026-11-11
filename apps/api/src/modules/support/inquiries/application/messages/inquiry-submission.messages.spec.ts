import { createInquiryFixture } from "#test/fixtures/support/inquiry.fixture";

import { formatSubmittedAtKst, toInquirySubmission } from "./inquiry-submission.messages.js";

describe("문의 전달 문구", () => {
  it.each([
    ["2026-10-07T15:00:00Z", "2026-10-08 00:00 (KST)"],
    ["2026-10-07T14:59:59.999Z", "2026-10-07 23:59 (KST)"],
    ["2026-12-31T15:00:00Z", "2027-01-01 00:00 (KST)"],
  ])("제출 시각 %s를 KST %s로 적는다", (instant, expected) => {
    expect(formatSubmittedAtKst(Temporal.Instant.from(instant))).toBe(expected);
  });

  it("카테고리 라벨과 사용자 원문을 담아 전달 모양을 만든다", () => {
    // Given
    const inquiry = createInquiryFixture({
      category: "PAYMENT",
      content: "결제가 두 번 됐어요 확인 부탁",
    });

    // When
    const submission = toInquirySubmission(inquiry);

    // Then
    expect(submission).toEqual({
      userEmail: "user@example.test",
      category: "PAYMENT",
      categoryLabel: "결제·구독",
      content: "결제가 두 번 됐어요 확인 부탁",
      submittedAt: "2026-10-08 00:00 (KST)",
    });
  });
});
