import {
	LOGIN_ATTEMPT,
	type LoginInput,
	type RegisterInput,
	type UpdateProfileInput,
	type VerifyEmailInput,
} from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import { CacheService } from "@/common/cache/cache.service";
import {
	addMilliseconds,
	now,
	subtractMinutes,
	toISOString,
	toISOStringOrNull,
} from "@/common/date";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database";
import type { UserStatus } from "@/generated/prisma/client";
import {
	AUTH_DEFAULTS,
	LOGIN_FAILURE_REASON,
	REVOKE_REASON,
	SECURITY_EVENT,
} from "../constants/auth.constants";
import { AccountRepository } from "../repositories/account.repository";
import { LoginAttemptRepository } from "../repositories/login-attempt.repository";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { SessionRepository } from "../repositories/session.repository";
import { UserRepository } from "../repositories/user.repository";
import type {
	CurrentUserResult,
	LoginResult,
	RefreshTokensResult,
	RegisterResult,
	RequestMetadata,
	SessionInfo,
	UpdateProfileResult,
	VerifyEmailResult,
} from "../types";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { VerificationService } from "./verification.service";

// Re-export types for backward compatibility
export type {
	CurrentUserResult,
	LoginResult,
	RefreshTokensResult,
	RegisterResult,
	RequestMetadata,
	SessionInfo,
	UpdateProfileResult,
	VerifyEmailResult,
};

/**
 * 인증 서비스
 *
 * 회원가입, 이메일 인증, 로그인 등 인증 관련 비즈니스 로직을 담당합니다.
 */
@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly userRepository: UserRepository,
		private readonly accountRepository: AccountRepository,
		private readonly sessionRepository: SessionRepository,
		private readonly loginAttemptRepository: LoginAttemptRepository,
		private readonly securityLogRepository: SecurityLogRepository,
		private readonly passwordService: PasswordService,
		private readonly tokenService: TokenService,
		private readonly verificationService: VerificationService,
		private readonly cacheService: CacheService,
	) {}

	/**
	 * 회원가입
	 *
	 * 1. 이메일 중복 확인
	 * 2. User + Account + UserConsent + Verification 생성 (트랜잭션)
	 * 3. 트랜잭션 후 이메일 인증 코드 발송 (외부 서비스)
	 *
	 * 이메일 발송 실패 시:
	 * - 사용자는 PENDING_VERIFY 상태로 저장됨
	 * - 로그에만 기록됨
	 * - 사용자는 resendVerification()을 통해 재발송 가능
	 * - 외부 서비스 장애가 회원가입을 막지 않음
	 */
	async register(input: RegisterInput): Promise<RegisterResult> {
		const {
			email,
			password,
			name,
			termsAgreed,
			privacyAgreed,
			marketingAgreed,
		} = input;

		// 이메일 중복 확인
		const existingUser = await this.userRepository.findByEmail(email);
		if (existingUser) {
			throw BusinessExceptions.emailAlreadyRegistered(email);
		}

		// 비밀번호 해싱
		const hashedPassword = await this.passwordService.hash(password);

		// 트랜잭션으로 User + Account + UserConsent + Verification 생성
		const result = await this.database.$transaction(async (tx) => {
			// User 생성 (PENDING_VERIFY 상태)
			const newUser = await this.userRepository.create(
				{
					email,
					status: "PENDING_VERIFY",
				},
				tx,
			);

			// Credential Account 생성
			await this.accountRepository.createCredentialAccount(
				newUser.id,
				hashedPassword,
				tx,
			);

			// 프로필 생성
			await this.userRepository.createProfile(newUser.id, { name }, tx);

			// 약관 동의 기록
			const currentTime = now();
			await tx.userConsent.create({
				data: {
					userId: newUser.id,
					termsAgreedAt: termsAgreed ? currentTime : null,
					privacyAgreedAt: privacyAgreed ? currentTime : null,
					marketingAgreedAt: marketingAgreed ? currentTime : null,
				},
			});

			// 푸시 알림 설정 초기화 (기본값: 모두 OFF)
			await tx.userPreference.create({
				data: {
					userId: newUser.id,
					pushEnabled: false,
					nightPushEnabled: false,
				},
			});

			// 이메일 인증 코드 생성 (Verification 레코드만 DB에 저장)
			const verificationResult =
				await this.verificationService.createEmailVerification(newUser.id, tx);

			// 보안 로그 기록
			await this.securityLogRepository.create(
				{
					userId: newUser.id,
					event: SECURITY_EVENT.REGISTRATION,
					ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
					userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
				},
				tx,
			);

			return {
				user: newUser,
				verificationCode: verificationResult.code,
			};
		});

		// 트랜잭션 후 이메일 발송 (외부 서비스)
		// 이메일 발송 실패는 로그만 남고 회원가입은 성공 처리
		try {
			await this.verificationService.sendVerificationEmail(
				email,
				result.verificationCode,
			);
		} catch (error) {
			this.logger.error(
				`Unexpected error sending verification email to ${email}:`,
				error,
			);
		}

		this.logger.log(`User registered: ${result.user.id} (${email})`);

		return {
			userId: result.user.id,
			email: result.user.email,
			message:
				"회원가입이 완료되었습니다. 이메일로 발송된 인증 코드를 확인해주세요.",
		};
	}

	/**
	 * 이메일 인증
	 *
	 * 1. 이메일로 사용자 조회
	 * 2. 상태 확인 (PENDING_VERIFY만 허용)
	 * 3. 인증 코드 검증
	 * 4. 사용자 상태 ACTIVE로 변경
	 * 5. 세션 생성 + JWT 토큰 발급
	 */
	async verifyEmail(
		input: VerifyEmailInput,
		metadata?: { ip?: string; userAgent?: string },
	): Promise<VerifyEmailResult> {
		const { email, code } = input;
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 사용자 조회
		const user = await this.userRepository.findByEmail(email);
		if (!user) {
			throw BusinessExceptions.emailNotFound(email);
		}

		// 상태 확인
		if (user.status !== "PENDING_VERIFY") {
			if (user.emailVerifiedAt) {
				// 이미 인증된 사용자
				throw BusinessExceptions.accountAlreadyExists({
					email,
					message: "이미 인증이 완료된 계정입니다.",
				});
			}
			// 다른 상태 (LOCKED, SUSPENDED 등)
			this._checkUserStatus(user.status, email);
		}

		// 트랜잭션으로 인증 처리
		const result = await this.database.$transaction(async (tx) => {
			// 인증 코드 검증
			await this.verificationService.verifyCode(
				user.id,
				code,
				"EMAIL_VERIFY",
				tx,
			);

			// 이메일 인증 완료 처리 (상태 ACTIVE로 변경)
			await this.userRepository.markEmailVerified(user.id, tx);

			// 토큰 패밀리 생성
			const tokenFamily = this.tokenService.generateTokenFamily();

			// 세션 만료 시간 계산
			const expiresInSeconds =
				this.tokenService.getRefreshTokenExpiresInSeconds();
			const expiresAt = addMilliseconds(expiresInSeconds * 1000);

			// 세션 먼저 생성 (refreshTokenHash 없이)
			const session = await this.sessionRepository.create(
				{
					userId: user.id,
					tokenFamily,
					tokenVersion: 1,
					deviceFingerprint: userAgent,
					userAgent,
					ipAddress: ip,
					expiresAt,
				},
				tx,
			);

			// 실제 세션 ID로 토큰 한 번만 생성
			const tokens = await this.tokenService.generateTokenPair(
				user.id,
				email,
				session.id,
				tokenFamily,
				1,
			);

			// 리프레시 토큰 해시로 세션 업데이트
			const refreshTokenHash = this.tokenService.hashRefreshToken(
				tokens.refreshToken,
			);
			await this.sessionRepository.updateRefreshTokenHash(
				session.id,
				refreshTokenHash,
				tx,
			);

			// 보안 로그 기록
			await this.securityLogRepository.create(
				{
					userId: user.id,
					event: SECURITY_EVENT.EMAIL_VERIFIED,
					ipAddress: ip,
					userAgent,
				},
				tx,
			);

			// 프로필 조회
			const userWithProfile = await this.userRepository.findByIdWithProfile(
				user.id,
				tx,
			);

			return {
				tokens,
				name: userWithProfile?.profile?.name ?? null,
				profileImage: userWithProfile?.profile?.profileImage ?? null,
			};
		});

		this.logger.log(`Email verified: ${user.id} (${email})`);

		return {
			userId: user.id,
			userTag: user.userTag,
			tokens: result.tokens,
			name: result.name,
			profileImage: result.profileImage,
		};
	}

	/**
	 * 인증 코드 재발송
	 *
	 * 1. 사용자 조회
	 * 2. 상태 확인 (PENDING_VERIFY만 허용)
	 * 3. 트랜잭션으로 인증 코드 생성 (쿨다운 확인 포함)
	 * 4. 트랜잭션 후 이메일 발송
	 *
	 * 이메일 발송 실패 시:
	 * - 로그에만 기록됨
	 * - 사용자는 다시 재발송 요청 가능
	 */
	async resendVerification(email: string): Promise<{ message: string }> {
		// 사용자 조회
		const user = await this.userRepository.findByEmail(email);
		if (!user) {
			// 보안상 이메일 존재 여부를 노출하지 않음
			return {
				message: "인증 코드가 발송되었습니다. 이메일을 확인해주세요.",
			};
		}

		// PENDING_VERIFY 상태만 재발송 허용
		if (user.status !== "PENDING_VERIFY") {
			if (user.emailVerifiedAt) {
				throw BusinessExceptions.accountAlreadyExists({
					email,
					message: "이미 인증이 완료된 계정입니다.",
				});
			}
			this._checkUserStatus(user.status, email);
		}

		// 트랜잭션으로 인증 코드 생성 (쿨다운 체크 포함)
		const verificationResult = await this.database.$transaction(async (tx) => {
			return await this.verificationService.createEmailVerification(
				user.id,
				tx,
			);
		});

		// 트랜잭션 후 이메일 발송
		try {
			await this.verificationService.sendVerificationEmail(
				email,
				verificationResult.code,
			);
		} catch (error) {
			this.logger.error(
				`Unexpected error sending verification email to ${email}:`,
				error,
			);
		}

		this.logger.log(`Verification code resent: ${user.id} (${email})`);

		return {
			message: "인증 코드가 발송되었습니다. 이메일을 확인해주세요.",
		};
	}

	/**
	 * 이메일/비밀번호 로그인
	 *
	 * 로그인 플로우:
	 * 1. Rate limiting 확인 (30분 내 5회 실패 시 잠금)
	 * 2. 사용자 + Credential 계정 조회
	 * 3. 비밀번호 검증
	 * 4. 사용자 상태 확인 (PENDING_VERIFY는 이메일 인증 필요)
	 * 5. 세션 생성 + JWT 토큰 발급
	 *
	 * @throws accountLocked - 로그인 시도 횟수 초과
	 * @throws invalidCredentials - 이메일 또는 비밀번호 불일치
	 * @throws emailNotVerified - 이메일 미인증 (소셜 로그인과 다르게 처리)
	 */
	async login(
		input: LoginInput,
		metadata?: RequestMetadata,
	): Promise<LoginResult> {
		const { email, password, deviceName } = input;
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 1. 로그인 시도 횟수 확인
		const lockoutSince = subtractMinutes(LOGIN_ATTEMPT.LOCKOUT_MINUTES);
		const recentFailures =
			await this.loginAttemptRepository.countRecentFailuresByEmail(
				email,
				lockoutSince,
			);

		if (recentFailures >= LOGIN_ATTEMPT.MAX_FAILURES) {
			throw BusinessExceptions.accountLocked(email);
		}

		// 2. 사용자 + 계정 조회
		const user = await this.userRepository.findByEmail(email);
		if (!user) {
			// 로그인 실패 기록 (사용자 없음)
			await this.loginAttemptRepository.create({
				email,
				provider: "CREDENTIAL",
				ipAddress: ip,
				userAgent,
				success: false,
				failureReason: LOGIN_FAILURE_REASON.USER_NOT_FOUND,
			});
			throw BusinessExceptions.invalidCredentials();
		}

		const account = await this.accountRepository.findByUserIdAndProvider(
			user.id,
			"CREDENTIAL",
		);
		if (!account || !account.password) {
			// Credential 계정이 아닌 경우 (소셜 로그인 등)
			await this.loginAttemptRepository.create({
				email,
				provider: "CREDENTIAL",
				ipAddress: ip,
				userAgent,
				success: false,
				failureReason: LOGIN_FAILURE_REASON.NO_CREDENTIAL_ACCOUNT,
			});
			throw BusinessExceptions.invalidCredentials();
		}

		// 3. 비밀번호 검증
		const isPasswordValid = await this.passwordService.verify(
			account.password,
			password,
		);
		if (!isPasswordValid) {
			await this.loginAttemptRepository.create({
				email,
				provider: "CREDENTIAL",
				ipAddress: ip,
				userAgent,
				success: false,
				failureReason: LOGIN_FAILURE_REASON.INVALID_PASSWORD,
			});

			// 남은 시도 횟수 계산
			const remainingAttempts = LOGIN_ATTEMPT.MAX_FAILURES - recentFailures - 1;
			if (remainingAttempts <= 0) {
				throw BusinessExceptions.accountLocked(email);
			}

			throw BusinessExceptions.invalidCredentials();
		}

		// 4. 사용자 상태 확인
		if (user.status === "PENDING_VERIFY") {
			throw BusinessExceptions.emailNotVerified(email);
		}
		this._checkUserStatus(user.status, email);

		// 5. 세션 생성 + JWT 토큰 발급 (트랜잭션)
		const result = await this.database.$transaction(async (tx) => {
			// 토큰 패밀리 생성
			const tokenFamily = this.tokenService.generateTokenFamily();

			// 세션 만료 시간 계산
			const expiresInSeconds =
				this.tokenService.getRefreshTokenExpiresInSeconds();
			const expiresAt = addMilliseconds(expiresInSeconds * 1000);

			// 세션 먼저 생성 (refreshTokenHash 없이)
			const session = await this.sessionRepository.create(
				{
					userId: user.id,
					tokenFamily,
					tokenVersion: 1,
					deviceFingerprint: deviceName ?? userAgent,
					userAgent,
					ipAddress: ip,
					expiresAt,
				},
				tx,
			);

			// 실제 세션 ID로 토큰 한 번만 생성
			const tokens = await this.tokenService.generateTokenPair(
				user.id,
				email,
				session.id,
				tokenFamily,
				1,
			);

			// 리프레시 토큰 해시로 세션 업데이트
			const refreshTokenHash = this.tokenService.hashRefreshToken(
				tokens.refreshToken,
			);
			await this.sessionRepository.updateRefreshTokenHash(
				session.id,
				refreshTokenHash,
				tx,
			);

			// 로그인 성공 기록
			await this.loginAttemptRepository.create(
				{
					email,
					provider: "CREDENTIAL",
					ipAddress: ip,
					userAgent,
					success: true,
				},
				tx,
			);

			// 보안 로그 기록
			await this.securityLogRepository.create(
				{
					userId: user.id,
					event: SECURITY_EVENT.LOGIN_SUCCESS,
					ipAddress: ip,
					userAgent,
				},
				tx,
			);

			// 프로필 조회
			const userWithProfile = await this.userRepository.findByIdWithProfile(
				user.id,
				tx,
			);

			return {
				tokens,
				sessionId: session.id,
				name: userWithProfile?.profile?.name ?? null,
				profileImage: userWithProfile?.profile?.profileImage ?? null,
			};
		});

		this.logger.log(`User logged in: ${user.id} (${email})`);

		return {
			userId: user.id,
			userTag: user.userTag,
			tokens: result.tokens,
			sessionId: result.sessionId,
			name: result.name,
			profileImage: result.profileImage,
		};
	}

	/**
	 * 로그아웃
	 *
	 * 현재 세션만 만료 처리
	 */
	async logout(
		userId: string,
		sessionId: string,
		metadata?: RequestMetadata,
	): Promise<{ message: string }> {
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 세션 조회
		const session = await this.sessionRepository.findById(sessionId);
		if (!session || session.userId !== userId) {
			throw BusinessExceptions.sessionNotFound();
		}

		// 이미 만료된 세션
		if (session.revokedAt) {
			throw BusinessExceptions.sessionExpired();
		}

		// 세션 만료 처리
		await this.sessionRepository.revoke(sessionId, REVOKE_REASON.USER_LOGOUT);

		// 캐시 무효화 (로그아웃 즉시 반영)
		await this.cacheService.invalidateSession(sessionId);

		// 보안 로그 기록
		await this.securityLogRepository.create({
			userId,
			event: SECURITY_EVENT.LOGOUT,
			ipAddress: ip,
			userAgent,
		});

		this.logger.log(`User logged out: ${userId}, session: ${sessionId}`);

		return { message: "로그아웃되었습니다." };
	}

	/**
	 * 전체 로그아웃
	 *
	 * 모든 세션 만료 처리
	 */
	async logoutAll(
		userId: string,
		metadata?: RequestMetadata,
	): Promise<{ message: string; revokedCount: number }> {
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 모든 세션 만료 처리
		const revokedCount = await this.sessionRepository.revokeAllByUserId(
			userId,
			REVOKE_REASON.USER_LOGOUT_ALL,
		);

		// NOTE: 세션 캐시는 30초 TTL로 자동 만료됨
		// 개별 세션 ID를 조회하는 추가 쿼리 없이 TTL 만료에 의존
		// 보안상 30초 지연은 허용 가능한 수준

		// 보안 로그 기록
		await this.securityLogRepository.create({
			userId,
			event: SECURITY_EVENT.SESSION_REVOKED_ALL,
			ipAddress: ip,
			userAgent,
			metadata: { revokedCount },
		});

		this.logger.log(
			`User logged out from all devices: ${userId}, revoked: ${revokedCount}`,
		);

		return {
			message: "모든 기기에서 로그아웃되었습니다.",
			revokedCount,
		};
	}

	/**
	 * 토큰 갱신 (Token Rotation)
	 *
	 * 1. 리프레시 토큰 검증
	 * 2. 세션 조회 및 유효성 확인
	 * 3. 토큰 재사용 감지 (previousTokenHash)
	 * 4. 새 토큰 쌍 발급
	 * 5. 세션 업데이트 (Token Rotation)
	 */
	async refreshTokens(
		refreshToken: string,
		metadata?: RequestMetadata,
	): Promise<RefreshTokensResult> {
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 1. 리프레시 토큰 검증
		const payload = await this.tokenService.verifyRefreshToken(refreshToken);
		if (!payload) {
			throw BusinessExceptions.sessionExpired();
		}

		const { sub: userId, email, sessionId } = payload;

		// sessionId가 없으면 유효하지 않은 토큰
		if (!sessionId) {
			throw BusinessExceptions.sessionNotFound();
		}

		// 2. 리프레시 토큰 해시로 세션 조회
		const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);
		const session =
			await this.sessionRepository.findByRefreshTokenHash(refreshTokenHash);

		// 세션이 없으면 이전 토큰 해시에서 검색 (재사용 감지)
		if (!session) {
			const reusedSession =
				await this.sessionRepository.findByPreviousTokenHash(refreshTokenHash);

			if (reusedSession) {
				// 토큰 재사용 감지! 전체 토큰 패밀리 폐기
				await this.sessionRepository.revokeByTokenFamily(
					reusedSession.tokenFamily,
					REVOKE_REASON.TOKEN_REUSE_DETECTED,
				);

				// 보안 로그 기록
				await this.securityLogRepository.create({
					userId: reusedSession.userId,
					event: SECURITY_EVENT.SUSPICIOUS_ACTIVITY,
					ipAddress: ip,
					userAgent,
					metadata: {
						reason: REVOKE_REASON.TOKEN_REUSE_DETECTED,
						tokenFamily: reusedSession.tokenFamily,
					},
				});

				this.logger.warn(
					`Token reuse detected for user: ${reusedSession.userId}`,
				);
				throw BusinessExceptions.tokenReuseDetected();
			}

			throw BusinessExceptions.sessionNotFound();
		}

		// 3. 세션 유효성 확인
		if (session.revokedAt) {
			throw BusinessExceptions.sessionRevoked();
		}

		if (session.expiresAt < now()) {
			throw BusinessExceptions.sessionExpired();
		}

		if (session.userId !== userId || session.id !== sessionId) {
			throw BusinessExceptions.sessionNotFound();
		}

		// 4. 새 토큰 쌍 발급
		const newTokenVersion = session.tokenVersion + 1;
		const newTokens = await this.tokenService.generateTokenPair(
			userId,
			email,
			sessionId,
			session.tokenFamily,
			newTokenVersion,
		);

		// 5. 세션 업데이트 (Token Rotation with Optimistic Locking)
		const newRefreshTokenHash = this.tokenService.hashRefreshToken(
			newTokens.refreshToken,
		);

		const rotatedSession = await this.sessionRepository.rotateToken(sessionId, {
			refreshTokenHash: newRefreshTokenHash,
			tokenVersion: newTokenVersion,
			previousTokenHash: refreshTokenHash, // 이전 토큰 해시 저장 (재사용 감지용)
			expectedTokenVersion: session.tokenVersion, // 낙관적 잠금: 레이스 컨디션 방지
		});

		// 로테이션 실패 시 (다른 요청이 먼저 로테이션함)
		if (!rotatedSession) {
			this.logger.warn(
				`Token rotation race condition detected for session: ${sessionId}`,
			);
			throw BusinessExceptions.sessionExpired();
		}

		// 보안 로그 기록
		await this.securityLogRepository.create({
			userId,
			event: SECURITY_EVENT.TOKEN_REFRESH,
			ipAddress: ip,
			userAgent,
		});

		this.logger.debug(
			`Token refreshed for user: ${userId}, session: ${sessionId}`,
		);

		return {
			tokens: newTokens,
			sessionId,
		};
	}

	// ============================================
	// 비밀번호 재설정 (Phase 5)
	// ============================================

	/**
	 * 비밀번호 찾기 - 재설정 코드 발송
	 */
	async forgotPassword(email: string): Promise<{ message: string }> {
		// 사용자 존재 확인 (존재하지 않아도 보안상 동일한 응답)
		const user = await this.userRepository.findByEmail(email);

		if (user) {
			// 인증 코드 생성 및 이메일 발송
			await this.verificationService.createAndSendPasswordReset(user.id, email);

			this.logger.debug(`Password reset code sent to: ${email}`);
		} else {
			this.logger.debug(
				`Password reset requested for non-existent email: ${email}`,
			);
		}

		// 보안상 동일한 응답 (이메일 존재 여부 노출 방지)
		return {
			message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다.",
		};
	}

	/**
	 * 비밀번호 재설정
	 *
	 * 트랜잭션으로 인증 코드 검증, 비밀번호 변경, 세션 무효화를 원자적으로 처리
	 */
	async resetPassword(
		email: string,
		code: string,
		newPassword: string,
	): Promise<{ message: string }> {
		// 사용자 조회
		const user = await this.userRepository.findByEmail(email);
		if (!user) {
			throw BusinessExceptions.verificationCodeInvalid();
		}

		// Credential Account 조회
		const account = await this.accountRepository.findByUserIdAndProvider(
			user.id,
			"CREDENTIAL",
		);
		if (!account) {
			throw BusinessExceptions.invalidCredentials();
		}

		// 새 비밀번호 해싱 (트랜잭션 밖에서 수행 - CPU 작업)
		const hashedPassword = await this.passwordService.hash(newPassword);

		// 트랜잭션으로 인증 검증 + 비밀번호 변경 + 세션 무효화 + 로그 기록
		await this.database.$transaction(async (tx) => {
			// 인증 코드 검증 (PASSWORD_RESET 타입)
			await this.verificationService.verifyCode(
				user.id,
				code,
				"PASSWORD_RESET",
				tx,
			);

			// 비밀번호 업데이트
			await this.accountRepository.updatePassword(user.id, hashedPassword, tx);

			// 모든 세션 무효화 (보안상)
			await this.sessionRepository.revokeAllByUserId(
				user.id,
				REVOKE_REASON.PASSWORD_RESET,
				undefined, // excludeSessionId - 모든 세션 무효화
				tx,
			);

			// 보안 로그 기록
			await this.securityLogRepository.create(
				{
					userId: user.id,
					event: SECURITY_EVENT.PASSWORD_CHANGED,
					ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
					userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
					metadata: { email, reason: REVOKE_REASON.PASSWORD_RESET },
				},
				tx,
			);
		});

		this.logger.log(`Password reset completed for: ${email}`);

		return { message: "비밀번호가 재설정되었습니다. 다시 로그인해주세요." };
	}

	/**
	 * 비밀번호 변경 (로그인 상태)
	 *
	 * 트랜잭션으로 비밀번호 변경과 로그 기록을 원자적으로 처리
	 */
	async changePassword(
		userId: string,
		currentPassword: string,
		newPassword: string,
		metadata?: RequestMetadata,
	): Promise<{ message: string }> {
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// Credential Account 조회
		const account = await this.accountRepository.findByUserIdAndProvider(
			userId,
			"CREDENTIAL",
		);
		if (!account || !account.password) {
			throw BusinessExceptions.invalidCredentials();
		}

		// 현재 비밀번호 검증
		const isValid = await this.passwordService.verify(
			account.password,
			currentPassword,
		);
		if (!isValid) {
			throw BusinessExceptions.invalidCredentials();
		}

		// 새 비밀번호 해싱 (트랜잭션 밖에서 수행 - CPU 작업)
		const hashedPassword = await this.passwordService.hash(newPassword);

		// 트랜잭션으로 비밀번호 변경 + 로그 기록
		await this.database.$transaction(async (tx) => {
			// 비밀번호 업데이트
			await this.accountRepository.updatePassword(userId, hashedPassword, tx);

			// 보안 로그 기록
			await this.securityLogRepository.create(
				{
					userId,
					event: SECURITY_EVENT.PASSWORD_CHANGED,
					ipAddress: ip,
					userAgent,
				},
				tx,
			);
		});

		this.logger.log(`Password changed for user: ${userId}`);

		return { message: "비밀번호가 변경되었습니다." };
	}

	// ============================================
	// 세션 관리 (Phase 5)
	// ============================================

	/**
	 * 활성 세션 목록 조회
	 */
	async getActiveSessions(userId: string): Promise<SessionInfo[]> {
		const sessions = await this.sessionRepository.findActiveByUserId(userId);

		return sessions.map((session) => ({
			id: session.id,
			deviceName: null, // DB에 미구현 (향후 확장)
			deviceType: null, // DB에 미구현 (향후 확장)
			ipAddress: session.ipAddress,
			userAgent: session.userAgent,
			lastActiveAt: session.lastUsedAt, // DB 필드 → API 필드 매핑
			createdAt: session.createdAt,
			isCurrent: false, // 컨트롤러에서 설정
		}));
	}

	/**
	 * 특정 세션 종료
	 */
	async revokeSession(
		userId: string,
		sessionId: string,
		metadata?: RequestMetadata,
	): Promise<{ message: string }> {
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 세션 조회
		const session = await this.sessionRepository.findById(sessionId);
		if (!session || session.userId !== userId) {
			throw BusinessExceptions.sessionNotFound();
		}

		// 세션 폐기
		await this.sessionRepository.revoke(sessionId, REVOKE_REASON.USER_REVOKE);

		// 캐시 무효화 (즉시 반영)
		await this.cacheService.invalidateSession(sessionId);

		// 보안 로그 기록
		await this.securityLogRepository.create({
			userId,
			event: SECURITY_EVENT.SESSION_REVOKED,
			ipAddress: ip,
			userAgent,
			metadata: { revokedSessionId: sessionId },
		});

		this.logger.debug(`Session revoked: ${sessionId} for user: ${userId}`);

		return { message: "세션이 종료되었습니다." };
	}

	// ============================================
	// 프로필 관리
	// ============================================

	/**
	 * 현재 사용자 정보 조회 (프로필 포함)
	 */
	async getCurrentUser(
		userId: string,
		_email: string,
		sessionId: string,
	): Promise<CurrentUserResult> {
		const user = await this.userRepository.findByIdWithProfile(userId);

		if (!user) {
			throw BusinessExceptions.userNotFound(userId);
		}

		return {
			userId: user.id,
			email: user.email,
			sessionId,
			userTag: user.userTag,
			status: user.status,
			emailVerifiedAt: toISOStringOrNull(user.emailVerifiedAt),
			subscriptionStatus: user.subscriptionStatus,
			subscriptionExpiresAt: toISOStringOrNull(user.subscriptionExpiresAt),
			name: user.profile?.name ?? null,
			profileImage: user.profile?.profileImage ?? null,
			createdAt: toISOString(user.createdAt),
		};
	}

	/**
	 * 프로필 수정
	 */
	async updateProfile(
		userId: string,
		data: UpdateProfileInput,
	): Promise<UpdateProfileResult> {
		const profile = await this.userRepository.updateProfile(userId, data);

		// 캐시 무효화 (프로필 변경)
		await this.cacheService.invalidateUserProfile(userId);

		this.logger.log(`Profile updated for user: ${userId}`);

		return {
			message: "프로필이 수정되었습니다.",
			name: profile.name,
			profileImage: profile.profileImage,
		};
	}

	// ============================================
	// Private Helpers
	// ============================================

	/**
	 * 사용자 상태 확인 및 예외 처리
	 */
	private _checkUserStatus(status: UserStatus, email: string): void {
		switch (status) {
			case "LOCKED":
				throw BusinessExceptions.accountLocked(email);
			case "SUSPENDED":
				throw BusinessExceptions.accountSuspended(email);
			default:
				// ACTIVE, PENDING_VERIFY는 여기서 처리하지 않음
				break;
		}
	}
}
