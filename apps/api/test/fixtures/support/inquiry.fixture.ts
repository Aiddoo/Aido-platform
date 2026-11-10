import { InquiryContent } from "#api/modules/support/inquiries/domain/inquiry-content.vo";
import { InquiryId } from "#api/modules/support/inquiries/domain/inquiry-id.vo";
import { Inquiry } from "#api/modules/support/inquiries/domain/inquiry.entity";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export const INQUIRY_FIXTURE_NOW = Temporal.Instant.from("2026-10-07T15:00:00Z");
export const INQUIRY_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";

export function createInquiryFixture(
  overrides: Partial<{
    userEmail: string;
    category: Inquiry["category"];
    content: string;
    now: Temporal.Instant;
  }> = {},
): Inquiry {
  return Inquiry.create({
    id: InquiryId.reconstitute("inquiry-1"),
    userId: UserId.reconstitute(INQUIRY_FIXTURE_USER_ID),
    userEmail: overrides.userEmail ?? "user@example.test",
    category: overrides.category ?? "BUG_REPORT",
    content: InquiryContent.create(
      overrides.content ?? "  합성 문의 <b>원문</b>입니다.\n공백도 보존해 주세요.  ",
    ),
    now: overrides.now ?? INQUIRY_FIXTURE_NOW,
  });
}
