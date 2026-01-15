import { VERIFICATION_CODE } from "@aido/validators";
import { Test, type TestingModule } from "@nestjs/testing";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import type { VerificationType } from "@/generated/prisma/client";
import { EmailService } from "@/modules/email/email.service";
import { VerificationRepository } from "../repositories/verification.repository";
import { VerificationService } from "./verification.service";

describe("VerificationService", () => {
	let service: VerificationService;

	const mockVerificationRepository = {
		create: jest.fn(),
		findByToken: jest.fn(),
		findLatestByUserIdAndType: jest.fn(),
		findValidByUserIdAndType: jest.fn(),
		markAsUsed: jest.fn(),
		incrementAttempts: jest.fn(),
		markAsUsedAtomic: jest.fn(),
		invalidateAllByUserIdAndType: jest.fn(),
		countRecentByUserIdAndType: jest.fn(),
		deleteExpired: jest.fn(),
	};

	const mockEmailService = {
		sendVerificationCode: jest.fn(),
		sendPasswordResetCode: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				VerificationService,
				{
					provide: VerificationRepository,
					useValue: mockVerificationRepository,
				},
				{
					provide: EmailService,
					useValue: mockEmailService,
				},
			],
		}).compile();

		service = module.get<VerificationService>(VerificationService);
	});

	describe("createAndSendEmailVerification", () => {
		const userId = "user-123";
		const email = "test@example.com";

		beforeEach(() => {
			mockVerificationRepository.countRecentByUserIdAndType.mockResolvedValue(
				0,
			);
			mockVerificationRepository.invalidateAllByUserIdAndType.mockResolvedValue(
				{
					count: 0,
				},
			);
			mockVerificationRepository.create.mockResolvedValue({
				id: "verification-id",
				userId,
				type: "EMAIL_VERIFY" as VerificationType,
				token: "hashed-token",
				expiresAt: new Date(),
				attempts: 0,
				usedAt: null,
				createdAt: new Date(),
			});
			mockEmailService.sendVerificationCode.mockResolvedValue({
				success: true,
			});
		});

		it("재발송 쿨다운을 확인한다", async () => {
			// Given
			// - beforeEach에서 쿨다운 카운트가 0으로 설정됨

			// When
			await service.createAndSendEmailVerification(userId, email);

			// Then
			expect(
				mockVerificationRepository.countRecentByUserIdAndType,
			).toHaveBeenCalledWith(
				userId,
				"EMAIL_VERIFY",
				expect.any(Date),
				undefined,
			);
		});

		it("기존 미사용 인증 코드를 무효화한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.createAndSendEmailVerification(userId, email);

			// Then
			expect(
				mockVerificationRepository.invalidateAllByUserIdAndType,
			).toHaveBeenCalledWith(userId, "EMAIL_VERIFY", undefined);
		});

		it("6자리 인증 코드를 생성한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			const result = await service.createAndSendEmailVerification(
				userId,
				email,
			);

			// Then
			expect(result.code).toMatch(/^\d{6}$/);
			expect(result.code.length).toBe(VERIFICATION_CODE.LENGTH);
		});

		it("인증 코드를 해시하여 저장한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.createAndSendEmailVerification(userId, email);

			// Then
			expect(mockVerificationRepository.create).toHaveBeenCalledWith(
				{
					userId,
					type: "EMAIL_VERIFY",
					token: expect.any(String),
					expiresAt: expect.any(Date),
				},
				undefined,
			);

			// 저장된 토큰은 해시값 (64자 hex)
			const createCall = mockVerificationRepository.create.mock.calls[0][0];
			expect(createCall.token.length).toBe(64);
		});

		it("만료 시간을 올바르게 설정한다", async () => {
			// Given
			const beforeCall = Date.now();

			// When
			const result = await service.createAndSendEmailVerification(
				userId,
				email,
			);

			// Then
			const afterCall = Date.now();
			const expectedMinExpiry =
				beforeCall + VERIFICATION_CODE.EXPIRY_MINUTES * 60 * 1000;
			const expectedMaxExpiry =
				afterCall + VERIFICATION_CODE.EXPIRY_MINUTES * 60 * 1000;

			expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
				expectedMinExpiry,
			);
			expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry);
		});

		it("인증 코드 이메일을 발송한다", async () => {
			// Given
			// - beforeEach에서 이메일 서비스 mock 설정됨

			// When
			await service.createAndSendEmailVerification(userId, email);

			// Then
			expect(mockEmailService.sendVerificationCode).toHaveBeenCalledWith(
				email,
				{
					code: expect.any(String),
					expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
				},
			);
		});

		it("트랜잭션을 전달한다", async () => {
			// Given
			const mockTx = {} as Parameters<
				typeof service.createAndSendEmailVerification
			>[2];

			// When
			await service.createAndSendEmailVerification(userId, email, mockTx);

			// Then
			expect(
				mockVerificationRepository.countRecentByUserIdAndType,
			).toHaveBeenCalledWith(userId, "EMAIL_VERIFY", expect.any(Date), mockTx);
			expect(
				mockVerificationRepository.invalidateAllByUserIdAndType,
			).toHaveBeenCalledWith(userId, "EMAIL_VERIFY", mockTx);
			expect(mockVerificationRepository.create).toHaveBeenCalledWith(
				expect.any(Object),
				mockTx,
			);
		});

		it("재발송 쿨다운 중이면 VERIFICATION_COOLDOWN 에러를 던진다", async () => {
			// Given
			mockVerificationRepository.countRecentByUserIdAndType.mockResolvedValue(
				1,
			);

			// When & Then
			await expect(
				service.createAndSendEmailVerification(userId, email),
			).rejects.toThrow(BusinessException);
		});

		it("이메일 발송 실패해도 결과를 반환한다", async () => {
			// Given
			mockEmailService.sendVerificationCode.mockResolvedValue({
				success: false,
				error: "SMTP error",
			});

			// When
			const result = await service.createAndSendEmailVerification(
				userId,
				email,
			);

			// Then
			expect(result.code).toBeDefined();
			expect(result.expiresAt).toBeDefined();
		});
	});

	describe("createAndSendPasswordReset", () => {
		const userId = "user-123";
		const email = "test@example.com";

		beforeEach(() => {
			mockVerificationRepository.countRecentByUserIdAndType.mockResolvedValue(
				0,
			);
			mockVerificationRepository.invalidateAllByUserIdAndType.mockResolvedValue(
				{
					count: 0,
				},
			);
			mockVerificationRepository.create.mockResolvedValue({
				id: "verification-id",
				userId,
				type: "PASSWORD_RESET" as VerificationType,
				token: "hashed-token",
				expiresAt: new Date(),
				attempts: 0,
				usedAt: null,
				createdAt: new Date(),
			});
			mockEmailService.sendPasswordResetCode.mockResolvedValue({
				success: true,
			});
		});

		it("비밀번호 재설정 코드를 생성하고 발송한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			const result = await service.createAndSendPasswordReset(userId, email);

			// Then
			expect(result.code).toMatch(/^\d{6}$/);
			expect(mockEmailService.sendPasswordResetCode).toHaveBeenCalledWith(
				email,
				{
					code: expect.any(String),
					expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
				},
			);
		});

		it("PASSWORD_RESET 타입으로 저장한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.createAndSendPasswordReset(userId, email);

			// Then
			expect(mockVerificationRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					type: "PASSWORD_RESET",
				}),
				undefined,
			);
		});

		it("재발송 쿨다운을 확인한다", async () => {
			// Given
			// - beforeEach에서 쿨다운 카운트가 0으로 설정됨

			// When
			await service.createAndSendPasswordReset(userId, email);

			// Then
			expect(
				mockVerificationRepository.countRecentByUserIdAndType,
			).toHaveBeenCalledWith(
				userId,
				"PASSWORD_RESET",
				expect.any(Date),
				undefined,
			);
		});

		it("기존 미사용 코드를 무효화한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.createAndSendPasswordReset(userId, email);

			// Then
			expect(
				mockVerificationRepository.invalidateAllByUserIdAndType,
			).toHaveBeenCalledWith(userId, "PASSWORD_RESET", undefined);
		});

		it("재발송 쿨다운 중이면 VERIFICATION_COOLDOWN 에러를 던진다", async () => {
			// Given
			mockVerificationRepository.countRecentByUserIdAndType.mockResolvedValue(
				1,
			);

			// When & Then
			await expect(
				service.createAndSendPasswordReset(userId, email),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("verifyCode", () => {
		const userId = "user-123";
		const code = "123456";
		const type: VerificationType = "EMAIL_VERIFY";

		// SHA-256 hash of "123456"
		const hashedCode =
			"8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";

		const mockVerification = {
			id: "verification-id",
			userId,
			type,
			token: hashedCode,
			expiresAt: new Date(Date.now() + 10 * 60 * 1000),
			attempts: 0,
			usedAt: null,
			createdAt: new Date(),
		};

		beforeEach(() => {
			mockVerificationRepository.findValidByUserIdAndType.mockResolvedValue(
				mockVerification,
			);
			mockVerificationRepository.markAsUsed.mockResolvedValue(undefined);
			mockVerificationRepository.incrementAttempts.mockResolvedValue(undefined);
		});

		it("올바른 코드로 인증에 성공한다", async () => {
			// Given
			// - beforeEach에서 유효한 인증 코드가 설정됨

			// When
			const result = await service.verifyCode(userId, code, type);

			// Then
			expect(result).toBe(true);
			expect(mockVerificationRepository.markAsUsed).toHaveBeenCalledWith(
				mockVerification.id,
				undefined,
			);
		});

		it("유효한 인증 코드가 없으면 VERIFICATION_CODE_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockVerificationRepository.findValidByUserIdAndType.mockResolvedValue(
				null,
			);

			// When & Then
			await expect(service.verifyCode(userId, code, type)).rejects.toThrow(
				BusinessException,
			);
		});

		it("최대 시도 횟수 초과 시 VERIFICATION_MAX_ATTEMPTS 에러를 던진다", async () => {
			// Given
			mockVerificationRepository.findValidByUserIdAndType.mockResolvedValue({
				...mockVerification,
				attempts: VERIFICATION_CODE.MAX_ATTEMPTS,
			});

			// When & Then
			await expect(service.verifyCode(userId, code, type)).rejects.toThrow(
				BusinessException,
			);
		});

		it("잘못된 코드면 시도 횟수를 증가시키고 INVALID_VERIFICATION_CODE 에러를 던진다", async () => {
			// Given
			const wrongCode = "999999";

			// When & Then
			await expect(service.verifyCode(userId, wrongCode, type)).rejects.toThrow(
				BusinessException,
			);

			expect(mockVerificationRepository.incrementAttempts).toHaveBeenCalledWith(
				mockVerification.id,
			);
		});

		it("인증 성공 시 코드를 사용됨으로 표시한다", async () => {
			// Given
			// - beforeEach에서 유효한 인증 코드가 설정됨

			// When
			await service.verifyCode(userId, code, type);

			// Then
			expect(mockVerificationRepository.markAsUsed).toHaveBeenCalledWith(
				mockVerification.id,
				undefined,
			);
		});

		it("트랜잭션을 전달한다", async () => {
			// Given
			const mockTx = {} as Parameters<typeof service.verifyCode>[3];

			// When
			await service.verifyCode(userId, code, type, mockTx);

			// Then
			expect(
				mockVerificationRepository.findValidByUserIdAndType,
			).toHaveBeenCalledWith(userId, type, mockTx);
			expect(mockVerificationRepository.markAsUsed).toHaveBeenCalledWith(
				mockVerification.id,
				mockTx,
			);
		});

		it("실패 시 시도 횟수는 트랜잭션 외부에서 증가시킨다", async () => {
			// Given
			const mockTx = {} as Parameters<typeof service.verifyCode>[3];
			const wrongCode = "999999";

			// When & Then
			await expect(
				service.verifyCode(userId, wrongCode, type, mockTx),
			).rejects.toThrow(BusinessException);

			// incrementAttempts는 트랜잭션 없이 호출됨 (롤백 방지)
			expect(mockVerificationRepository.incrementAttempts).toHaveBeenCalledWith(
				mockVerification.id,
			);
		});

		it("PASSWORD_RESET 타입도 검증한다", async () => {
			// Given
			const passwordResetType: VerificationType = "PASSWORD_RESET";
			mockVerificationRepository.findValidByUserIdAndType.mockResolvedValue({
				...mockVerification,
				type: passwordResetType,
			});

			// When
			const result = await service.verifyCode(userId, code, passwordResetType);

			// Then
			expect(result).toBe(true);
			expect(
				mockVerificationRepository.findValidByUserIdAndType,
			).toHaveBeenCalledWith(userId, passwordResetType, undefined);
		});
	});
});
