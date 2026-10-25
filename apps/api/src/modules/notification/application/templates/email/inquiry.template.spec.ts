import {
  getInquiryHtml,
  getInquirySubject,
  getInquiryText,
  type InquiryTemplateData,
} from "./inquiry.template.js";

describe("문의 이메일 템플릿", () => {
  it("결제·구독 문의는 제목과 본문에 분류 라벨을 그대로 싣는다", () => {
    // Given
    const data: InquiryTemplateData = {
      userEmail: "user@example.com",
      category: "PAYMENT",
      categoryLabel: "결제·구독",
      content: "구독을 결제했는데 프리미엄이 적용되지 않습니다.",
      submittedAt: "2026-10-26 10:00 (KST)",
    };

    // When
    const subject = getInquirySubject(data.categoryLabel);
    const text = getInquiryText(data);
    const html = getInquiryHtml(data);

    // Then
    expect(subject).toBe("[아이두 문의접수] [결제·구독]");
    expect(text).toContain("[아이두 문의접수] [결제·구독] user@example.com");
    expect(text).toContain("- 카테고리: 결제·구독");
    expect(html).toContain("결제·구독");
  });
});
