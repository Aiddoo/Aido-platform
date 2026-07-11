import {
	type DeleteAccountInput,
	LOGIN_ATTEMPT,
	type LoginInput,
	type RegisterInput,
	type UpdateProfileInput,
	type VerifyEmailInput,
} from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import {
	AdminNotificationFacade,
	type UserRegisteredEventPayload,
} from "@/admin-notification";
import { Prisma, type UserStatus } from "@/generated/prisma/client";
import { BusinessExceptions } from "@/shared/application/exceptions/business-exception.service";
import {
	addMilliseconds,
	subtractDays,
	subtractMinutes,
} from "@/shared/domain/date/utils/arithmetic";
import { now } from "@/shared/domain/date/utils/core";
import {
	toISOString,
	toISOStringOrNull,
} from "@/shared/domain/date/utils/format";
import { maskEmail } from "@/shared/domain/utils/mask.util";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { DatabaseService } from "@/shared/infrastructure/database";
import type { TransactionClient } from "@/shared/infrastructure/database/prisma.types";
import { DEFAULT_CATEGORIES, TodoCategoryRepository } from "@/todo-category";
import {
	UserConsentRepository,
	UserPreferenceRepository,
} from "@/user-settings";
import {
	ACCOUNT_DELETION,
	AUTH_DEFAULTS,
	LOGIN_FAILURE_REASON,
	REVOKE_REASON,
	SECURITY_EVENT,
	TOKEN_REUSE_GRACE_PERIOD_MS,
} from "../constants/auth.constants";
import { AccountRepository } from "../repositories/account.repository";
import { LoginAttemptRepository } from "../repositories/login-attempt.repository";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { SessionRepository } from "../repositories/session.repository";
import { UserRepository } from "../repositories/user.repository";
import type {
	CurrentUserResult,
	DeleteAccountResult,
	LoginResult,
	RefreshTokensResult,
	RegisterResult,
	RequestMetadata,
	SessionInfo,
	UpdateProfileResult,
	VerifyEmailResult,
} from "../types";
import type { VerifiedRefreshPayload } from "../types/auth.types";
import { assertNotDeleted } from "../utils/auth-validation.utils";
import { PasswordService } from "./password.service";
import { SessionService } from "./session.service";
import { TokenService } from "./token.service";
import { VerificationService } from "./verification.service";

@Injectable()
export class AuthService {
	readonly #logger = new Logger(AuthService.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly userRepository: UserRepository,
		private readonly accountRepository: AccountRepository,
		private readonly sessionRepository: SessionRepository,
		private readonly loginAttemptRepository: LoginAttemptRepository,
		private readonly securityLogRepository: SecurityLogRepository,
		private readonly userConsentRepository: UserConsentRepository,
		private readonly userPreferenceRepository: UserPreferenceRepository,
		private readonly todoCategoryRepository: TodoCategoryRepository,
		private readonly passwordService: PasswordService,
		private readonly sessionService: SessionService,
		private readonly tokenService: TokenService,
		private readonly verificationService: VerificationService,
		private readonly cacheService: CacheService,
		private readonly adminNotificationFacade: AdminNotificationFacade,
	) {}

	async register(
		input: RegisterInput,
		metadata?: RequestMetadata,
	): Promise<RegisterResult> {
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

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
		let result: {
			user: { id: string; email: string };
			verificationCode: string;
		};
		try {
			result = await this.database.$transaction(async (tx) => {
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
				await this.userConsentRepository.create(
					newUser.id,
					{
						termsAgreedAt: termsAgreed ? currentTime : undefined,
						privacyAgreedAt: privacyAgreed ? currentTime : undefined,
						marketingAgreedAt: marketingAgreed ? currentTime : undefined,
					},
					tx,
				);

				// 푸시 알림 설정 초기화 (기본값: 모두 ON)
				await this.userPreferenceRepository.create(
					newUser.id,
					{ pushEnabled: true, nightPushEnabled: true },
					tx,
				);

				// 기본 카테고리 생성 (온보딩 필수 데이터 — 트랜잭션 내 동기 처리)
				await this.todoCategoryRepository.createMany(
					DEFAULT_CATEGORIES.map((category) => ({
						userId: newUser.id,
						name: category.name,
						color: category.color,
						sortOrder: category.sortOrder,
					})),
					tx,
				);

				// 이메일 인증 코드 생성 (Verification 레코드만 DB에 저장)
				const verificationResult =
					await this.verificationService.createEmailVerification(
						newUser.id,
						tx,
					);

				// 보안 로그 기록
				await this.securityLogRepository.create(
					{
						userId: newUser.id,
						event: SECURITY_EVENT.REGISTRATION,
						ipAddress: ip,
						userAgent,
					},
					tx,
				);

				return {
					user: newUser,
					verificationCode: verificationResult.code,
				};
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				const rawTarget = error.meta?.target;
				const target = Array.isArray(rawTarget)
					? (rawTarget as string[])
					: undefined;
				if (target?.includes("email")) {
					throw BusinessExceptions.emailAlreadyRegistered(email);
				}
			}
			throw error;
		}

		// 트랜잭션 후 이메일 발송 (외부 서비스)
		// 이메일 발송 실패는 로그만 남고 회원가입은 성공 처리
		let emailSent = true;
		try {
			await this.verificationService.sendVerificationEmail(
				email,
				result.verificationCode,
			);
		} catch (error) {
			emailSent = false;
			this.#logger.error(
				`Unexpected error sending verification email to ${maskEmail(email)}:`,
				error,
			);
		}

		this.#logger.log(
			`User registered: ${result.user.id} (${maskEmail(email)})`,
		);

		this.adminNotificationFacade.notifyUserRegistered({
			userId: result.user.id,
			email: result.user.email,
			provider: "credential",
			registeredAt: toISOString(now()),
		} satisfies UserRegisteredEventPayload);

		return {
			userId: result.user.id,
			email: result.user.email,
			emailSent,
			message: emailSent
				? "회원가입이 완료되었습니다. 이메일로 발송된 인증 코드를 확인해주세요."
				: "회원가입이 완료되었습니다. 인증 이메일 발송에 실패했습니다. 잠시 후 이메일 재발송을 시도해주세요.",
		};
	}

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

		// 탈퇴 사용자 체크
		assertNotDeleted(user);

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
			this.#checkUserStatus(user.status, email);
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

			// 세션 생성 + 토큰 발급
			const { tokens } = await this.sessionService.createSessionWithTokens(
				{
					userId: user.id,
					email,
					role: user.role,
					deviceFingerprint: userAgent,
					userAgent,
					ipAddress: ip,
				},
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

		this.#logger.log(`Email verified: ${user.id} (${maskEmail(email)})`);

		return {
			userId: user.id,
			userTag: user.userTag,
			tokens: result.tokens,
			name: result.name,
			profileImage: result.profileImage,
		};
	}

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
			this.#checkUserStatus(user.status, email);
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
			this.#logger.error(
				`Unexpected error sending verification email to ${maskEmail(email)}:`,
				error,
			);
		}

		this.#logger.log(
			`Verification code resent: ${user.id} (${maskEmail(email)})`,
		);

		return {
			message: "인증 코드가 발송되었습니다. 이메일을 확인해주세요.",
		};
	}

	// Rate limiting: 30분 내 5회 실패 시 잠금
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
			// 보안 로그 기록
			await this.securityLogRepository.create({
				event: SECURITY_EVENT.ACCOUNT_LOCKED,
				ipAddress: ip,
				userAgent,
				metadata: { email, recentFailures },
			});

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
		if (!account?.password) {
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

		// 4. 비밀번호 해시 파라미터 업그레이드 (비동기, fire-and-forget)
		if (this.passwordService.needsRehash(account.password)) {
			this.passwordService
				.hash(password)
				.then((newHash) =>
					this.accountRepository.updatePassword(user.id, newHash),
				)
				.then(() =>
					this.#logger.debug(`Password rehashed for user: ${user.id}`),
				)
				.catch((err) =>
					this.#logger.error(`Password rehash failed for ${user.id}:`, err),
				);
		}

		// 5. 사용자 상태 확인 (탈퇴 유예 기간 내 복구 처리)
		const needsRestore = this.#isWithinGracePeriod(user);

		if (!needsRestore) {
			if (user.status === "PENDING_VERIFY") {
				throw BusinessExceptions.emailNotVerified(email);
			}
			this.#checkUserStatus(user.status, email);
		}

		// 5. 세션 생성 + JWT 토큰 발급 (트랜잭션)
		const result = await this.database.$transaction(async (tx) => {
			// 유예 기간 내 탈퇴 계정 복구
			if (needsRestore) {
				await this.#restoreDeletedAccount(user, { ip, userAgent }, tx);
			}

			// 세션 생성 + 토큰 발급
			const { sessionId, tokens } =
				await this.sessionService.createSessionWithTokens(
					{
						userId: user.id,
						email,
						role: user.role,
						deviceFingerprint: deviceName ?? userAgent,
						userAgent,
						ipAddress: ip,
					},
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
				sessionId,
				name: userWithProfile?.profile?.name ?? null,
				profileImage: userWithProfile?.profile?.profileImage ?? null,
			};
		});

		// 복구된 계정의 캐시 무효화
		if (needsRestore) {
			await this.cacheService.invalidateUserProfile(user.id);
			this.#logger.log(
				`Deleted account restored on login: ${user.id} (${maskEmail(email)})`,
			);
		}

		this.#logger.log(`User logged in: ${user.id} (${maskEmail(email)})`);

		return {
			userId: user.id,
			userTag: user.userTag,
			tokens: result.tokens,
			sessionId: result.sessionId,
			name: result.name,
			profileImage: result.profileImage,
			accountRestored: needsRestore,
		};
	}

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

		this.#logger.log(`User logged out: ${userId}, session: ${sessionId}`);

		return { message: "로그아웃되었습니다." };
	}

	async logoutAll(
		userId: string,
		metadata?: RequestMetadata,
	): Promise<{ message: string; revokedCount: number }> {
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 활성 세션 ID 조회 (캐시 무효화용, revoke 전에 조회)
		const activeSessions =
			await this.sessionRepository.findActiveByUserId(userId);

		// 모든 세션 만료 처리
		const revokedCount = await this.sessionRepository.revokeAllByUserId(
			userId,
			REVOKE_REASON.USER_LOGOUT_ALL,
		);

		// 모든 세션 캐시 즉시 무효화
		await Promise.all(
			activeSessions.map((s) => this.cacheService.invalidateSession(s.id)),
		);

		// 보안 로그 기록
		await this.securityLogRepository.create({
			userId,
			event: SECURITY_EVENT.SESSION_REVOKED_ALL,
			ipAddress: ip,
			userAgent,
			metadata: { revokedCount },
		});

		this.#logger.log(
			`User logged out from all devices: ${userId}, revoked: ${revokedCount}`,
		);

		return {
			message: "모든 기기에서 로그아웃되었습니다.",
			revokedCount,
		};
	}

	// Token Rotation: 토큰 재사용 감지 시 전체 패밀리 폐기
	async refreshTokens(
		refreshToken: string,
		verifiedPayload: VerifiedRefreshPayload,
		metadata?: RequestMetadata,
	): Promise<RefreshTokensResult> {
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		const { userId, email, sessionId, role } = verifiedPayload;

		if (!sessionId) {
			throw BusinessExceptions.sessionNotFound();
		}

		// 2. 리프레시 토큰 해시로 세션 조회
		const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);
		const session =
			await this.sessionRepository.findByRefreshTokenHash(refreshTokenHash);

		// 세션이 없으면 sessionId(PK)로 조회 — O(1) PK lookup
		if (!session) {
			// sessionId(PK)로 조회 — O(1) PK lookup
			const currentSession = await this.sessionRepository.findById(sessionId);

			// previousTokenHash가 제출된 토큰 해시와 일치 → 이전 토큰 재사용
			if (currentSession?.previousTokenHash === refreshTokenHash) {
				// Grace period 확인
				const timeSinceLastRotation =
					Date.now() - new Date(currentSession.lastUsedAt).getTime();

				if (timeSinceLastRotation <= TOKEN_REUSE_GRACE_PERIOD_MS) {
					// 네트워크 재시도로 판단 → 새 토큰 발급
					this.#logger.debug(
						`Token retry within grace period for session: ${currentSession.id} (${timeSinceLastRotation}ms)`,
					);

					this.sessionService.assertSessionValid(currentSession);

					if (
						currentSession.userId !== userId ||
						currentSession.id !== sessionId
					) {
						throw BusinessExceptions.sessionNotFound();
					}

					const newTokenVersion = currentSession.tokenVersion + 1;
					const newTokens = await this.tokenService.generateTokenPair(
						userId,
						email,
						sessionId,
						role,
						currentSession.tokenFamily,
						newTokenVersion,
					);

					const newRefreshTokenHash = this.tokenService.hashRefreshToken(
						newTokens.refreshToken,
					);
					const refreshExpiresInSeconds =
						this.tokenService.getRefreshTokenExpiresInSeconds();
					const newExpiresAt = addMilliseconds(refreshExpiresInSeconds * 1000);

					// Sliding window 방지: previousTokenHash를 현재 세션의 refreshTokenHash로 설정
					// → 동일 옛 토큰으로의 재시도는 1회만 허용
					const rotatedSession = await this.sessionRepository.rotateToken(
						sessionId,
						{
							refreshTokenHash: newRefreshTokenHash,
							tokenVersion: newTokenVersion,
							previousTokenHash: currentSession.refreshTokenHash, // ← 핵심: 옛 토큰이 아닌 현재 토큰
							expectedTokenVersion: currentSession.tokenVersion,
							expiresAt: newExpiresAt,
						},
					);

					if (!rotatedSession) {
						throw BusinessExceptions.sessionExpired();
					}

					await this.securityLogRepository.create({
						userId,
						event: SECURITY_EVENT.TOKEN_REFRESH,
						ipAddress: ip,
						userAgent,
						metadata: { retryWithinGracePeriod: true },
					});

					return { tokens: newTokens, sessionId };
				}

				// Grace period 초과 → 토큰 재사용 공격
				await this.sessionRepository.revokeByTokenFamily(
					currentSession.tokenFamily,
					REVOKE_REASON.TOKEN_REUSE_DETECTED,
				);

				await this.securityLogRepository.create({
					userId: currentSession.userId,
					event: SECURITY_EVENT.SUSPICIOUS_ACTIVITY,
					ipAddress: ip,
					userAgent,
					metadata: {
						reason: REVOKE_REASON.TOKEN_REUSE_DETECTED,
						tokenFamily: currentSession.tokenFamily,
					},
				});

				this.#logger.warn(
					`Token reuse detected for user: ${currentSession.userId}`,
				);
				throw BusinessExceptions.tokenReuseDetected();
			}

			throw BusinessExceptions.sessionNotFound();
		}

		// 3. 세션 유효성 확인
		this.sessionService.assertSessionValid(session);

		if (session.userId !== userId || session.id !== sessionId) {
			throw BusinessExceptions.sessionNotFound();
		}

		// 4. 새 토큰 쌍 발급
		const newTokenVersion = session.tokenVersion + 1;
		const newTokens = await this.tokenService.generateTokenPair(
			userId,
			email,
			sessionId,
			role,
			session.tokenFamily,
			newTokenVersion,
		);

		// 5. 세션 업데이트 (Token Rotation with Optimistic Locking)
		const newRefreshTokenHash = this.tokenService.hashRefreshToken(
			newTokens.refreshToken,
		);

		const refreshExpiresInSeconds =
			this.tokenService.getRefreshTokenExpiresInSeconds();
		const newExpiresAt = addMilliseconds(refreshExpiresInSeconds * 1000);

		const rotatedSession = await this.sessionRepository.rotateToken(sessionId, {
			refreshTokenHash: newRefreshTokenHash,
			tokenVersion: newTokenVersion,
			previousTokenHash: refreshTokenHash, // 이전 토큰 해시 저장 (재사용 감지용)
			expectedTokenVersion: session.tokenVersion, // 낙관적 잠금: 레이스 컨디션 방지
			expiresAt: newExpiresAt,
		});

		// 로테이션 실패 시 (다른 요청이 먼저 로테이션함)
		if (!rotatedSession) {
			this.#logger.warn(
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

		this.#logger.debug(
			`Token refreshed for user: ${userId}, session: ${sessionId}`,
		);

		return {
			tokens: newTokens,
			sessionId,
		};
	}

	async getActiveSessions(userId: string): Promise<SessionInfo[]> {
		const sessions = await this.sessionRepository.findActiveByUserId(userId);

		return sessions.map((session) => ({
			id: session.id,
			deviceName: null, // DB에 미구현 (향후 확장)
			deviceType: null, // DB에 미구현 (향후 확장)
			ipAddress: session.ipAddress,
			userAgent: session.userAgent,
			lastActiveAt: toISOString(session.lastUsedAt), // DB 필드 → API 필드 매핑
			createdAt: toISOString(session.createdAt),
			isCurrent: false, // 컨트롤러에서 설정
		}));
	}

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

		this.#logger.debug(`Session revoked: ${sessionId} for user: ${userId}`);

		return { message: "세션이 종료되었습니다." };
	}

	async getCurrentUser(
		userId: string,
		_email: string,
		sessionId: string,
	): Promise<CurrentUserResult> {
		// wrapUserProfile을 사용하여 캐시된 프로필 조회 또는 DB에서 조회
		const cachedProfile = await this.cacheService.wrapUserProfile(
			userId,
			async () => {
				const user = await this.userRepository.findByIdWithProfile(userId);
				if (!user) {
					return undefined;
				}
				return {
					id: user.id,
					email: user.email,
					role: user.role,
					userTag: user.userTag,
					status: user.status,
					emailVerifiedAt: toISOStringOrNull(user.emailVerifiedAt),
					subscriptionStatus: user.subscriptionStatus,
					subscriptionExpiresAt: toISOStringOrNull(user.subscriptionExpiresAt),
					name: user.profile?.name ?? null,
					profileImage: user.profile?.profileImage ?? null,
					createdAt: toISOString(user.createdAt),
					providers: user.accounts.map((a) => a.provider),
				};
			},
		);

		if (!cachedProfile) {
			throw BusinessExceptions.userNotFound(userId);
		}

		return {
			userId: cachedProfile.id,
			email: cachedProfile.email,
			sessionId,
			role: cachedProfile.role,
			userTag: cachedProfile.userTag,
			status: cachedProfile.status,
			emailVerifiedAt: cachedProfile.emailVerifiedAt,
			subscriptionStatus: cachedProfile.subscriptionStatus,
			subscriptionExpiresAt: cachedProfile.subscriptionExpiresAt,
			name: cachedProfile.name,
			profileImage: cachedProfile.profileImage,
			createdAt: cachedProfile.createdAt,
			providers: cachedProfile.providers,
		};
	}

	async updateProfile(
		userId: string,
		data: UpdateProfileInput,
	): Promise<UpdateProfileResult> {
		const profile = await this.userRepository.updateProfile(userId, data);

		// 캐시 무효화 (프로필 변경)
		await this.cacheService.invalidateUserProfile(userId);

		this.#logger.log(`Profile updated for user: ${userId}`);

		return {
			message: "프로필이 수정되었습니다.",
			name: profile.name,
			profileImage: profile.profileImage,
		};
	}

	async deleteAccount(
		userId: string,
		_sessionId: string,
		input: DeleteAccountInput,
		metadata?: RequestMetadata,
	): Promise<DeleteAccountResult> {
		const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
		const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

		// 1. 사용자 조회 + 이미 탈퇴 여부 확인
		const user = await this.userRepository.findById(userId);
		if (!user) throw BusinessExceptions.userNotFound(userId);
		assertNotDeleted(user);

		// 2. 계정 유형에 따른 본인 확인
		const accounts = await this.accountRepository.findAllByUserId(userId);
		const credentialAccount = accounts.find((a) => a.provider === "CREDENTIAL");

		if (credentialAccount) {
			if (!input.password) {
				throw BusinessExceptions.accountDeletionPasswordRequired();
			}
			const credentialPassword = credentialAccount.password;
			if (!credentialPassword) {
				throw BusinessExceptions.invalidCredentials();
			}
			const isValid = await this.passwordService.verify(
				credentialPassword,
				input.password,
			);
			if (!isValid) throw BusinessExceptions.invalidCredentials();
		}
		// 소셜 전용: JWT 인증 통과 = 확인 완료

		// 3. 활성 세션 ID 조회 (캐시 무효화용, 트랜잭션 전에 조회)
		const activeSessions =
			await this.sessionRepository.findActiveByUserId(userId);

		// 4. 트랜잭션: soft delete + 세션 전체 폐기 + 보안 로그
		const deletedAt = now();
		await this.database.$transaction(async (tx) => {
			await this.userRepository.softDelete(userId, tx);
			await this.sessionRepository.revokeAllByUserId(
				userId,
				REVOKE_REASON.ACCOUNT_DELETION,
				undefined,
				tx,
			);
			await this.securityLogRepository.create(
				{
					userId,
					event: SECURITY_EVENT.ACCOUNT_DELETION_REQUESTED,
					ipAddress: ip,
					userAgent,
					metadata: {
						reason: input.reason ?? null,
						gracePeriodDays: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
						providers: accounts.map((a) => a.provider),
					},
				},
				tx,
			);
		});

		// 5. 캐시 무효화: 모든 기기의 세션 캐시 즉시 삭제
		await Promise.all(
			activeSessions.map((s) => this.cacheService.invalidateSession(s.id)),
		);
		await this.cacheService.invalidateUserProfile(userId);

		this.#logger.log(`Account deletion requested: ${userId}`);

		return {
			message: `계정이 탈퇴 처리되었습니다. ${ACCOUNT_DELETION.GRACE_PERIOD_DAYS}일 이내에 복구할 수 있습니다.`,
			deletedAt: toISOString(deletedAt),
			gracePeriodDays: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
		};
	}

	/**
	 * 탈퇴 유예 기간(30일) 내 여부를 판단합니다.
	 *
	 * - deletedAt이 null이면 false (복구 불필요)
	 * - 30일 이내면 true (복구 필요)
	 * - 30일 초과면 예외 발생 (cron이 아직 처리하지 못한 edge case)
	 */
	#isWithinGracePeriod(user: { deletedAt: Date | null; id: string }): boolean {
		if (!user.deletedAt) return false;

		const gracePeriodCutoff = subtractDays(ACCOUNT_DELETION.GRACE_PERIOD_DAYS);
		if (user.deletedAt > gracePeriodCutoff) {
			return true; // 30일 이내 — 복구 가능
		}

		// 30일 초과 — cron이 아직 hard delete 처리하지 못한 edge case
		throw BusinessExceptions.accountDeleted(user.id);
	}

	/**
	 * 탈퇴 계정 복구 처리 (트랜잭션 내부에서 호출)
	 *
	 * - 사용자 상태를 ACTIVE로 복원
	 * - 보안 로그에 ACCOUNT_RESTORED 이벤트 기록
	 */
	async #restoreDeletedAccount(
		user: { id: string; deletedAt: Date | null },
		metadata: { ip: string; userAgent: string },
		tx: TransactionClient,
	): Promise<void> {
		await this.userRepository.restore(user.id, tx);

		await this.securityLogRepository.create(
			{
				userId: user.id,
				event: SECURITY_EVENT.ACCOUNT_RESTORED,
				ipAddress: metadata.ip,
				userAgent: metadata.userAgent,
				metadata: {
					deletedAt: toISOStringOrNull(user.deletedAt ?? null),
					restoredAt: toISOString(now()),
				},
			},
			tx,
		);
	}

	#checkUserStatus(status: UserStatus, email: string): void {
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
