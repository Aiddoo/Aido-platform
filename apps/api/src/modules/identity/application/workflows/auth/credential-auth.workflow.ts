import {
  type DeleteAccountInput,
  LOGIN_ATTEMPT,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
  type VerifyEmailInput,
} from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { VerifiedRefreshPayload } from "#api/modules/identity/application/types/auth/auth.types";
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
} from "#api/modules/identity/application/types/auth/index";
import { assertNotDeleted } from "#api/modules/identity/application/utils/auth/auth-validation.utils";
import { AuthSession } from "#api/modules/identity/domain/aggregates/auth/auth-session.aggregate";
import {
  ACCOUNT_DELETION,
  AUTH_DEFAULTS,
  LOGIN_FAILURE_REASON,
  REVOKE_REASON,
  SECURITY_EVENT,
  TOKEN_REUSE_GRACE_PERIOD_MS,
} from "#api/modules/identity/domain/constants/auth/auth.constants";
import { assertRestorableWithinGracePeriod } from "#api/modules/identity/domain/services/auth/account-restoration-policy";
import { assertStatusAllowsLogin } from "#api/modules/identity/domain/services/auth/account-status-policy";
import type { UserStatus } from "#api/modules/identity/domain/types/auth/auth.types";
import { Email } from "#api/modules/identity/domain/value-objects/auth/email.vo";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { addMilliseconds, subtractMinutes } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";
import { toISOString, toISOStringOrNull } from "#api/shared/domain/date/utils/format";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { maskEmail } from "#api/shared/domain/utils/mask.util";

import {
  type AuthCachePort,
  type AuthRegistrationNotifierPort,
  type AuthUserRegisteredNotification,
} from "../../ports/auth/auth-collaboration.port.js";
import {
  type AuthPasswordHasherPort,
  type AuthTokenIssuerPort,
} from "../../ports/auth/auth-crypto.port.js";
import {
  type AuthAccountRepositoryPort,
  type AuthLoginAttemptRepositoryPort,
  AuthPersistenceConflict,
  type AuthSecurityLogRepositoryPort,
  type AuthSessionRepositoryPort,
  type AuthUserRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";
import { type RetentionEnrollerPort } from "../../ports/auth/retention-enroller.port.js";
import type { SessionService } from "../../services/auth/session.service.js";
import type { VerificationService } from "../../services/auth/verification.service.js";
import type { IssueLogin } from "../../use-cases/auth/issue-login.use-case.js";
import type { ProvisionUser } from "../../use-cases/auth/provision-user.use-case.js";

interface CredentialAuthWorkflowDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly userRepository: AuthUserRepositoryPort;
  readonly accountRepository: AuthAccountRepositoryPort;
  readonly sessionRepository: AuthSessionRepositoryPort;
  readonly loginAttemptRepository: AuthLoginAttemptRepositoryPort;
  readonly securityLogRepository: AuthSecurityLogRepositoryPort;
  readonly passwordService: AuthPasswordHasherPort;
  readonly sessionService: SessionService;
  readonly tokenService: AuthTokenIssuerPort;
  readonly verificationService: VerificationService;
  readonly cacheService: AuthCachePort;
  readonly adminEventNotifier: AuthRegistrationNotifierPort;
  readonly issueLoginUseCase: IssueLogin;
  readonly provisionUserUseCase: ProvisionUser;
  readonly retentionEnroller: RetentionEnrollerPort;
  readonly logger: ApplicationLogger;
}

export class CredentialAuthWorkflow {
  readonly #dependencies: CredentialAuthWorkflowDependencies;

  constructor(dependencies: CredentialAuthWorkflowDependencies) {
    this.#dependencies = dependencies;
  }

  async register(input: RegisterInput, metadata?: RequestMetadata): Promise<RegisterResult> {
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

    const { password, name, termsAgreed, privacyAgreed, marketingAgreed, marketingPushAgreed } =
      input;
    // 이메일 형식 불변식을 도메인 경계에서 방어(정규화 없음 → 값 그대로)
    const email = Email.of(input.email).value;

    // 이메일 중복 확인
    const existingUser = await this.#dependencies.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ApplicationException(ErrorCode.EMAIL_0501, { email });
    }

    // 비밀번호 해싱
    const hashedPassword = await this.#dependencies.passwordService.hash(password);

    // 트랜잭션으로 User + Account + UserConsent + Verification 생성
    let result: {
      user: { id: string; email: string };
      verificationCode: string;
    };
    try {
      result = await this.#dependencies.unitOfWork.run(async () => {
        // User + 크레덴셜 계정 + 프로필 + 동의 + 푸시설정 + 기본 카테고리 프로비저닝
        // (소셜 신규가입과 공유하는 수렴 시퀀스)
        const currentTime = now();
        const newUser = await this.#dependencies.provisionUserUseCase.execute({
          email,
          status: "PENDING_VERIFY",
          account: { kind: "credential", hashedPassword },
          profile: { name },
          consent: {
            termsAgreedAt: termsAgreed ? currentTime : undefined,
            privacyAgreedAt: privacyAgreed ? currentTime : undefined,
            marketingAgreedAt: marketingAgreed ? currentTime : undefined,
            marketingPushAgreedAt: marketingPushAgreed ? currentTime : undefined,
          },
        });

        // 이메일 인증 코드 생성 (Verification 레코드만 DB에 저장)
        const verificationResult =
          await this.#dependencies.verificationService.createEmailVerification(newUser.id);

        // 보안 로그 기록
        await this.#dependencies.securityLogRepository.create({
          userId: newUser.id,
          event: SECURITY_EVENT.REGISTRATION,
          ipAddress: ip,
          userAgent,
        });

        return {
          user: newUser,
          verificationCode: verificationResult.code,
        };
      });
    } catch (error) {
      // 사전 findByEmail 체크와 create 사이의 레이스로 이메일 유니크 위반이
      // 발생하면 EMAIL_0501로 정규화(그 외 유니크 위반은 원본 재전파).
      if (error instanceof AuthPersistenceConflict && error.kind === "EMAIL_ALREADY_EXISTS") {
        throw new ApplicationException(ErrorCode.EMAIL_0501, { email });
      }
      throw error;
    }

    // 트랜잭션 후 이메일 발송 (외부 서비스)
    // 이메일 발송 실패는 로그만 남고 회원가입은 성공 처리
    let emailSent = true;
    try {
      await this.#dependencies.verificationService.sendVerificationEmail(
        email,
        result.verificationCode,
      );
    } catch (error) {
      emailSent = false;
      this.#dependencies.logger.error(
        `Unexpected error sending verification email to ${maskEmail(email)}:`,
        error,
      );
    }

    this.#dependencies.logger.log(`User registered: ${result.user.id} (${maskEmail(email)})`);

    this.#dependencies.adminEventNotifier.notifyUserRegistered({
      userId: result.user.id,
      email: result.user.email,
      provider: "credential",
      registeredAt: toISOString(now()),
    } satisfies AuthUserRegisteredNotification);

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
    const user = await this.#dependencies.userRepository.findByEmail(email);
    if (!user) {
      throw new ApplicationException(ErrorCode.EMAIL_0502, { email });
    }

    // 탈퇴 사용자 체크
    assertNotDeleted(user);

    // 상태 확인
    if (user.status !== "PENDING_VERIFY") {
      if (user.emailVerifiedAt) {
        // 이미 인증된 사용자
        throw new ApplicationException(ErrorCode.USER_0604, {
          email,
          message: "이미 인증이 완료된 계정입니다.",
        });
      }
      // 다른 상태 (LOCKED, SUSPENDED 등)
      this.#checkUserStatus(user.status, email);
    }

    // 트랜잭션으로 인증 처리
    const result = await this.#dependencies.unitOfWork.run(async () => {
      // 인증 코드 검증
      await this.#dependencies.verificationService.verifyCode(user.id, code, "EMAIL_VERIFY");

      // 이메일 인증 완료 처리 (상태 ACTIVE로 변경)
      await this.#dependencies.userRepository.markEmailVerified(user.id);

      // assignment가 있는 신규 이메일 가입자만 시작한다. 기존 사용자는 no-op.
      await this.#dependencies.retentionEnroller.activateNewUser(user.id);

      // 세션 생성 + 토큰 발급
      const { tokens } = await this.#dependencies.sessionService.createSessionWithTokens({
        userId: user.id,
        email,
        role: user.role,
        deviceFingerprint: userAgent,
        userAgent,
        ipAddress: ip,
      });

      // 보안 로그 기록
      await this.#dependencies.securityLogRepository.create({
        userId: user.id,
        event: SECURITY_EVENT.EMAIL_VERIFIED,
        ipAddress: ip,
        userAgent,
      });

      // 프로필 조회
      const userWithProfile = await this.#dependencies.userRepository.findByIdWithProfile(user.id);

      return {
        tokens,
        name: userWithProfile?.profile?.name ?? null,
        profileImage: userWithProfile?.profile?.profileImage ?? null,
      };
    });

    this.#dependencies.logger.log(`Email verified: ${user.id} (${maskEmail(email)})`);

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
    const user = await this.#dependencies.userRepository.findByEmail(email);
    if (!user) {
      // 보안상 이메일 존재 여부를 노출하지 않음
      return {
        message: "인증 코드가 발송되었습니다. 이메일을 확인해주세요.",
      };
    }

    // PENDING_VERIFY 상태만 재발송 허용
    if (user.status !== "PENDING_VERIFY") {
      if (user.emailVerifiedAt) {
        throw new ApplicationException(ErrorCode.USER_0604, {
          email,
          message: "이미 인증이 완료된 계정입니다.",
        });
      }
      this.#checkUserStatus(user.status, email);
    }

    // 트랜잭션으로 인증 코드 생성 (쿨다운 체크 포함)
    const verificationResult = await this.#dependencies.unitOfWork.run(async () => {
      return await this.#dependencies.verificationService.createEmailVerification(user.id);
    });

    // 트랜잭션 후 이메일 발송
    try {
      await this.#dependencies.verificationService.sendVerificationEmail(
        email,
        verificationResult.code,
      );
    } catch (error) {
      this.#dependencies.logger.error(
        `Unexpected error sending verification email to ${maskEmail(email)}:`,
        error,
      );
    }

    this.#dependencies.logger.log(`Verification code resent: ${user.id} (${maskEmail(email)})`);

    return {
      message: "인증 코드가 발송되었습니다. 이메일을 확인해주세요.",
    };
  }

  // Rate limiting: 30분 내 5회 실패 시 잠금
  async login(input: LoginInput, metadata?: RequestMetadata): Promise<LoginResult> {
    const { password, deviceName } = input;
    // 이메일 형식 불변식을 도메인 경계에서 방어(정규화 없음 → 값 그대로)
    const email = Email.of(input.email).value;
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

    // 1. 로그인 시도 횟수 확인
    const lockoutSince = subtractMinutes(LOGIN_ATTEMPT.LOCKOUT_MINUTES);
    const recentFailures =
      await this.#dependencies.loginAttemptRepository.countRecentFailuresByEmail(
        email,
        lockoutSince,
      );

    if (recentFailures >= LOGIN_ATTEMPT.MAX_FAILURES) {
      // 보안 로그 기록
      await this.#dependencies.securityLogRepository.create({
        event: SECURITY_EVENT.ACCOUNT_LOCKED,
        ipAddress: ip,
        userAgent,
        metadata: { email, recentFailures },
      });

      throw new ApplicationException(ErrorCode.USER_0607, {
        email,
        remainingMinutes: undefined,
      });
    }

    // 2. 사용자 + 계정 조회
    const user = await this.#dependencies.userRepository.findByEmail(email);
    if (!user) {
      // 로그인 실패 기록 (사용자 없음)
      await this.#dependencies.loginAttemptRepository.create({
        email,
        provider: "CREDENTIAL",
        ipAddress: ip,
        userAgent,
        success: false,
        failureReason: LOGIN_FAILURE_REASON.USER_NOT_FOUND,
      });
      throw new ApplicationException(ErrorCode.USER_0602);
    }

    const account = await this.#dependencies.accountRepository.findByUserIdAndProvider(
      user.id,
      "CREDENTIAL",
    );
    if (!account?.password) {
      // Credential 계정이 아닌 경우 (소셜 로그인 등)
      await this.#dependencies.loginAttemptRepository.create({
        email,
        provider: "CREDENTIAL",
        ipAddress: ip,
        userAgent,
        success: false,
        failureReason: LOGIN_FAILURE_REASON.NO_CREDENTIAL_ACCOUNT,
      });
      throw new ApplicationException(ErrorCode.USER_0602);
    }

    // 3. 비밀번호 검증
    const isPasswordValid = await this.#dependencies.passwordService.verify(
      account.password,
      password,
    );
    if (!isPasswordValid) {
      await this.#dependencies.loginAttemptRepository.create({
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
        throw new ApplicationException(ErrorCode.USER_0607, {
          email,
          remainingMinutes: undefined,
        });
      }

      throw new ApplicationException(ErrorCode.USER_0602);
    }

    // 4. 비밀번호 해시 파라미터 업그레이드 (비동기, fire-and-forget)
    if (this.#dependencies.passwordService.needsRehash(account.password)) {
      this.#dependencies.passwordService
        .hash(password)
        .then((newHash) => this.#dependencies.accountRepository.updatePassword(user.id, newHash))
        .then(() => this.#dependencies.logger.debug(`Password rehashed for user: ${user.id}`))
        .catch((err) =>
          this.#dependencies.logger.error(`Password rehash failed for ${user.id}:`, err),
        );
    }

    // 5. 사용자 상태 확인 (탈퇴 유예 기간 내 복구 처리)
    const needsRestore = this.#isWithinGracePeriod(user);

    if (!needsRestore) {
      if (user.status === "PENDING_VERIFY") {
        throw new ApplicationException(ErrorCode.EMAIL_0503, { email });
      }
      this.#checkUserStatus(user.status, email);
    }

    // 5. 세션 생성 + JWT 토큰 발급 (트랜잭션, 이메일·소셜 공통 발급 시퀀스)
    const result = await this.#dependencies.unitOfWork.run(async () => {
      // 유예 기간 내 탈퇴 계정 복구
      if (needsRestore) {
        await this.#restoreDeletedAccount(user, { ip, userAgent });
      }

      return this.#dependencies.issueLoginUseCase.execute({
        userId: user.id,
        email,
        role: user.role,
        provider: "CREDENTIAL",
        ip,
        userAgent,
        deviceFingerprint: deviceName ?? userAgent,
      });
    });

    // 복구된 계정의 캐시 무효화
    if (needsRestore) {
      await this.#dependencies.cacheService.invalidateUserProfile(user.id);
      this.#dependencies.logger.log(
        `Deleted account restored on login: ${user.id} (${maskEmail(email)})`,
      );
    }

    this.#dependencies.logger.log(`User logged in: ${user.id} (${maskEmail(email)})`);

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
    const session = await this.#dependencies.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ApplicationException(ErrorCode.SESSION_0701, {
        sessionId: undefined,
      });
    }
    const authSession = AuthSession.reconstitute(session);
    if (!authSession.isOwnedBy(userId)) {
      throw new ApplicationException(ErrorCode.SESSION_0701, {
        sessionId: undefined,
      });
    }

    // 이미 만료된 세션
    if (authSession.isRevoked()) {
      throw new ApplicationException(ErrorCode.SESSION_0702, {
        sessionId: undefined,
      });
    }

    // 세션 만료 처리
    await this.#dependencies.sessionRepository.revoke(sessionId, REVOKE_REASON.USER_LOGOUT);

    // 캐시 무효화 (로그아웃 즉시 반영)
    await this.#dependencies.cacheService.invalidateSession(sessionId);

    // 보안 로그 기록
    await this.#dependencies.securityLogRepository.create({
      userId,
      event: SECURITY_EVENT.LOGOUT,
      ipAddress: ip,
      userAgent,
    });

    this.#dependencies.logger.log(`User logged out: ${userId}, session: ${sessionId}`);

    return { message: "로그아웃되었습니다." };
  }

  async logoutAll(
    userId: string,
    metadata?: RequestMetadata,
  ): Promise<{ message: string; revokedCount: number }> {
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

    // 활성 세션 ID 조회 (캐시 무효화용, revoke 전에 조회)
    const activeSessions = await this.#dependencies.sessionRepository.findActiveByUserId(userId);

    // 모든 세션 만료 처리
    const revokedCount = await this.#dependencies.sessionRepository.revokeAllByUserId(
      userId,
      REVOKE_REASON.USER_LOGOUT_ALL,
    );

    // 모든 세션 캐시 즉시 무효화
    await Promise.all(
      activeSessions.map((s) => this.#dependencies.cacheService.invalidateSession(s.id)),
    );

    // 보안 로그 기록
    await this.#dependencies.securityLogRepository.create({
      userId,
      event: SECURITY_EVENT.SESSION_REVOKED_ALL,
      ipAddress: ip,
      userAgent,
      metadata: { revokedCount },
    });

    this.#dependencies.logger.log(
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
      throw new ApplicationException(ErrorCode.SESSION_0701, {
        sessionId: undefined,
      });
    }

    // 2. 리프레시 토큰 해시로 세션 조회
    const refreshTokenHash = this.#dependencies.tokenService.hashRefreshToken(refreshToken);
    const session =
      await this.#dependencies.sessionRepository.findByRefreshTokenHash(refreshTokenHash);

    // 세션이 없으면 sessionId(PK)로 조회 — O(1) PK lookup
    if (!session) {
      // sessionId(PK)로 조회 — O(1) PK lookup
      const currentSession = await this.#dependencies.sessionRepository.findById(sessionId);
      const currentAuthSession = currentSession ? AuthSession.reconstitute(currentSession) : null;

      // previousTokenHash가 제출된 토큰 해시와 일치 → 이전 토큰 재사용
      if (currentSession && currentAuthSession?.wasPreviouslyIssued(refreshTokenHash)) {
        // Grace period 확인
        const currentTime = now();
        const timeSinceLastRotation = currentTime.getTime() - currentSession.lastUsedAt.getTime();

        if (
          currentAuthSession.isRetryWithin(
            refreshTokenHash,
            currentTime,
            TOKEN_REUSE_GRACE_PERIOD_MS,
          )
        ) {
          // 네트워크 재시도로 판단 → 새 토큰 발급
          this.#dependencies.logger.debug(
            `Token retry within grace period for session: ${currentSession.id} (${timeSinceLastRotation}ms)`,
          );

          this.#dependencies.sessionService.assertSessionValid(currentSession);

          if (currentSession.userId !== userId || currentSession.id !== sessionId) {
            throw new ApplicationException(ErrorCode.SESSION_0701, {
              sessionId: undefined,
            });
          }

          const newTokenVersion = currentAuthSession.tokenVersion + 1;
          const newTokens = await this.#dependencies.tokenService.generateTokenPair(
            userId,
            email,
            sessionId,
            role,
            currentSession.tokenFamily,
            newTokenVersion,
          );

          const newRefreshTokenHash = this.#dependencies.tokenService.hashRefreshToken(
            newTokens.refreshToken,
          );
          const refreshExpiresInSeconds =
            this.#dependencies.tokenService.getRefreshTokenExpiresInSeconds();
          const newExpiresAt = addMilliseconds(refreshExpiresInSeconds * 1000);

          // Sliding window 방지: previousTokenHash를 현재 세션의 refreshTokenHash로 설정
          // → 동일 옛 토큰으로의 재시도는 1회만 허용
          const rotationPlan = currentAuthSession.planRotation(
            newRefreshTokenHash,
            currentAuthSession.refreshTokenHash,
            newExpiresAt,
          );
          const rotatedSession = await this.#dependencies.sessionRepository.rotateToken(
            sessionId,
            rotationPlan,
          );

          if (!rotatedSession) {
            throw new ApplicationException(ErrorCode.SESSION_0702, {
              sessionId: undefined,
            });
          }

          // JwtStrategy의 세션 캐시(30초 TTL)에 남은 회전 전 스냅샷이
          // 갓 발급된 액세스 토큰을 401시키지 않도록 즉시 비운다
          await this.#dependencies.cacheService.invalidateSession(sessionId);

          await this.#dependencies.securityLogRepository.create({
            userId,
            event: SECURITY_EVENT.TOKEN_REFRESH,
            ipAddress: ip,
            userAgent,
            metadata: { retryWithinGracePeriod: true },
          });

          return { tokens: newTokens, sessionId };
        }

        // Grace period 초과 → 토큰 재사용 공격
        await this.#dependencies.sessionRepository.revokeByTokenFamily(
          currentSession.tokenFamily,
          REVOKE_REASON.TOKEN_REUSE_DETECTED,
        );

        await this.#dependencies.securityLogRepository.create({
          userId: currentSession.userId,
          event: SECURITY_EVENT.SUSPICIOUS_ACTIVITY,
          ipAddress: ip,
          userAgent,
          metadata: {
            reason: REVOKE_REASON.TOKEN_REUSE_DETECTED,
            tokenFamily: currentSession.tokenFamily,
          },
        });

        this.#dependencies.logger.warn(`Token reuse detected for user: ${currentSession.userId}`);
        throw new ApplicationException(ErrorCode.SESSION_0704, {
          tokenFamily: undefined,
        });
      }

      throw new ApplicationException(ErrorCode.SESSION_0701, {
        sessionId: undefined,
      });
    }

    // 3. 세션 유효성 확인
    this.#dependencies.sessionService.assertSessionValid(session);

    if (session.userId !== userId || session.id !== sessionId) {
      throw new ApplicationException(ErrorCode.SESSION_0701, {
        sessionId: undefined,
      });
    }

    // 4. 새 토큰 쌍 발급
    const authSession = AuthSession.reconstitute(session);
    const newTokenVersion = authSession.tokenVersion + 1;
    const newTokens = await this.#dependencies.tokenService.generateTokenPair(
      userId,
      email,
      sessionId,
      role,
      session.tokenFamily,
      newTokenVersion,
    );

    // 5. 세션 업데이트 (Token Rotation with Optimistic Locking)
    const newRefreshTokenHash = this.#dependencies.tokenService.hashRefreshToken(
      newTokens.refreshToken,
    );

    const refreshExpiresInSeconds =
      this.#dependencies.tokenService.getRefreshTokenExpiresInSeconds();
    const newExpiresAt = addMilliseconds(refreshExpiresInSeconds * 1000);

    const rotationPlan = authSession.planRotation(
      newRefreshTokenHash,
      refreshTokenHash,
      newExpiresAt,
    );
    const rotatedSession = await this.#dependencies.sessionRepository.rotateToken(
      sessionId,
      rotationPlan,
    );

    // 로테이션 실패 시 (다른 요청이 먼저 로테이션함)
    if (!rotatedSession) {
      this.#dependencies.logger.warn(
        `Token rotation race condition detected for session: ${sessionId}`,
      );
      throw new ApplicationException(ErrorCode.SESSION_0702, {
        sessionId: undefined,
      });
    }

    // JwtStrategy의 세션 캐시(30초 TTL)에 남은 회전 전 스냅샷이
    // 갓 발급된 액세스 토큰을 401시키지 않도록 즉시 비운다
    await this.#dependencies.cacheService.invalidateSession(sessionId);

    // 보안 로그 기록
    await this.#dependencies.securityLogRepository.create({
      userId,
      event: SECURITY_EVENT.TOKEN_REFRESH,
      ipAddress: ip,
      userAgent,
    });

    this.#dependencies.logger.debug(`Token refreshed for user: ${userId}, session: ${sessionId}`);

    return {
      tokens: newTokens,
      sessionId,
    };
  }

  async getActiveSessions(userId: string): Promise<SessionInfo[]> {
    const sessions = await this.#dependencies.sessionRepository.findActiveByUserId(userId);

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
    const session = await this.#dependencies.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ApplicationException(ErrorCode.SESSION_0701, {
        sessionId: undefined,
      });
    }
    const authSession = AuthSession.reconstitute(session);
    if (!authSession.isOwnedBy(userId)) {
      throw new ApplicationException(ErrorCode.SESSION_0701, {
        sessionId: undefined,
      });
    }

    // 세션 폐기
    await this.#dependencies.sessionRepository.revoke(sessionId, REVOKE_REASON.USER_REVOKE);

    // 캐시 무효화 (즉시 반영)
    await this.#dependencies.cacheService.invalidateSession(sessionId);

    // 보안 로그 기록
    await this.#dependencies.securityLogRepository.create({
      userId,
      event: SECURITY_EVENT.SESSION_REVOKED,
      ipAddress: ip,
      userAgent,
      metadata: { revokedSessionId: sessionId },
    });

    this.#dependencies.logger.debug(`Session revoked: ${sessionId} for user: ${userId}`);

    return { message: "세션이 종료되었습니다." };
  }

  async getCurrentUser(
    userId: string,
    _email: string,
    sessionId: string,
  ): Promise<CurrentUserResult> {
    // wrapUserProfile을 사용하여 캐시된 프로필 조회 또는 DB에서 조회
    const cachedProfile = await this.#dependencies.cacheService.wrapUserProfile(
      userId,
      async () => {
        const user = await this.#dependencies.userRepository.findByIdWithProfile(userId);
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
      throw new ApplicationException(ErrorCode.USER_0601, { userId });
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

  async updateProfile(userId: string, data: UpdateProfileInput): Promise<UpdateProfileResult> {
    const profile = await this.#dependencies.userRepository.updateProfile(userId, data);

    // 캐시 무효화 (프로필 변경)
    await this.#dependencies.cacheService.invalidateUserProfile(userId);

    this.#dependencies.logger.log(`Profile updated for user: ${userId}`);

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
    const user = await this.#dependencies.userRepository.findById(userId);
    if (!user) throw new ApplicationException(ErrorCode.USER_0601, { userId });
    assertNotDeleted(user);

    // 2. 계정 유형에 따른 본인 확인
    const accounts = await this.#dependencies.accountRepository.findAllByUserId(userId);
    const credentialAccount = accounts.find((a) => a.provider === "CREDENTIAL");

    if (credentialAccount) {
      if (!input.password) {
        throw new ApplicationException(ErrorCode.USER_0612);
      }
      const credentialPassword = credentialAccount.password;
      if (!credentialPassword) {
        throw new ApplicationException(ErrorCode.USER_0602);
      }
      const isValid = await this.#dependencies.passwordService.verify(
        credentialPassword,
        input.password,
      );
      if (!isValid) throw new ApplicationException(ErrorCode.USER_0602);
    }
    // 소셜 전용: JWT 인증 통과 = 확인 완료

    // 3. 활성 세션 ID 조회 (캐시 무효화용, 트랜잭션 전에 조회)
    const activeSessions = await this.#dependencies.sessionRepository.findActiveByUserId(userId);

    // 4. 트랜잭션: soft delete + 세션 전체 폐기 + 보안 로그
    const deletedAt = now();
    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.userRepository.softDelete(userId);
      await this.#dependencies.sessionRepository.revokeAllByUserId(
        userId,
        REVOKE_REASON.ACCOUNT_DELETION,
        undefined,
      );
      await this.#dependencies.securityLogRepository.create({
        userId,
        event: SECURITY_EVENT.ACCOUNT_DELETION_REQUESTED,
        ipAddress: ip,
        userAgent,
        metadata: {
          reason: input.reason ?? null,
          gracePeriodDays: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
          providers: accounts.map((a) => a.provider),
        },
      });
    });

    // 5. 캐시 무효화: 모든 기기의 세션 캐시 즉시 삭제
    await Promise.all(
      activeSessions.map((s) => this.#dependencies.cacheService.invalidateSession(s.id)),
    );
    await this.#dependencies.cacheService.invalidateUserProfile(userId);

    this.#dependencies.logger.log(`Account deletion requested: ${userId}`);

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
    return assertRestorableWithinGracePeriod(user.deletedAt, user.id);
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
  ): Promise<void> {
    await this.#dependencies.userRepository.restore(user.id);

    await this.#dependencies.securityLogRepository.create({
      userId: user.id,
      event: SECURITY_EVENT.ACCOUNT_RESTORED,
      ipAddress: metadata.ip,
      userAgent: metadata.userAgent,
      metadata: {
        deletedAt: toISOStringOrNull(user.deletedAt ?? null),
        restoredAt: toISOString(now()),
      },
    });
  }

  #checkUserStatus(status: UserStatus, email: string): void {
    assertStatusAllowsLogin(status, email);
  }
}
