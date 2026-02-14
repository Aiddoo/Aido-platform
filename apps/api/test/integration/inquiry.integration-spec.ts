/**
 * InquiryService 통합 테스트
 *
 * @description
 * InquiryService가 EmailService, TypedConfigService와 함께 올바르게 작동하는지 검증합니다.
 * NestJS DI 컨테이너에서 서비스 주입이 정상적으로 이루어지는지 확인합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test inquiry.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { suppressLogger } from "@test/setup/suppress-logger";
import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { EmailService } from "@/modules/email/email.service";
import { InquiryService } from "@/modules/inquiry/inquiry.service";

describe("InquiryService 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let service: InquiryService;

	// Mock EmailService
	const mockEmailService = {
		sendInquiry: jest.fn(),
	};

	// Mock TypedConfigService
	const mockConfigService = {
		email: {
			supportEmail: "support@aido.app",
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
				InquiryService,
				{
					provide: EmailService,
					useValue: mockEmailService,
				},
				{
					provide: TypedConfigService,
					useValue: mockConfigService,
				},
			],
		}).compile();

		service = module.get<InquiryService>(InquiryService);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("DI 통합 테스트", () => {
		it("InquiryService가 정상적으로 주입되어야 함", () => {
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(InquiryService);
		});
	});

	describe("Config에서 SUPPORT_EMAIL 읽기", () => {
		it("supportEmail을 올바르게 사용해야 함", async () => {
			// Given
			mockEmailService.sendInquiry.mockResolvedValue({
				success: true,
				messageId: "msg-integration",
			});

			// When
			await service.createInquiry({
				userId: "user-integration",
				userEmail: "test@example.com",
				category: "OTHER",
				content: "통합 테스트 문의 내용입니다.",
			});

			// Then
			expect(mockEmailService.sendInquiry).toHaveBeenCalledWith(
				"support@aido.app",
				expect.objectContaining({
					userEmail: "test@example.com",
					category: "OTHER",
					categoryLabel: "기타",
				}),
			);
		});
	});

	describe("EmailService mock 연동 검증", () => {
		it("EmailService.sendInquiry 성공 시 정상 처리", async () => {
			// Given
			mockEmailService.sendInquiry.mockResolvedValue({
				success: true,
				messageId: "msg-success",
			});

			// When & Then - 예외 없이 완료
			await expect(
				service.createInquiry({
					userId: "user-success",
					userEmail: "success@example.com",
					category: "BUG_REPORT",
					content: "버그가 발견되었습니다. 상세 내용입니다.",
				}),
			).resolves.toBeUndefined();
		});

		it("EmailService.sendInquiry 실패 시 BusinessException throw", async () => {
			// Given
			mockEmailService.sendInquiry.mockResolvedValue({
				success: false,
				error: "Service unavailable",
			});

			// When & Then
			await expect(
				service.createInquiry({
					userId: "user-fail",
					userEmail: "fail@example.com",
					category: "FEATURE_REQUEST",
					content: "기능 요청입니다. 새로운 기능을 추가해주세요.",
				}),
			).rejects.toThrow(BusinessException);
		});
	});
});
