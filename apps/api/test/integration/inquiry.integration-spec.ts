import { Test, type TestingModule } from "@nestjs/testing";
/**
 * Inquiry 외부 경계(어댑터) 통합 테스트
 *
 * @description
 * EmailInquiryMailerAdapter가 EmailService·문의 설정과 함께 올바르게
 * 배선되고, 설정에서 읽은 supportEmail로 위임하는지 검증합니다. 실제 이메일은
 * 보내지 않습니다(EmailService는 mock). 전달 실패 시의 예외 처리는 핸들러
 * 단위 테스트가 담당합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test inquiry.integration-spec
 * ```
 */
import { vi } from "vitest";

import { SendTransactionalEmailUseCase } from "#api/modules/notification/notification-email.public";
import { EmailInquiryMailerAdapter } from "#api/modules/support/inquiries/infrastructure/adapters/email-inquiry-mailer.adapter";
import { supportInquiriesConfig } from "#api/modules/support/inquiries/support-inquiries.config";
import { suppressLogger } from "#test/setup/suppress-logger";

describe("Inquiry 어댑터 통합 테스트 (Mock Email)", () => {
  let module: TestingModule;
  let adapter: EmailInquiryMailerAdapter;

  const mockEmailService = {
    sendInquiry: vi.fn(),
  };

  beforeAll(async () => {
    suppressLogger();

    module = await Test.createTestingModule({
      providers: [
        EmailInquiryMailerAdapter,
        { provide: SendTransactionalEmailUseCase, useValue: mockEmailService },
        { provide: supportInquiriesConfig.KEY, useValue: { supportEmail: "support@aido.kr" } },
      ],
    }).compile();

    adapter = module.get(EmailInquiryMailerAdapter);
  });

  afterAll(async () => {
    await module.close();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("어댑터가 정상적으로 주입되어야 함", () => {
    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(EmailInquiryMailerAdapter);
  });

  it("설정의 supportEmail로 문의를 위임한다", async () => {
    // Given
    mockEmailService.sendInquiry.mockResolvedValue({ status: "sent" });

    // When
    const result = await adapter.deliver({
      userEmail: "test@example.com",
      category: "OTHER",
      categoryLabel: "기타",
      content: "통합 테스트 문의 내용입니다.",
      submittedAt: "2026-07-11 14:30 (KST)",
    });

    // Then
    expect(mockEmailService.sendInquiry).toHaveBeenCalledWith(
      "support@aido.kr",
      expect.objectContaining({
        userEmail: "test@example.com",
        category: "OTHER",
        categoryLabel: "기타",
      }),
    );
    expect(result).toEqual({ status: "sent" });
  });

  it("발송 요청 거절 결과를 그대로 전달 결과로 돌려준다", async () => {
    // Given
    mockEmailService.sendInquiry.mockResolvedValue({
      status: "rejected",
      reason: "delivery_failed",
    });

    // When
    const result = await adapter.deliver({
      userEmail: "fail@example.com",
      category: "FEATURE_REQUEST",
      categoryLabel: "기능 요청",
      content: "기능 요청입니다.",
      submittedAt: "2026-07-11 14:30 (KST)",
    });

    // Then
    expect(result).toEqual({ status: "rejected", reason: "delivery_failed" });
  });
});
