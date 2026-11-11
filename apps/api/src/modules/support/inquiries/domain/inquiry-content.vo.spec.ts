import { ErrorCode } from "@aido/api/errors";
import { INQUIRY_CONTENT_LIMITS } from "@aido/api/vocabulary";

import { InquiryContent } from "./inquiry-content.vo.js";

describe("InquiryContent — 문의 내용", () => {
  it("길이 경계는 허용하고 공백을 다듬지 않는다", () => {
    // Given
    const min = " ".repeat(INQUIRY_CONTENT_LIMITS.MIN_LENGTH);
    const max = "가".repeat(INQUIRY_CONTENT_LIMITS.MAX_LENGTH);

    // Then
    expect(InquiryContent.create(min).value).toBe(min);
    expect(InquiryContent.create(max).value).toBe(max);
  });

  it("최소보다 짧거나 최대보다 길면 SYS_0002를 던진다", () => {
    // Then
    expect(() => InquiryContent.create("가".repeat(INQUIRY_CONTENT_LIMITS.MIN_LENGTH - 1))).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }),
    );
    expect(() => InquiryContent.create("가".repeat(INQUIRY_CONTENT_LIMITS.MAX_LENGTH + 1))).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }),
    );
  });
});
