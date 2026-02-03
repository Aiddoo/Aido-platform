/**
 * VerificationService 테스트 (Suites 패턴)
 *
 * NestJS 공식 권장 Suites 라이브러리 사용
 * - 자동 Mock 생성으로 보일러플레이트 제거
 * - GWT 주석으로 테스트 의도 명확화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */
import { VERIFICATION_CODE } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import type { VerificationType } from "@/generated/prisma/client";
import { EmailService } from "@/modules/email/email.service";
import { VerificationRepository } from "../repositories/verification.repository";
import { VerificationService } from "./verification.service";

describe("VerificationService", () => {
	let service: VerificationService;
	let verificationRepo: Mocked<VerificationRepository>;
	let emailService: Mocked<EmailService>;

	beforeEach(async () => {
		// Given - Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } =
			await TestBed.solitary(VerificationService).compile();

		service = unit;
		verificationRepo = unitRef.get(
			VerificationRepository,
		) as unknown as Mocked<VerificationRepository>;
		emailService = unitRef.get(EmailService) as unknown as Mocked<EmailService>;
	});

	describe("createAndSendEmailVerification", () => {
		const userId = "user-123";
		const email = "test@example.com";

		beforeEach(() => {
			// Given - 기본 성공 시나리오 설정
			(
				verificationRepo.countRecentByUserIdAndType as jest.Mock
			).mockResolvedValue(0);
			(
				verificationRepo.invalidateAllByUserIdAndType as jest.Mock
			).mockResolvedValue({ count: 0 });
			(verificationRepo.create as jest.Mock).mockResolvedValue({
				id: "verification-id",
				userId,
				type: "EMAIL_VERIFY" as VerificationType,
				token: "hashed-token",
				expiresAt: new Date(),
				attempts: 0,
				usedAt: null,
				createdAt: new Date(),
			});
			(emailService.sendVerificationCode as jest.Mock).mockResolvedValue({
				success: true,
			});
		});

		it("재발송 쿨다운을 확인한다", async () => {
			// Given - beforeEach에서 쿨다운 카운트가 0으로 설정됨

			// When
			await service.createAndSendEmailVerification(userId, email);

			// Then
			expect(verificationRepo.countRecentByUserIdAndType).toHaveBeenCalledWith(
				userId,
				"EMAIL_VERIFY",
				expect.any(Date),
				undefined,
			);
		});

		it("기존 미사용 인증 코드를 무효화한다", async () => {
			// Given - beforeEach에서 기본 mock 설정됨

			// When
			await service.createAndSendEmailVerification(userId, email);

			// Then
			expect(
				verificationRepo.invalidateAllByUserIdAndType,
			).toHaveBeenCalledWith(userId, "EMAIL_VERIFY", undefined);
		});

		it("6자리 인증 코드를 생성한다", async () => {
			// Given - beforeEach에서 기본 mock 설정됨

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
			// Given - beforeEach에서 기본 mock 설정됨

			// When
			await service.createAndSendEmailVerification(userId, email);

			// Then
			expect(verificationRepo.create).toHaveBeenCalledWith(
				{
					userId,
					type: "EMAIL_VERIFY",
					token: expect.any(String),
					expiresAt: expect.any(Date),
				},
				undefined,
			);

			// 저장된 토큰은 해시값 (64자 hex)
			const createCall = (verificationRepo.create as jest.Mock).mock
				.calls[0][0];
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
			// Given - beforeEach에서 이메일 서비스 mock 설정됨

			// When
			await service.createAndSendEmailVerification(userId, email);

			// Then
			expect(emailService.sendVerificationCode).toHaveBeenCalledWith(email, {
				code: expect.any(String),
				expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
			});
		});

		it("트랜잭션을 전달한다", async () => {
			// Given
			const mockTx = {} as Parameters<
				typeof service.createAndSendEmailVerification
			>[2];

			// When
			await service.createAndSendEmailVerification(userId, email, mockTx);

			// Then
			expect(verificationRepo.countRecentByUserIdAndType).toHaveBeenCalledWith(
				userId,
				"EMAIL_VERIFY",
				expect.any(Date),
				mockTx,
			);
			expect(
				verificationRepo.invalidateAllByUserIdAndType,
			).toHaveBeenCalledWith(userId, "EMAIL_VERIFY", mockTx);
			expect(verificationRepo.create).toHaveBeenCalledWith(
				expect.any(Object),
				mockTx,
			);
		});

		it("재발송 쿨다운 중이면 VERIFICATION_COOLDOWN 에러를 던진다", async () => {
			// Given
			(
				verificationRepo.countRecentByUserIdAndType as jest.Mock
			).mockResolvedValue(1);

			// When & Then
			await expect(
				service.createAndSendEmailVerification(userId, email),
			).rejects.toThrow(BusinessException);
		});

		it("이메일 발송 실패해도 결과를 반환한다", async () => {
			// Given
			(emailService.sendVerificationCode as jest.Mock).mockResolvedValue({
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
			// Given - 기본 성공 시나리오 설정
			(
				verificationRepo.countRecentByUserIdAndType as jest.Mock
			).mockResolvedValue(0);
			(
				verificationRepo.invalidateAllByUserIdAndType as jest.Mock
			).mockResolvedValue({ count: 0 });
			(verificationRepo.create as jest.Mock).mockResolvedValue({
				id: "verification-id",
				userId,
				type: "PASSWORD_RESET" as VerificationType,
				token: "hashed-token",
				expiresAt: new Date(),
				attempts: 0,
				usedAt: null,
				createdAt: new Date(),
			});
			(emailService.sendPasswordResetCode as jest.Mock).mockResolvedValue({
				success: true,
			});
		});

		it("비밀번호 재설정 코드를 생성하고 발송한다", async () => {
			// Given - beforeEach에서 기본 mock 설정됨

			// When
			const result = await service.createAndSendPasswordReset(userId, email);

			// Then
			expect(result.code).toMatch(/^\d{6}$/);
			expect(emailService.sendPasswordResetCode).toHaveBeenCalledWith(email, {
				code: expect.any(String),
				expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
			});
		});

		it("PASSWORD_RESET 타입으로 저장한다", async () => {
			// Given - beforeEach에서 기본 mock 설정됨

			// When
			await service.createAndSendPasswordReset(userId, email);

			// Then
			expect(verificationRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					type: "PASSWORD_RESET",
				}),
				undefined,
			);
		});

		it("재발송 쿨다운을 확인한다", async () => {
			// Given - beforeEach에서 쿨다운 카운트가 0으로 설정됨

			// When
			await service.createAndSendPasswordReset(userId, email);

			// Then
			expect(verificationRepo.countRecentByUserIdAndType).toHaveBeenCalledWith(
				userId,
				"PASSWORD_RESET",
				expect.any(Date),
				undefined,
			);
		});

		it("기존 미사용 코드를 무효화한다", async () => {
			// Given - beforeEach에서 기본 mock 설정됨

			// When
			await service.createAndSendPasswordReset(userId, email);

			// Then
			expect(
				verificationRepo.invalidateAllByUserIdAndType,
			).toHaveBeenCalledWith(userId, "PASSWORD_RESET", undefined);
		});

		it("재발송 쿨다운 중이면 VERIFICATION_COOLDOWN 에러를 던진다", async () => {
			// Given
			(
				verificationRepo.countRecentByUserIdAndType as jest.Mock
			).mockResolvedValue(1);

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
			// Given - 기본 성공 시나리오 설정
			(
				verificationRepo.findValidByUserIdAndType as jest.Mock
			).mockResolvedValue(mockVerification);
			(verificationRepo.markAsUsed as jest.Mock).mockResolvedValue(undefined);
			(verificationRepo.incrementAttempts as jest.Mock).mockResolvedValue(
				undefined,
			);
		});

		it("올바른 코드로 인증에 성공한다", async () => {
			// Given - beforeEach에서 유효한 인증 코드가 설정됨

			// When
			const result = await service.verifyCode(userId, code, type);

			// Then
			expect(result).toBe(true);
			expect(verificationRepo.markAsUsed).toHaveBeenCalledWith(
				mockVerification.id,
				undefined,
			);
		});

		it("유효한 인증 코드가 없으면 VERIFICATION_CODE_NOT_FOUND 에러를 던진다", async () => {
			// Given
			(
				verificationRepo.findValidByUserIdAndType as jest.Mock
			).mockResolvedValue(null);

			// When & Then
			await expect(service.verifyCode(userId, code, type)).rejects.toThrow(
				BusinessException,
			);
		});

		it("최대 시도 횟수 초과 시 VERIFICATION_MAX_ATTEMPTS 에러를 던진다", async () => {
			// Given
			(
				verificationRepo.findValidByUserIdAndType as jest.Mock
			).mockResolvedValue({
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

			expect(verificationRepo.incrementAttempts).toHaveBeenCalledWith(
				mockVerification.id,
			);
		});

		it("인증 성공 시 코드를 사용됨으로 표시한다", async () => {
			// Given - beforeEach에서 유효한 인증 코드가 설정됨

			// When
			await service.verifyCode(userId, code, type);

			// Then
			expect(verificationRepo.markAsUsed).toHaveBeenCalledWith(
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
			expect(verificationRepo.findValidByUserIdAndType).toHaveBeenCalledWith(
				userId,
				type,
				mockTx,
			);
			expect(verificationRepo.markAsUsed).toHaveBeenCalledWith(
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
			expect(verificationRepo.incrementAttempts).toHaveBeenCalledWith(
				mockVerification.id,
			);
		});

		it("PASSWORD_RESET 타입도 검증한다", async () => {
			// Given
			const passwordResetType: VerificationType = "PASSWORD_RESET";
			(
				verificationRepo.findValidByUserIdAndType as jest.Mock
			).mockResolvedValue({
				...mockVerification,
				type: passwordResetType,
			});

			// When
			const result = await service.verifyCode(userId, code, passwordResetType);

			// Then
			expect(result).toBe(true);
			expect(verificationRepo.findValidByUserIdAndType).toHaveBeenCalledWith(
				userId,
				passwordResetType,
				undefined,
			);
		});
	});
});
