/**
 * InquiryService 모듈 단위 테스트
 *
 * @description
 * InquiryService 모듈의 DI 구성을 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test inquiry.service
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { EmailService } from "@/email/email.service";
import { BusinessException } from "@/shared/application/exceptions/business-exception.service";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { InquiryService } from "./inquiry.service";

describe("InquiryService — 문의 서비스", () => {
	let service: InquiryService;
	let emailService: Mocked<EmailService>;
	let configService: Mocked<TypedConfigService>;

	const mockParams = {
		userId: "user-123",
		userEmail: "user@example.com",
		category: "BUG_REPORT" as const,
		content: "앱에서 할 일 추가 시 가끔 오류가 발생합니다.",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(InquiryService).compile();

		service = unit;
		emailService = unitRef.get(EmailService);
		configService = unitRef.get(TypedConfigService);

		// config.email.supportEmail 기본 설정
		Object.defineProperty(configService, "email", {
			get: () => ({
				supportEmail: "support@aido.kr",
				apiKey: "test",
				from: "noreply@test.com",
				fromName: "Test",
				isConfigured: true,
			}),
			configurable: true,
		});
	});

	describe("createInquiry", () => {
		it("문의 이메일을 성공적으로 발송한다", async () => {
			// Given
			emailService.sendInquiry.mockResolvedValue({
				success: true,
				messageId: "msg-123",
			});

			// When
			await service.createInquiry(mockParams);

			// Then
			expect(emailService.sendInquiry).toHaveBeenCalledWith(
				"support@aido.kr",
				expect.objectContaining({
					userEmail: "user@example.com",
					category: "BUG_REPORT",
					categoryLabel: "버그 신고",
					content: mockParams.content,
					submittedAt: expect.any(String),
				}),
			);
		});

		it("이메일 발송 실패 시 BusinessException을 throw한다", async () => {
			// Given
			emailService.sendInquiry.mockResolvedValue({
				success: false,
				error: "Resend API error",
			});

			// When & Then
			await expect(service.createInquiry(mockParams)).rejects.toThrow(
				BusinessException,
			);
		});

		it("config에서 supportEmail을 올바르게 조회한다", async () => {
			// Given
			Object.defineProperty(configService, "email", {
				get: () => ({
					supportEmail: "custom-support@aido.kr",
					apiKey: "test",
					from: "noreply@test.com",
					fromName: "Test",
					isConfigured: true,
				}),
				configurable: true,
			});

			emailService.sendInquiry.mockResolvedValue({
				success: true,
				messageId: "msg-456",
			});

			// When
			await service.createInquiry(mockParams);

			// Then
			expect(emailService.sendInquiry).toHaveBeenCalledWith(
				"custom-support@aido.kr",
				expect.any(Object),
			);
		});

		describe("카테고리별 한국어 라벨 매핑", () => {
			beforeEach(() => {
				emailService.sendInquiry.mockResolvedValue({
					success: true,
					messageId: "msg-label",
				});
			});

			it("BUG_REPORT → 버그 신고", async () => {
				// When
				await service.createInquiry({
					...mockParams,
					category: "BUG_REPORT",
				});

				// Then
				expect(emailService.sendInquiry).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({ categoryLabel: "버그 신고" }),
				);
			});

			it("FEATURE_REQUEST → 기능 요청", async () => {
				// When
				await service.createInquiry({
					...mockParams,
					category: "FEATURE_REQUEST",
				});

				// Then
				expect(emailService.sendInquiry).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({ categoryLabel: "기능 요청" }),
				);
			});

			it("OTHER → 기타", async () => {
				// When
				await service.createInquiry({ ...mockParams, category: "OTHER" });

				// Then
				expect(emailService.sendInquiry).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({ categoryLabel: "기타" }),
				);
			});
		});
	});
});
