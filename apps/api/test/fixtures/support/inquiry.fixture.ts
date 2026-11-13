import {
  Inquiry,
  type InquiryPrimitives,
} from "#api/modules/support/inquiries/domain/inquiry.aggregate";

export const INQUIRY_FIXTURE_NOW = Temporal.Instant.from("2026-10-07T15:00:00Z");
export const INQUIRY_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";

export function createInquiryFixture(overrides: Partial<InquiryPrimitives> = {}): Inquiry {
  return Inquiry.reconstitute({
    id: "inquiry-1",
    userId: INQUIRY_FIXTURE_USER_ID,
    userEmail: "user@example.test",
    category: "BUG_REPORT",
    content: "  합성 문의 <b>원문</b>입니다.\n공백도 보존해 주세요.  ",
    submittedAt: INQUIRY_FIXTURE_NOW,
    ...overrides,
  });
}
