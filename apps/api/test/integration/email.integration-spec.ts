/**
 * EmailService 통합 테스트
 *
 * @description
 * EmailService가 NestJS DI 컨테이너와 함께 올바르게 작동하는지 검증합니다.
 * Resend SDK를 모킹하여 실제 API 호출 없이 전체 서비스 동작을 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - ConfigService와의 통합 검증
 * - 재시도 로직이 실제 환경에서 올바르게 동작하는지 검증
 * - 이메일 템플릿이 올바르게 렌더링되는지 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test email.integration-spec
 * ```
 */

import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { TypedConfigService } from "@/common/config/services/config.service";
import { EMAIL_CONSTANTS } from "@/modules/email/constants/email.constants";
import { EmailService } from "@/modules/email/email.service";

// Resend 모킹용 타입
type ResendMock = {
	emails: {
		send: jest.Mock;
	};
};

describe("EmailService Integration Tests", () => {
	let module: TestingModule;
	let service: EmailService;
	let resendMock: ResendMock;

	// 테스트 데이터
	const testEmail = "integration-test@example.com";
	const testCode = "987654";
	const testExpiryMinutes = 15;

	beforeAll(async () => {
		// Logger 출력 비활성화
		jest.spyOn(Logger.prototype, "log").mockImplementation();
		jest.spyOn(Logger.prototype, "warn").mockImplementation();
		jest.spyOn(Logger.prototype, "error").mockImplementation();
		jest.spyOn(Logger.prototype, "debug").mockImplementation();
	});

	beforeEach(async () => {
		// Resend mock 생성
		resendMock = {
			emails: {
				send: jest.fn(),
			},
		};

		// NestJS 테스트 모듈 생성 - 실제 DI 컨테이너 사용
		module = await Test.createTestingModule({
			providers: [
				EmailService,
				{
					provide: TypedConfigService,
					useValue: {
						email: {
							isConfigured: true,
							apiKey: "test-integration-api-key",
							from: "noreply@integration-test.com",
							fromName: "Integration Test",
						},
					},
				},
			],
		}).compile();

		service = module.get<EmailService>(EmailService);

		// Private Resend 인스턴스를 mock으로 교체
		(service as unknown as { _resend: ResendMock })._resend = resendMock;
	});

	afterEach(async () => {
		jest.clearAllMocks();
		if (module) {
			await module.close();
		}
	});

	describe("DI 통합", () => {
		it("EmailService가 올바르게 인스턴스화된다", () => {
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(EmailService);
		});

		it("ConfigService에서 설정을 올바르게 읽어온다", async () => {
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-integration" },
				error: null,
			});

			await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			// from 필드가 ConfigService에서 가져온 값으로 설정되는지 확인
			expect(resendMock.emails.send).toHaveBeenCalledWith(
				expect.objectContaining({
					from: "Integration Test <noreply@integration-test.com>",
				}),
			);
		});
	});

	describe("재시도 통합 테스트", () => {
		it("재시도 후 성공하면 최종 성공 결과를 반환한다", async () => {
			// 첫 번째 시도: 실패, 두 번째 시도: 성공
			resendMock.emails.send
				.mockResolvedValueOnce({
					data: null,
					error: { name: "application_error", message: "Temporary error" },
				})
				.mockResolvedValueOnce({
					data: { id: "msg-retry-success" },
					error: null,
				});

			// sleep을 mock하여 테스트 속도 향상
			jest
				.spyOn(
					service as unknown as { _sleep: (ms: number) => Promise<void> },
					"_sleep",
				)
				.mockResolvedValue(undefined);

			const result = await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			expect(result.success).toBe(true);
			expect(result.messageId).toBe("msg-retry-success");
			expect(result.retryCount).toBe(1);
			expect(resendMock.emails.send).toHaveBeenCalledTimes(2);
		});

		it("여러 번 재시도 후 성공한다", async () => {
			// 3번 실패 후 성공
			resendMock.emails.send
				.mockResolvedValueOnce({
					data: null,
					error: { name: "application_error", message: "Error 1" },
				})
				.mockResolvedValueOnce({
					data: null,
					error: { name: "rate_limit_exceeded", message: "Error 2" },
				})
				.mockResolvedValueOnce({
					data: null,
					error: { name: "application_error", message: "Error 3" },
				})
				.mockResolvedValueOnce({
					data: { id: "msg-final-success" },
					error: null,
				});

			jest
				.spyOn(
					service as unknown as { _sleep: (ms: number) => Promise<void> },
					"_sleep",
				)
				.mockResolvedValue(undefined);

			const result = await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			expect(result.success).toBe(true);
			expect(result.retryCount).toBe(3);
			expect(resendMock.emails.send).toHaveBeenCalledTimes(4);
		});

		it("최대 재시도 횟수 초과 후 실패한다", async () => {
			// 모든 시도 실패
			resendMock.emails.send.mockResolvedValue({
				data: null,
				error: { name: "application_error", message: "Persistent failure" },
			});

			jest
				.spyOn(
					service as unknown as { _sleep: (ms: number) => Promise<void> },
					"_sleep",
				)
				.mockResolvedValue(undefined);

			const result = await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Persistent failure");
			expect(result.retryCount).toBe(EMAIL_CONSTANTS.MAX_RETRIES);
			// 초기 시도 + MAX_RETRIES
			expect(resendMock.emails.send).toHaveBeenCalledTimes(
				EMAIL_CONSTANTS.MAX_RETRIES + 1,
			);
		});
	});

	describe("템플릿 통합 테스트", () => {
		it("인증 코드 이메일이 올바른 템플릿으로 생성된다", async () => {
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-template" },
				error: null,
			});

			await service.sendVerificationCode(testEmail, {
				code: "123456",
				expiryMinutes: 10,
			});

			const call = resendMock.emails.send.mock.calls[0][0];

			// 템플릿에 인증 코드가 포함되어 있는지 확인
			expect(call.html).toContain("123456");
			expect(call.text).toContain("123456");

			// 만료 시간이 포함되어 있는지 확인
			expect(call.html).toContain("10");
			expect(call.text).toContain("10");

			// subject가 설정되어 있는지 확인
			expect(call.subject).toBeDefined();
			expect(call.subject.length).toBeGreaterThan(0);
		});

		it("비밀번호 재설정 이메일이 올바른 템플릿으로 생성된다", async () => {
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-template" },
				error: null,
			});

			await service.sendPasswordResetCode(testEmail, {
				code: "654321",
				expiryMinutes: 30,
			});

			const call = resendMock.emails.send.mock.calls[0][0];

			// 템플릿에 재설정 코드가 포함되어 있는지 확인
			expect(call.html).toContain("654321");
			expect(call.text).toContain("654321");

			// 만료 시간이 포함되어 있는지 확인
			expect(call.html).toContain("30");
			expect(call.text).toContain("30");
		});
	});

	describe("Idempotency 통합 테스트", () => {
		it("같은 idempotencyKey가 헤더에 올바르게 전달된다", async () => {
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-idempotent" },
				error: null,
			});

			const idempotencyKey = "unique-request-id-12345";

			await service.sendVerificationCode(
				testEmail,
				{ code: testCode, expiryMinutes: testExpiryMinutes },
				idempotencyKey,
			);

			expect(resendMock.emails.send).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: { "Idempotency-Key": idempotencyKey },
				}),
			);
		});

		it("idempotencyKey가 없으면 헤더 없이 요청한다", async () => {
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-no-idempotency" },
				error: null,
			});

			await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			expect(resendMock.emails.send).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: undefined,
				}),
			);
		});
	});

	describe("Tags 통합 테스트", () => {
		it("verification 이메일에 올바른 태그가 포함된다", async () => {
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-tags" },
				error: null,
			});

			await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			const call = resendMock.emails.send.mock.calls[0][0];

			expect(call.tags).toEqual(
				expect.arrayContaining([
					{ name: "type", value: "verification" },
					{ name: "environment", value: expect.any(String) },
				]),
			);
		});

		it("password-reset 이메일에 올바른 태그가 포함된다", async () => {
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-tags" },
				error: null,
			});

			await service.sendPasswordResetCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			const call = resendMock.emails.send.mock.calls[0][0];

			expect(call.tags).toEqual(
				expect.arrayContaining([
					{ name: "type", value: "password-reset" },
					{ name: "environment", value: expect.any(String) },
				]),
			);
		});
	});

	describe("에러 핸들링 통합 테스트", () => {
		it("네트워크 에러 발생 시 적절하게 처리한다", async () => {
			resendMock.emails.send.mockRejectedValue(
				new Error("Network connection failed"),
			);

			jest
				.spyOn(
					service as unknown as { _sleep: (ms: number) => Promise<void> },
					"_sleep",
				)
				.mockResolvedValue(undefined);

			const result = await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Network connection failed");
		});

		it("validation_error는 재시도하지 않고 즉시 실패한다", async () => {
			resendMock.emails.send.mockResolvedValue({
				data: null,
				error: { name: "validation_error", message: "Invalid email format" },
			});

			const result = await service.sendVerificationCode(testEmail, {
				code: testCode,
				expiryMinutes: testExpiryMinutes,
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Invalid email format");
			expect(result.retryCount).toBe(0);
			// 재시도 없이 한 번만 호출
			expect(resendMock.emails.send).toHaveBeenCalledTimes(1);
		});
	});
});
