import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { TypedConfigService } from "../../common/config/services/config.service";
import { EMAIL_CONSTANTS } from "./constants/email.constants";
import { EmailService } from "./email.service";

// Resend 모킹용 타입
type ResendMock = {
	emails: {
		send: jest.Mock;
	};
};

describe("EmailService", () => {
	let service: EmailService;
	let resendMock: ResendMock;
	let configServiceMock: Partial<TypedConfigService>;

	// 테스트 데이터
	const testEmail = "test@example.com";
	const testCode = "123456";
	const testExpiryMinutes = 10;
	const testIdempotencyKey = "test-idempotency-key-123";

	beforeEach(async () => {
		// Resend mock 생성
		resendMock = {
			emails: {
				send: jest.fn(),
			},
		};

		// ConfigService mock 생성
		configServiceMock = {
			email: {
				isConfigured: true,
				apiKey: "test-api-key",
				from: "noreply@test.com",
				fromName: "Test App",
				supportEmail: "support@aido.app",
			},
			nodeEnv: "test",
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EmailService,
				{
					provide: TypedConfigService,
					useValue: configServiceMock,
				},
			],
		}).compile();

		// Logger 출력 비활성화
		jest.spyOn(Logger.prototype, "log").mockImplementation();
		jest.spyOn(Logger.prototype, "warn").mockImplementation();
		jest.spyOn(Logger.prototype, "error").mockImplementation();
		jest.spyOn(Logger.prototype, "debug").mockImplementation();

		service = module.get<EmailService>(EmailService);
		// Private Resend 인스턴스를 mock으로 교체
		(service as unknown as { _resend: ResendMock })._resend = resendMock;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("sendVerificationCode", () => {
		it("성공적으로 인증 코드 이메일을 발송한다", async () => {
			// Given
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-12345" },
				error: null,
			});

			// When
			const result = await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// Then
			expect(result.success).toBe(true);
			expect(result.messageId).toBe("msg-12345");
			expect(result.retryCount).toBe(0);
			expect(resendMock.emails.send).toHaveBeenCalledTimes(1);
			expect(resendMock.emails.send).toHaveBeenCalledWith(
				expect.objectContaining({
					to: testEmail,
					tags: expect.arrayContaining([
						{ name: "type", value: "verification" },
					]),
				}),
			);
		});

		it("idempotencyKey가 헤더에 포함된다", async () => {
			// Given
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-12345" },
				error: null,
			});

			// When
			await service.sendVerificationCode(
				testEmail,
				{ code: testCode, expiryMinutes: testExpiryMinutes },
				testIdempotencyKey,
			);

			// Then
			expect(resendMock.emails.send).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: { "Idempotency-Key": testIdempotencyKey },
				}),
			);
		});

		it("idempotencyKey가 없으면 헤더가 undefined이다", async () => {
			// Given
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-12345" },
				error: null,
			});

			// When
			await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// Then
			expect(resendMock.emails.send).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: undefined,
				}),
			);
		});
	});

	describe("sendPasswordResetCode", () => {
		it("성공적으로 비밀번호 재설정 이메일을 발송한다", async () => {
			// Given
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-67890" },
				error: null,
			});

			// When
			const result = await service.sendPasswordResetCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// Then
			expect(result.success).toBe(true);
			expect(result.messageId).toBe("msg-67890");
			expect(resendMock.emails.send).toHaveBeenCalledWith(
				expect.objectContaining({
					to: testEmail,
					tags: expect.arrayContaining([
						{ name: "type", value: "password-reset" },
					]),
				}),
			);
		});
	});

	describe("retry 로직", () => {
		it("application_error 발생 시 재시도한다", async () => {
			// Given
			resendMock.emails.send
				.mockResolvedValueOnce({
					data: null,
					error: { name: "application_error", message: "Server error" },
				})
				.mockResolvedValueOnce({
					data: { id: "msg-success" },
					error: null,
				});

			// sleep을 mock하여 테스트 속도 향상
			const sleepSpy = jest
				.spyOn(
					service as unknown as { _sleep: (ms: number) => Promise<void> },
					"_sleep",
				)
				.mockResolvedValue(undefined);

			// When
			const result = await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// Then
			expect(result.success).toBe(true);
			expect(result.retryCount).toBe(1);
			expect(resendMock.emails.send).toHaveBeenCalledTimes(2);
			expect(sleepSpy).toHaveBeenCalledTimes(1);
		});

		it("rate_limit_exceeded 발생 시 재시도한다", async () => {
			// Given
			resendMock.emails.send
				.mockResolvedValueOnce({
					data: null,
					error: { name: "rate_limit_exceeded", message: "Rate limited" },
				})
				.mockResolvedValueOnce({
					data: { id: "msg-success" },
					error: null,
				});

			jest
				.spyOn(
					service as unknown as { _sleep: (ms: number) => Promise<void> },
					"_sleep",
				)
				.mockResolvedValue(undefined);

			// When
			const result = await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// Then
			expect(result.success).toBe(true);
			expect(result.retryCount).toBe(1);
		});

		it("validation_error 발생 시 재시도하지 않는다", async () => {
			// Given
			resendMock.emails.send.mockResolvedValue({
				data: null,
				error: { name: "validation_error", message: "Invalid email" },
			});

			// When
			const result = await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// Then
			expect(result.success).toBe(false);
			expect(result.error).toBe("Invalid email");
			expect(result.retryCount).toBe(0);
			expect(resendMock.emails.send).toHaveBeenCalledTimes(1);
		});

		it("최대 재시도 횟수 초과 시 실패를 반환한다", async () => {
			// Given
			resendMock.emails.send.mockResolvedValue({
				data: null,
				error: { name: "application_error", message: "Persistent error" },
			});

			jest
				.spyOn(
					service as unknown as { _sleep: (ms: number) => Promise<void> },
					"_sleep",
				)
				.mockResolvedValue(undefined);

			// When
			const result = await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// Then
			expect(result.success).toBe(false);
			expect(result.error).toBe("Persistent error");
			// 최초 시도(0) + MAX_RETRIES(3) 횟수만큼 호출
			expect(resendMock.emails.send).toHaveBeenCalledTimes(
				EMAIL_CONSTANTS.MAX_RETRIES + 1,
			);
			expect(result.retryCount).toBe(EMAIL_CONSTANTS.MAX_RETRIES);
		});

		it("지수 백오프를 적용하여 재시도한다", async () => {
			// Given
			resendMock.emails.send
				.mockResolvedValueOnce({
					data: null,
					error: { name: "application_error", message: "Error 1" },
				})
				.mockResolvedValueOnce({
					data: null,
					error: { name: "application_error", message: "Error 2" },
				})
				.mockResolvedValueOnce({
					data: { id: "msg-success" },
					error: null,
				});

			const sleepSpy = jest
				.spyOn(
					service as unknown as { _sleep: (ms: number) => Promise<void> },
					"_sleep",
				)
				.mockResolvedValue(undefined);

			// When
			await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// Then
			// 지수 백오프 확인: 1초, 2초
			expect(sleepSpy).toHaveBeenNthCalledWith(
				1,
				EMAIL_CONSTANTS.BASE_RETRY_DELAY,
			); // 1000ms
			expect(sleepSpy).toHaveBeenNthCalledWith(
				2,
				EMAIL_CONSTANTS.BASE_RETRY_DELAY * 2,
			); // 2000ms
		});

		it("네트워크 에러 발생 시 재시도한다", async () => {
			// Given
			resendMock.emails.send
				.mockRejectedValueOnce(new Error("Network error"))
				.mockResolvedValueOnce({
					data: { id: "msg-success" },
					error: null,
				});

			jest
				.spyOn(
					service as unknown as { _sleep: (ms: number) => Promise<void> },
					"_sleep",
				)
				.mockResolvedValue(undefined);

			// When
			const result = await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// Then
			expect(result.success).toBe(true);
			expect(result.retryCount).toBe(1);
		});
	});

	describe("Resend가 설정되지 않은 경우", () => {
		beforeEach(async () => {
			configServiceMock = {
				email: {
					isConfigured: false,
					apiKey: "",
					from: "noreply@test.com",
					fromName: "Test App",
					supportEmail: "support@aido.app",
				},
				nodeEnv: "test",
			};

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					EmailService,
					{
						provide: TypedConfigService,
						useValue: configServiceMock,
					},
				],
			}).compile();

			service = module.get<EmailService>(EmailService);
		});

		it("mock 결과를 반환한다", async () => {
			// Given - Resend가 설정되지 않은 상태 (beforeEach에서 설정됨)

			// When
			const result = await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// Then
			expect(result.success).toBe(true);
			expect(result.messageId).toMatch(/^mock-\d+$/);
			expect(result.retryCount).toBe(0);
		});
	});

	describe("tags", () => {
		it("verification 타입 태그가 포함된다", async () => {
			// Given
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-12345" },
				error: null,
			});

			// When
			await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// Then
			const call = resendMock.emails.send.mock.calls[0][0];
			expect(call.tags).toEqual(
				expect.arrayContaining([{ name: "type", value: "verification" }]),
			);
		});

		it("password-reset 타입 태그가 포함된다", async () => {
			// Given
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-12345" },
				error: null,
			});

			// When
			await service.sendPasswordResetCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// Then
			const call = resendMock.emails.send.mock.calls[0][0];
			expect(call.tags).toEqual(
				expect.arrayContaining([{ name: "type", value: "password-reset" }]),
			);
		});

		it("environment 태그가 포함된다", async () => {
			// Given
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-12345" },
				error: null,
			});

			// When
			await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// Then
			const call = resendMock.emails.send.mock.calls[0][0];
			expect(call.tags).toEqual(
				expect.arrayContaining([
					{ name: "environment", value: expect.any(String) },
				]),
			);
		});
	});

	describe("sendInquiry", () => {
		const inquiryData: Parameters<EmailService["sendInquiry"]>[1] = {
			userEmail: "user@example.com",
			category: "BUG_REPORT",
			categoryLabel: "버그 신고",
			content: "앱에서 오류가 발생합니다.",
			submittedAt: "2026-02-13T00:00:00.000Z",
		};

		it("성공적으로 문의 이메일을 발송한다", async () => {
			// Given
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-inquiry-1" },
				error: null,
			});

			// When
			const result = await service.sendInquiry("support@aido.app", inquiryData);

			// Then
			expect(result.success).toBe(true);
			expect(result.messageId).toBe("msg-inquiry-1");
			expect(resendMock.emails.send).toHaveBeenCalledTimes(1);
		});

		it("inquiry 타입 태그가 포함된다", async () => {
			// Given
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-inquiry-2" },
				error: null,
			});

			// When
			await service.sendInquiry("support@aido.app", inquiryData);

			// Then
			const call = resendMock.emails.send.mock.calls[0][0];
			expect(call.tags).toEqual(
				expect.arrayContaining([
					{ name: "type", value: "inquiry" },
					{ name: "category", value: "BUG_REPORT" },
					{ name: "environment", value: expect.any(String) },
				]),
			);
		});

		it("제목에 카테고리 라벨이 포함된다", async () => {
			// Given
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-inquiry-3" },
				error: null,
			});

			// When
			await service.sendInquiry("support@aido.app", inquiryData);

			// Then
			const call = resendMock.emails.send.mock.calls[0][0];
			expect(call.subject).toContain("버그 신고");
		});

		it("문의 HTML 템플릿에 사용자 입력을 escape 처리한다", async () => {
			// Given
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-inquiry-4" },
				error: null,
			});

			// When
			await service.sendInquiry("support@aido.app", {
				userEmail: 'user@example.com"><img src=x onerror=alert(1)>',
				category: "OTHER",
				categoryLabel: "<b>기타</b>",
				content: '<script>alert("xss")</script>',
				submittedAt: "2026-02-13 12:30 (KST)",
			});

			// Then
			const call = resendMock.emails.send.mock.calls[0][0];
			expect(call.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
			expect(call.html).toContain("&lt;b&gt;기타&lt;/b&gt;");
			expect(call.html).toContain(
				"&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
			);
			expect(call.html).not.toContain("<img src=x onerror=alert(1)>");
			expect(call.html).not.toContain('<script>alert("xss")</script>');
		});
	});
});
