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
import { VerificationRepository } from "@/auth/infrastructure/persistence/verification.repository";
import { EmailFacade } from "@/email";
import type { VerificationType } from "@/generated/prisma/client";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { VerificationService } from "./verification.service";

describe("VerificationService — 인증 코드 서비스", () => {
	let service: VerificationService;
	let verificationRepo: Mocked<VerificationRepository>;
	let emailFacade: Mocked<EmailFacade>;

	beforeEach(async () => {
		// Given - Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } =
			await TestBed.solitary(VerificationService).compile();

		service = unit;
		verificationRepo = unitRef.get(VerificationRepository);
		emailFacade = unitRef.get(EmailFacade);
	});

	describe("createAndSendPasswordReset", () => {
		const userId = "user-123";
		const email = "test@example.com";

		beforeEach(() => {
			// Given - 기본 성공 시나리오 설정
			verificationRepo.countRecentByUserIdAndType.mockResolvedValue(0);
			verificationRepo.invalidateAllByUserIdAndType.mockResolvedValue(0);
			verificationRepo.create.mockResolvedValue({
				id: 1,
				userId,
				type: "PASSWORD_RESET" as VerificationType,
				token: "hashed-token",
				expiresAt: new Date(),
				attempts: 0,
				usedAt: null,
				createdAt: new Date(),
			});
			emailFacade.sendPasswordResetCode.mockResolvedValue({
				success: true,
			});
		});

		it("비밀번호 재설정 코드를 생성하고 발송한다", async () => {
			// Given - beforeEach에서 기본 mock 설정됨

			// When
			const result = await service.createAndSendPasswordReset(userId, email);

			// Then
			expect(result.code).toMatch(/^\d{6}$/);
			expect(emailFacade.sendPasswordResetCode).toHaveBeenCalledWith(email, {
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
			verificationRepo.countRecentByUserIdAndType.mockResolvedValue(1);

			// When & Then
			await expect(
				service.createAndSendPasswordReset(userId, email),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("createAndSendPasswordSetup", () => {
		const userId = "user-123";
		const email = "test@example.com";

		beforeEach(() => {
			// Given - 기본 성공 시나리오 설정
			verificationRepo.countRecentByUserIdAndType.mockResolvedValue(0);
			verificationRepo.invalidateAllByUserIdAndType.mockResolvedValue(0);
			verificationRepo.create.mockResolvedValue({
				id: 1,
				userId,
				type: "PASSWORD_SETUP" as VerificationType,
				token: "hashed-token",
				expiresAt: new Date(),
				attempts: 0,
				usedAt: null,
				createdAt: new Date(),
			});
			emailFacade.sendPasswordSetupCode.mockResolvedValue({
				success: true,
			});
		});

		it("PASSWORD_SETUP 타입으로 인증 코드를 생성한다", async () => {
			// Given - beforeEach에서 기본 mock 설정됨

			// When
			const result = await service.createAndSendPasswordSetup(userId, email);

			// Then
			expect(result.code).toMatch(/^\d{6}$/);
			expect(verificationRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					type: "PASSWORD_SETUP",
				}),
				undefined,
			);
		});

		it("이메일로 비밀번호 설정 코드를 발송한다", async () => {
			// Given - beforeEach에서 이메일 서비스 mock 설정됨

			// When
			await service.createAndSendPasswordSetup(userId, email);

			// Then
			expect(emailFacade.sendPasswordSetupCode).toHaveBeenCalledWith(email, {
				code: expect.any(String),
				expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
			});
		});

		it("재발송 쿨다운 중이면 에러를 던진다", async () => {
			// Given
			verificationRepo.countRecentByUserIdAndType.mockResolvedValue(1);

			// When & Then
			await expect(
				service.createAndSendPasswordSetup(userId, email),
			).rejects.toThrow(ApplicationException);
		});

		it("기존 미사용 코드를 무효화한다", async () => {
			// Given - beforeEach에서 기본 mock 설정됨

			// When
			await service.createAndSendPasswordSetup(userId, email);

			// Then
			expect(
				verificationRepo.invalidateAllByUserIdAndType,
			).toHaveBeenCalledWith(userId, "PASSWORD_SETUP", undefined);
		});

		it("재발송 쿨다운을 확인한다", async () => {
			// Given - beforeEach에서 쿨다운 카운트가 0으로 설정됨

			// When
			await service.createAndSendPasswordSetup(userId, email);

			// Then
			expect(verificationRepo.countRecentByUserIdAndType).toHaveBeenCalledWith(
				userId,
				"PASSWORD_SETUP",
				expect.any(Date),
				undefined,
			);
		});

		it("트랜잭션을 전달한다", async () => {
			// Given
			const mockTx = {} as Parameters<
				typeof service.createAndSendPasswordSetup
			>[2];

			// When
			await service.createAndSendPasswordSetup(userId, email, mockTx);

			// Then
			expect(verificationRepo.countRecentByUserIdAndType).toHaveBeenCalledWith(
				userId,
				"PASSWORD_SETUP",
				expect.any(Date),
				mockTx,
			);
			expect(
				verificationRepo.invalidateAllByUserIdAndType,
			).toHaveBeenCalledWith(userId, "PASSWORD_SETUP", mockTx);
			expect(verificationRepo.create).toHaveBeenCalledWith(
				expect.any(Object),
				mockTx,
			);
		});

		it("이메일 발송 실패해도 결과를 반환한다", async () => {
			// Given
			emailFacade.sendPasswordSetupCode.mockResolvedValue({
				success: false,
				error: "SMTP error",
			});

			// When
			const result = await service.createAndSendPasswordSetup(userId, email);

			// Then
			expect(result.code).toBeDefined();
			expect(result.expiresAt).toBeDefined();
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
			id: 1,
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
			verificationRepo.findValidByUserIdAndType.mockResolvedValue(
				mockVerification,
			);
			verificationRepo.markAsUsed.mockResolvedValue(mockVerification);
			verificationRepo.incrementAttempts.mockResolvedValue(mockVerification);
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
			verificationRepo.findValidByUserIdAndType.mockResolvedValue(null);

			// When & Then
			await expect(service.verifyCode(userId, code, type)).rejects.toThrow(
				ApplicationException,
			);
		});

		it("최대 시도 횟수 초과 시 VERIFICATION_MAX_ATTEMPTS 에러를 던진다", async () => {
			// Given
			verificationRepo.findValidByUserIdAndType.mockResolvedValue({
				...mockVerification,
				attempts: VERIFICATION_CODE.MAX_ATTEMPTS,
			});

			// When & Then
			await expect(service.verifyCode(userId, code, type)).rejects.toThrow(
				ApplicationException,
			);
		});

		it("잘못된 코드면 시도 횟수를 증가시키고 INVALID_VERIFICATION_CODE 에러를 던진다", async () => {
			// Given
			const wrongCode = "999999";

			// When & Then
			await expect(service.verifyCode(userId, wrongCode, type)).rejects.toThrow(
				ApplicationException,
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
			).rejects.toThrow(ApplicationException);

			// incrementAttempts는 트랜잭션 없이 호출됨 (롤백 방지)
			expect(verificationRepo.incrementAttempts).toHaveBeenCalledWith(
				mockVerification.id,
			);
		});

		it("PASSWORD_RESET 타입도 검증한다", async () => {
			// Given
			const passwordResetType: VerificationType = "PASSWORD_RESET";
			verificationRepo.findValidByUserIdAndType.mockResolvedValue({
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
