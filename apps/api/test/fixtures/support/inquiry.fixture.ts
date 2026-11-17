import { InquiryContent } from "#api/modules/support/inquiries/domain/inquiry-content.vo";
import { InquiryId } from "#api/modules/support/inquiries/domain/inquiry-id.vo";
import {
  Inquiry,
  type InquiryPrimitives,
} from "#api/modules/support/inquiries/domain/inquiry.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export const INQUIRY_FIXTURE_NOW = Temporal.Instant.from("2026-10-07T15:00:00Z");
export const INQUIRY_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";

// 문의는 저장하지 않아 복원하지 않고 접수와 같은 create로 만든다
export function createInquiryFixture(
  overrides: Partial<Omit<InquiryPrimitives, "id">> = {},
): Inquiry {
  const values = {
    userId: INQUIRY_FIXTURE_USER_ID,
    userEmail: "user@example.test",
    category: "BUG_REPORT",
    content: "  합성 문의 <b>원문</b>입니다.\n공백도 보존해 주세요.  ",
    submittedAt: INQUIRY_FIXTURE_NOW,
    ...overrides,
  } satisfies Omit<InquiryPrimitives, "id">;
  return Inquiry.create({
    id: InquiryId.generate(),
    userId: UserId.reconstitute(values.userId),
    userEmail: values.userEmail,
    category: values.category,
    content: InquiryContent.create(values.content),
    now: values.submittedAt,
  });
}
