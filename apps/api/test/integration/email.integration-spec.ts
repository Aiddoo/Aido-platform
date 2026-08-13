/**
 * TransactionalEmailSender 통합 테스트
 *
 * @description
 * TransactionalEmailSender가 NestJS DI 컨테이너와 함께 올바르게 작동하는지 검증합니다.
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

import { Test, type TestingModule } from "@nestjs/testing";
import { suppressLogger } from "@test/setup/suppress-logger";
import { TransactionalEmailSender } from "@/email";
import {
	EMAIL_SENDER,
	type EmailSenderPort,
} from "@/email/application/ports/email-sender.port";
import { ResendEmailSenderAdapter } from "@/email/infrastructure/adapters/resend-email-sender.adapter";
import { EMAIL_CONSTANTS } from "@/email/infrastructure/constants/email.constants";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

// Resend 모킹용 타입
type ResendMock = {
	emails: {
		send: jest.Mock;
	};
};

// Resend 생성자를 모킹하여 private #resend 필드에 mock이 주입되도록 함
const resendMock: ResendMock = {
	emails: {
		send: jest.fn(),
	},
};

jest.mock("resend", () => ({
	Resend: jest.fn().mockImplementation(() => resendMock),
}));

describe("TransactionalEmailSender 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let facade: TransactionalEmailSender;

	// 테스트 데이터
	const testEmail = "integration-test@example.com";
	const testCode = "987654";
	const testExpiryMinutes = 15;

	beforeAll(async () => {
		suppressLogger();

		// fake timers를 사용하여 #sleep의 setTimeout을 즉시 실행
		jest.useFakeTimers();

		module = await Test.createTestingModule({
			providers: [
				{
					provide: TransactionalEmailSender,
					inject: [EMAIL_SENDER],
					useFactory: (emailSender: EmailSenderPort) =>
						new TransactionalEmailSender(emailSender),
				},
				{ provide: EMAIL_SENDER, useClass: ResendEmailSenderAdapter },
				{
					provide: TypedConfigService,
					useValue: {
						email: {
							isConfigured: true,
							apiKey: "test-integration-api-key",
							from: "noreply@integration-test.com",
							fromName: "Integration Test",
						},
						nodeEnv: "test",
					},
				},
			],
		}).compile();

		facade = module.get<TransactionalEmailSender>(TransactionalEmailSender);
	});

	afterAll(async () => {
		jest.useRealTimers();
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	/**
	 * #sleep 내부의 setTimeout을 즉시 해소하면서 async 작업을 진행시키는 헬퍼.
	 * promise를 반환하되, 모든 pending timer를 반복적으로 flush한다.
	 */
	async function flushTimersAndAwait<T>(promise: Promise<T>): Promise<T> {
		let resolved = false;
		let result: T;
		let error: unknown;

		promise
			.then((r) => {
				resolved = true;
				result = r;
			})
			.catch((e) => {
				resolved = true;
				error = e;
			});

		// 타이머를 반복적으로 flush하여 재시도 루프 전체를 처리
		while (!resolved) {
			jest.advanceTimersByTime(10_000);
			// microtask queue를 비워서 Promise continuation이 실행되도록 함
			await Promise.resolve();
		}

		if (error) throw error;
		return result!;
	}

	describe("DI 통합", () => {
		it("TransactionalEmailSender가 올바르게 인스턴스화된다", () => {
			// Given - DI 컨테이너가 구성됨

			// When - 서비스 인스턴스 확인

			// Then - 서비스가 정의되어 있어야 함
			expect(facade).toBeDefined();
			expect(facade).toBeInstanceOf(TransactionalEmailSender);
		});

		it("ConfigService에서 설정을 올바르게 읽어온다", async () => {
			// Given - 이메일 발송 성공 응답 설정
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-integration" },
				error: null,
			});

			// When - 인증 코드 이메일 발송
			await flushTimersAndAwait(
				facade.sendVerificationCode(testEmail, {
					code: testCode,
					expiryMinutes: testExpiryMinutes,
				}),
			);

			// Then - ConfigService에서 가져온 from 값이 사용됨
			expect(resendMock.emails.send).toHaveBeenCalledWith(
				expect.objectContaining({
					from: "Integration Test <noreply@integration-test.com>",
				}),
			);
		});
	});

	describe("재시도 통합 테스트", () => {
		it("재시도 후 성공하면 최종 성공 결과를 반환한다", async () => {
			// Given - 첫 번째 시도 실패, 두 번째 시도 성공 설정
			resendMock.emails.send
				.mockResolvedValueOnce({
					data: null,
					error: { name: "application_error", message: "Temporary error" },
				})
				.mockResolvedValueOnce({
					data: { id: "msg-retry-success" },
					error: null,
				});

			// When - 인증 코드 이메일 발송
			const result = await flushTimersAndAwait(
				facade.sendVerificationCode(testEmail, {
					code: testCode,
					expiryMinutes: testExpiryMinutes,
				}),
			);

			// Then - 재시도 후 성공
			expect(result.success).toBe(true);
			expect(result.messageId).toBe("msg-retry-success");
			expect(result.retryCount).toBe(1);
			expect(resendMock.emails.send).toHaveBeenCalledTimes(2);
		});

		it("여러 번 재시도 후 성공한다", async () => {
			// Given - 3번 실패 후 성공 설정
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

			// When - 인증 코드 이메일 발송
			const result = await flushTimersAndAwait(
				facade.sendVerificationCode(testEmail, {
					code: testCode,
					expiryMinutes: testExpiryMinutes,
				}),
			);

			// Then - 3번 재시도 후 성공
			expect(result.success).toBe(true);
			expect(result.retryCount).toBe(3);
			expect(resendMock.emails.send).toHaveBeenCalledTimes(4);
		});

		it("최대 재시도 횟수 초과 후 실패한다", async () => {
			// Given - 모든 시도 실패 설정
			resendMock.emails.send.mockResolvedValue({
				data: null,
				error: { name: "application_error", message: "Persistent failure" },
			});

			// When - 인증 코드 이메일 발송
			const result = await flushTimersAndAwait(
				facade.sendVerificationCode(testEmail, {
					code: testCode,
					expiryMinutes: testExpiryMinutes,
				}),
			);

			// Then - 최대 재시도 후 실패
			expect(result.success).toBe(false);
			expect(result.error).toBe("Persistent failure");
			expect(result.retryCount).toBe(EMAIL_CONSTANTS.MAX_RETRIES);
			expect(resendMock.emails.send).toHaveBeenCalledTimes(
				EMAIL_CONSTANTS.MAX_RETRIES + 1,
			);
		});
	});

	describe("템플릿 통합 테스트", () => {
		it("인증 코드 이메일이 올바른 템플릿으로 생성된다", async () => {
			// Given - 이메일 발송 성공 응답 설정
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-template" },
				error: null,
			});

			// When - 인증 코드 이메일 발송
			await flushTimersAndAwait(
				facade.sendVerificationCode(testEmail, {
					code: "123456",
					expiryMinutes: 10,
				}),
			);

			// Then - 템플릿에 인증 코드와 만료 시간이 포함됨
			const call = resendMock.emails.send.mock.calls[0][0];
			expect(call.html).toContain("123456");
			expect(call.text).toContain("123456");
			expect(call.html).toContain("10");
			expect(call.text).toContain("10");
			expect(call.subject).toBeDefined();
			expect(call.subject.length).toBeGreaterThan(0);
		});

		it("비밀번호 재설정 이메일이 올바른 템플릿으로 생성된다", async () => {
			// Given - 이메일 발송 성공 응답 설정
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-template" },
				error: null,
			});

			// When - 비밀번호 재설정 이메일 발송
			await flushTimersAndAwait(
				facade.sendPasswordResetCode(testEmail, {
					code: "654321",
					expiryMinutes: 30,
				}),
			);

			// Then - 템플릿에 재설정 코드와 만료 시간이 포함됨
			const call = resendMock.emails.send.mock.calls[0][0];
			expect(call.html).toContain("654321");
			expect(call.text).toContain("654321");
			expect(call.html).toContain("30");
			expect(call.text).toContain("30");
		});
	});

	describe("Idempotency 통합 테스트", () => {
		it("같은 idempotencyKey가 헤더에 올바르게 전달된다", async () => {
			// Given - 이메일 발송 성공 응답 및 idempotencyKey 설정
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-idempotent" },
				error: null,
			});
			const idempotencyKey = "unique-request-id-12345";

			// When - idempotencyKey와 함께 이메일 발송
			await flushTimersAndAwait(
				facade.sendVerificationCode(
					testEmail,
					{ code: testCode, expiryMinutes: testExpiryMinutes },
					idempotencyKey,
				),
			);

			// Then - 헤더에 idempotencyKey가 포함됨
			expect(resendMock.emails.send).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: { "Idempotency-Key": idempotencyKey },
				}),
			);
		});

		it("idempotencyKey가 없으면 헤더 없이 요청한다", async () => {
			// Given - 이메일 발송 성공 응답 설정
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-no-idempotency" },
				error: null,
			});

			// When - idempotencyKey 없이 이메일 발송
			await flushTimersAndAwait(
				facade.sendVerificationCode(testEmail, {
					code: testCode,
					expiryMinutes: testExpiryMinutes,
				}),
			);

			// Then - 헤더가 undefined
			expect(resendMock.emails.send).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: undefined,
				}),
			);
		});
	});

	describe("Tags 통합 테스트", () => {
		it("verification 이메일에 올바른 태그가 포함된다", async () => {
			// Given - 이메일 발송 성공 응답 설정
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-tags" },
				error: null,
			});

			// When - 인증 코드 이메일 발송
			await flushTimersAndAwait(
				facade.sendVerificationCode(testEmail, {
					code: testCode,
					expiryMinutes: testExpiryMinutes,
				}),
			);

			// Then - verification 태그가 포함됨
			const call = resendMock.emails.send.mock.calls[0][0];
			expect(call.tags).toEqual(
				expect.arrayContaining([
					{ name: "type", value: "verification" },
					{ name: "environment", value: "test" },
				]),
			);
		});

		it("password-reset 이메일에 올바른 태그가 포함된다", async () => {
			// Given - 이메일 발송 성공 응답 설정
			resendMock.emails.send.mockResolvedValue({
				data: { id: "msg-tags" },
				error: null,
			});

			// When - 비밀번호 재설정 이메일 발송
			await flushTimersAndAwait(
				facade.sendPasswordResetCode(testEmail, {
					code: testCode,
					expiryMinutes: testExpiryMinutes,
				}),
			);

			// Then - password-reset 태그가 포함됨
			const call = resendMock.emails.send.mock.calls[0][0];
			expect(call.tags).toEqual(
				expect.arrayContaining([
					{ name: "type", value: "password-reset" },
					{ name: "environment", value: "test" },
				]),
			);
		});
	});

	describe("에러 핸들링 통합 테스트", () => {
		it("네트워크 에러 발생 시 적절하게 처리한다", async () => {
			// Given - 네트워크 에러 발생 설정
			resendMock.emails.send.mockRejectedValue(
				new Error("Network connection failed"),
			);

			// When - 인증 코드 이메일 발송
			const result = await flushTimersAndAwait(
				facade.sendVerificationCode(testEmail, {
					code: testCode,
					expiryMinutes: testExpiryMinutes,
				}),
			);

			// Then - 실패 결과 반환
			expect(result.success).toBe(false);
			expect(result.error).toBe("Network connection failed");
		});

		it("validation_error는 재시도하지 않고 즉시 실패한다", async () => {
			// Given - validation_error 응답 설정
			resendMock.emails.send.mockResolvedValue({
				data: null,
				error: { name: "validation_error", message: "Invalid email format" },
			});

			// When - 인증 코드 이메일 발송
			const result = await flushTimersAndAwait(
				facade.sendVerificationCode(testEmail, {
					code: testCode,
					expiryMinutes: testExpiryMinutes,
				}),
			);

			// Then - 재시도 없이 즉시 실패
			expect(result.success).toBe(false);
			expect(result.error).toBe("Invalid email format");
			expect(result.retryCount).toBe(0);
			expect(resendMock.emails.send).toHaveBeenCalledTimes(1);
		});
	});
});
