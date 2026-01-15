import { HttpException, HttpStatus } from "@nestjs/common";
import {
	ERROR_CODE,
	ERROR_HTTP_STATUS,
	ERROR_MESSAGE,
	type ErrorCode,
} from "../constants/error.constant";

/**
 * 비즈니스 예외 클래스
 */
export class BusinessException extends HttpException {
	constructor(
		public readonly errorCode: ErrorCode,
		public readonly details?: unknown,
		message?: string,
		statusCode?: HttpStatus,
	) {
		const errorMessage = message || ERROR_MESSAGE[errorCode];
		const httpStatus =
			statusCode || ERROR_HTTP_STATUS[errorCode] || HttpStatus.BAD_REQUEST;

		super(
			{
				success: false,
				error: {
					code: errorCode,
					message: errorMessage,
					details,
				},
				timestamp: Date.now(),
			},
			httpStatus,
		);
	}
}

/**
 * 비즈니스 예외 팩토리 클래스
 */
export class BusinessExceptions {
	// =========================================================================
	// 공통 (Common)
	// =========================================================================
	static userNotFound(userId: string) {
		return new BusinessException(ERROR_CODE.USER_NOT_FOUND, { userId });
	}

	static todoNotFound(todoId: string) {
		return new BusinessException(ERROR_CODE.TODO_NOT_FOUND, { todoId });
	}

	static invalidParameter(details?: unknown) {
		return new BusinessException(ERROR_CODE.INVALID_PARAMETER, details);
	}

	static internalServerError(details?: unknown) {
		return new BusinessException(ERROR_CODE.INTERNAL_SERVER_ERROR, details);
	}

	// =========================================================================
	// 동시성 관련 (Concurrency)
	// =========================================================================
	static optimisticLockError() {
		return new BusinessException(ERROR_CODE.OPTIMISTIC_LOCK_ERROR);
	}

	static concurrentModification() {
		return new BusinessException(ERROR_CODE.CONCURRENT_MODIFICATION);
	}

	// =========================================================================
	// JWT 인증 관련 (JWT Authentication)
	// =========================================================================
	static invalidToken(details?: unknown) {
		return new BusinessException(ERROR_CODE.INVALID_TOKEN, details);
	}

	static tokenExpired() {
		return new BusinessException(ERROR_CODE.TOKEN_EXPIRED);
	}

	static tokenMalformed() {
		return new BusinessException(ERROR_CODE.TOKEN_MALFORMED);
	}

	static refreshTokenInvalid() {
		return new BusinessException(ERROR_CODE.REFRESH_TOKEN_INVALID);
	}

	static refreshTokenExpired() {
		return new BusinessException(ERROR_CODE.REFRESH_TOKEN_EXPIRED);
	}

	static tokenRevoked() {
		return new BusinessException(ERROR_CODE.TOKEN_REVOKED);
	}

	static authenticationRequired() {
		return new BusinessException(ERROR_CODE.AUTHENTICATION_REQUIRED);
	}

	static unauthorizedAccess(details?: unknown) {
		return new BusinessException(ERROR_CODE.UNAUTHORIZED_ACCESS, details);
	}

	// =========================================================================
	// 소셜 로그인 관련 (Social Login)
	// =========================================================================
	static socialAuthFailed(provider: string, details?: Record<string, unknown>) {
		return new BusinessException(ERROR_CODE.SOCIAL_AUTH_FAILED, {
			provider,
			...details,
		});
	}

	static socialTokenInvalid(provider: string) {
		return new BusinessException(ERROR_CODE.SOCIAL_TOKEN_INVALID, { provider });
	}

	static socialTokenExpired(provider: string) {
		return new BusinessException(ERROR_CODE.SOCIAL_TOKEN_EXPIRED, { provider });
	}

	static socialProviderError(
		provider: string,
		details?: Record<string, unknown>,
	) {
		return new BusinessException(ERROR_CODE.SOCIAL_PROVIDER_ERROR, {
			provider,
			...details,
		});
	}

	static socialEmailNotProvided(provider: string) {
		return new BusinessException(ERROR_CODE.SOCIAL_EMAIL_NOT_PROVIDED, {
			provider,
		});
	}

	static socialAccountNotLinked(provider: string) {
		return new BusinessException(ERROR_CODE.SOCIAL_ACCOUNT_NOT_LINKED, {
			provider,
		});
	}

	// =========================================================================
	// 카카오 로그인 (Kakao Login)
	// =========================================================================
	static kakaoAuthFailed(details?: Record<string, unknown>) {
		return new BusinessException(ERROR_CODE.KAKAO_AUTH_FAILED, details);
	}

	static kakaoAuthCodeInvalid() {
		return new BusinessException(ERROR_CODE.KAKAO_AUTH_CODE_INVALID);
	}

	static kakaoTokenRequestFailed(details?: unknown) {
		return new BusinessException(
			ERROR_CODE.KAKAO_TOKEN_REQUEST_FAILED,
			details,
		);
	}

	static kakaoUserInfoFailed(details?: unknown) {
		return new BusinessException(ERROR_CODE.KAKAO_USER_INFO_FAILED, details);
	}

	static kakaoAccountAlreadyLinked(kakaoId: string) {
		return new BusinessException(ERROR_CODE.KAKAO_ACCOUNT_ALREADY_LINKED, {
			kakaoId,
		});
	}

	static kakaoUnlinkFailed(details?: unknown) {
		return new BusinessException(ERROR_CODE.KAKAO_UNLINK_FAILED, details);
	}

	// =========================================================================
	// 애플 로그인 (Apple Login)
	// =========================================================================
	static appleAuthFailed(details?: Record<string, unknown>) {
		return new BusinessException(ERROR_CODE.APPLE_AUTH_FAILED, details);
	}

	static appleIdTokenInvalid() {
		return new BusinessException(ERROR_CODE.APPLE_ID_TOKEN_INVALID);
	}

	static appleAuthCodeInvalid() {
		return new BusinessException(ERROR_CODE.APPLE_AUTH_CODE_INVALID);
	}

	static appleTokenVerificationFailed(details?: unknown) {
		return new BusinessException(
			ERROR_CODE.APPLE_TOKEN_VERIFICATION_FAILED,
			details,
		);
	}

	static appleAccountAlreadyLinked(appleId: string) {
		return new BusinessException(ERROR_CODE.APPLE_ACCOUNT_ALREADY_LINKED, {
			appleId,
		});
	}

	static appleUnlinkFailed(details?: unknown) {
		return new BusinessException(ERROR_CODE.APPLE_UNLINK_FAILED, details);
	}

	static appleRevokeTokenFailed(details?: unknown) {
		return new BusinessException(ERROR_CODE.APPLE_REVOKE_TOKEN_FAILED, details);
	}

	// =========================================================================
	// 구글 로그인 (Google Login)
	// =========================================================================
	static googleAuthFailed(details?: Record<string, unknown>) {
		return new BusinessException(ERROR_CODE.GOOGLE_AUTH_FAILED, details);
	}

	static googleTokenInvalid() {
		return new BusinessException(ERROR_CODE.GOOGLE_TOKEN_INVALID);
	}

	static googleEmailNotProvided() {
		return new BusinessException(ERROR_CODE.GOOGLE_EMAIL_NOT_PROVIDED);
	}

	static googleAccountAlreadyLinked(googleId: string) {
		return new BusinessException(ERROR_CODE.GOOGLE_ACCOUNT_ALREADY_LINKED, {
			googleId,
		});
	}

	static googleUnlinkFailed(details?: unknown) {
		return new BusinessException(ERROR_CODE.GOOGLE_UNLINK_FAILED, details);
	}

	// =========================================================================
	// 네이버 로그인 (Naver Login)
	// =========================================================================
	static naverAuthFailed(details?: Record<string, unknown>) {
		return new BusinessException(ERROR_CODE.NAVER_AUTH_FAILED, details);
	}

	static naverTokenInvalid() {
		return new BusinessException(ERROR_CODE.NAVER_TOKEN_INVALID);
	}

	static naverUserInfoFailed(details?: unknown) {
		return new BusinessException(ERROR_CODE.NAVER_USER_INFO_FAILED, details);
	}

	static naverAccountAlreadyLinked(naverId: string) {
		return new BusinessException(ERROR_CODE.NAVER_ACCOUNT_ALREADY_LINKED, {
			naverId,
		});
	}

	static naverUnlinkFailed(details?: unknown) {
		return new BusinessException(ERROR_CODE.NAVER_UNLINK_FAILED, details);
	}

	// =========================================================================
	// 이메일 인증 (Email Authentication)
	// =========================================================================
	static emailAlreadyRegistered(email: string) {
		return new BusinessException(ERROR_CODE.EMAIL_ALREADY_REGISTERED, {
			email,
		});
	}

	static emailNotFound(email: string) {
		return new BusinessException(ERROR_CODE.EMAIL_NOT_FOUND, { email });
	}

	static emailNotVerified(email: string) {
		return new BusinessException(ERROR_CODE.EMAIL_NOT_VERIFIED, { email });
	}

	static emailVerificationCodeInvalid() {
		return new BusinessException(ERROR_CODE.EMAIL_VERIFICATION_CODE_INVALID);
	}

	static emailVerificationCodeExpired() {
		return new BusinessException(ERROR_CODE.EMAIL_VERIFICATION_CODE_EXPIRED);
	}

	static emailSendFailed(email: string, details?: Record<string, unknown>) {
		return new BusinessException(ERROR_CODE.EMAIL_SEND_FAILED, {
			email,
			...details,
		});
	}

	static invalidCredentials() {
		return new BusinessException(ERROR_CODE.INVALID_CREDENTIALS);
	}

	static invalidPassword() {
		return new BusinessException(ERROR_CODE.INVALID_PASSWORD);
	}

	static passwordMismatch() {
		return new BusinessException(ERROR_CODE.PASSWORD_MISMATCH);
	}

	// =========================================================================
	// 계정 관련 (Account)
	// =========================================================================
	static accountNotFound(provider?: string) {
		return new BusinessException(ERROR_CODE.ACCOUNT_NOT_FOUND, { provider });
	}

	static accountAlreadyExists(details?: unknown) {
		return new BusinessException(ERROR_CODE.ACCOUNT_ALREADY_EXISTS, details);
	}

	static accountSuspended(userId: string) {
		return new BusinessException(ERROR_CODE.ACCOUNT_SUSPENDED, { userId });
	}

	static accountDeleted(userId: string) {
		return new BusinessException(ERROR_CODE.ACCOUNT_DELETED, { userId });
	}

	static accountLocked(email: string, remainingMinutes?: number) {
		return new BusinessException(ERROR_CODE.ACCOUNT_LOCKED, {
			email,
			remainingMinutes,
		});
	}

	static accountPendingVerification(email: string) {
		return new BusinessException(ERROR_CODE.ACCOUNT_PENDING_VERIFICATION, {
			email,
		});
	}

	static cannotUnlinkLastAccount() {
		return new BusinessException(ERROR_CODE.CANNOT_UNLINK_LAST_ACCOUNT);
	}

	// =========================================================================
	// 로그인 시도 제한 (Login Attempts)
	// =========================================================================
	static tooManyLoginAttempts(email: string, remainingMinutes: number) {
		return new BusinessException(ERROR_CODE.TOO_MANY_LOGIN_ATTEMPTS, {
			email,
			remainingMinutes,
		});
	}

	// =========================================================================
	// 세션 관련 (Session)
	// =========================================================================
	static sessionNotFound(sessionId?: string) {
		return new BusinessException(ERROR_CODE.SESSION_NOT_FOUND, { sessionId });
	}

	static sessionExpired(sessionId?: string) {
		return new BusinessException(ERROR_CODE.SESSION_EXPIRED, { sessionId });
	}

	static sessionRevoked(sessionId?: string, reason?: string) {
		return new BusinessException(ERROR_CODE.SESSION_REVOKED, {
			sessionId,
			reason,
		});
	}

	// =========================================================================
	// 토큰 보안 (Token Security)
	// =========================================================================
	static tokenReuseDetected(tokenFamily?: string) {
		return new BusinessException(ERROR_CODE.TOKEN_REUSE_DETECTED, {
			tokenFamily,
		});
	}

	// =========================================================================
	// 인증 코드 (Verification)
	// =========================================================================
	static verificationCodeInvalid() {
		return new BusinessException(ERROR_CODE.VERIFICATION_CODE_INVALID);
	}

	static verificationCodeExpired() {
		return new BusinessException(ERROR_CODE.VERIFICATION_CODE_EXPIRED);
	}

	static verificationResendTooSoon(remainingSeconds: number) {
		return new BusinessException(ERROR_CODE.VERIFICATION_RESEND_TOO_SOON, {
			remainingSeconds,
		});
	}

	static verificationMaxAttemptsExceeded() {
		return new BusinessException(ERROR_CODE.VERIFICATION_MAX_ATTEMPTS_EXCEEDED);
	}
}
