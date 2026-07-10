/**
 * Inquiry 외부 경계(어댑터) 통합 테스트
 *
 * @description
 * EmailInquiryMailerAdapter가 EmailService·TypedConfigService와 함께 올바르게
 * 배선되고, 설정에서 읽은 supportEmail로 위임하는지 검증합니다. 실제 이메일은
 * 보내지 않습니다(EmailService는 mock). 전달 실패 시의 예외 처리는 핸들러
 * 단위 테스트가 담당합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test inquiry.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { suppressLogger } from "@test/setup/suppress-logger";
import { EmailFacade } from "@/email";
import { EmailInquiryMailerAdapter } from "@/inquiry/infrastructure/adapters/email-inquiry-mailer.adapter";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

describe("Inquiry 어댑터 통합 테스트 (Mock Email)", () => {
	let module: TestingModule;
	let adapter: EmailInquiryMailerAdapter;

	const mockEmailService = {
		sendInquiry: jest.fn(),
	};

	const mockConfigService = {
		email: {
			supportEmail: "support@aido.kr",
			apiKey: "test",
			from: "noreply@test.com",
			fromName: "Test",
			isConfigured: true,
		},
	};

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				EmailInquiryMailerAdapter,
				{ provide: EmailFacade, useValue: mockEmailService },
				{ provide: TypedConfigService, useValue: mockConfigService },
			],
		}).compile();

		adapter = module.get(EmailInquiryMailerAdapter);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("어댑터가 정상적으로 주입되어야 함", () => {
		expect(adapter).toBeDefined();
		expect(adapter).toBeInstanceOf(EmailInquiryMailerAdapter);
	});

	it("설정의 supportEmail로 문의를 위임한다", async () => {
		// Given
		mockEmailService.sendInquiry.mockResolvedValue({
			success: true,
			messageId: "msg-integration",
		});

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
		expect(result).toEqual({ success: true, error: undefined });
	});

	it("EmailService 실패 결과를 그대로 전달 결과로 매핑한다", async () => {
		// Given
		mockEmailService.sendInquiry.mockResolvedValue({
			success: false,
			error: "Service unavailable",
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
		expect(result).toEqual({
			success: false,
			error: "Service unavailable",
		});
	});
});
