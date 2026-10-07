import { ErrorCode } from "@aido/api/errors";
import { LOGIN_ATTEMPT } from "@aido/api/vocabulary";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import {
  REVOKE_REASON,
  SECURITY_EVENT,
} from "#api/modules/identity/domain/constants/auth/auth.constants";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { AccountBuilder, SessionBuilder, UserBuilder } from "#test/builders/index";
import { asDep, asMock, mockOf } from "#test/mocks/index";

import type { AuthCachedUserProfile } from "../../ports/auth/auth-collaboration.port.js";
import {
  type AuthCachePort,
  type AuthRegistrationNotifierPort,
} from "../../ports/auth/auth-collaboration.port.js";
import { type AuthPasswordHasherPort } from "../../ports/auth/auth-crypto.port.js";
import {
  type AuthAccountRepositoryPort,
  type AuthLoginAttemptRepositoryPort,
  AuthPersistenceConflict,
  type AuthSecurityLogRepositoryPort,
  type AuthSessionRepositoryPort,
  type AuthUserRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";
import { type RetentionEnrollerPort } from "../../ports/auth/retention-enroller.port.js";
import type { UserProvisioningSeederPort } from "../../ports/auth/user-provisioning-seeder.port.js";
import { SessionService } from "../../services/auth/session.service.js";
import { VerificationService } from "../../services/auth/verification.service.js";
import { IssueLogin } from "../../use-cases/auth/issue-login.use-case.js";
import { ProvisionUser } from "../../use-cases/auth/provision-user.use-case.js";
import { CredentialAuthWorkflow } from "./credential-auth.workflow.js";

describe("CredentialAuthWorkflow — 인증 workflow", () => {
  let service: CredentialAuthWorkflow;
  let userRepo: Mocked<AuthUserRepositoryPort>;
  let accountRepo: Mocked<AuthAccountRepositoryPort>;
  let sessionRepo: Mocked<AuthSessionRepositoryPort>;
  let passwordService: Mocked<AuthPasswordHasherPort>;
  let verificationService: Mocked<VerificationService>;
  let cacheService: Mocked<AuthCachePort>;
  let uow: Mocked<UnitOfWorkPort>;
  let securityLogRepo: Mocked<AuthSecurityLogRepositoryPort>;
  let loginAttemptRepo: Mocked<AuthLoginAttemptRepositoryPort>;
  let sessionService: Mocked<SessionService>;
  let adminEventNotifier: Mocked<AuthRegistrationNotifierPort>;
  let retentionEnroller: Mocked<RetentionEnrollerPort>;

  // 재사용 가능한 테스트 데이터
  const mockTokens = {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresIn: 900,
  };

  beforeEach(async () => {
    const credentialAuthWorkflowDependencies = mockDeep<
      ConstructorParameters<typeof CredentialAuthWorkflow>[0]
    >({});
    const unit = new CredentialAuthWorkflow(credentialAuthWorkflowDependencies);

    service = unit;
    userRepo = credentialAuthWorkflowDependencies.userRepository;
    accountRepo = credentialAuthWorkflowDependencies.accountRepository;
    sessionRepo = credentialAuthWorkflowDependencies.sessionRepository;
    passwordService = credentialAuthWorkflowDependencies.passwordService;
    verificationService = credentialAuthWorkflowDependencies.verificationService;
    cacheService = credentialAuthWorkflowDependencies.cacheService;
    uow = credentialAuthWorkflowDependencies.unitOfWork;
    securityLogRepo = credentialAuthWorkflowDependencies.securityLogRepository;
    loginAttemptRepo = credentialAuthWorkflowDependencies.loginAttemptRepository;
    sessionService = credentialAuthWorkflowDependencies.sessionService;
    adminEventNotifier = credentialAuthWorkflowDependencies.adminEventNotifier;
    retentionEnroller = credentialAuthWorkflowDependencies.retentionEnroller;

    // IssueLogin(발급 수렴)를 실제 인스턴스로 위임 — 기존 login 테스트가
    // 세션·로그인시도·보안로그·프로필 조회 호출을 그대로 검증하도록 mock 콜라보레이터에 배선
    const issueLogin = credentialAuthWorkflowDependencies.issueLoginUseCase;
    const realIssueLogin = new IssueLogin({
      sessionService: asDep<SessionService>(sessionService),
      loginAttemptRepository: asDep(loginAttemptRepo),
      securityLogRepository: asDep(securityLogRepo),
      userRepository: asDep(userRepo),
    });
    issueLogin.execute.mockImplementation((input) => realIssueLogin.execute(input));

    // ProvisionUser(프로비저닝 수렴)도 실제 인스턴스로 위임 — register 테스트가
    // 유저·계정·프로필 생성과 기본값 시딩 호출을 그대로 검증하도록 배선.
    // 기본값 시딩은 workflow 직접 의존이 아니므로 시더 포트를 독립 mock으로 구성한다.
    const provisionUser = credentialAuthWorkflowDependencies.provisionUserUseCase;
    const seederStub = mockOf<UserProvisioningSeederPort>({
      seedDefaultSettings: vi.fn(),
      seedDefaultCategories: vi.fn(),
    });
    const retentionStub = mockOf<RetentionEnrollerPort>({
      enrollNewUser: vi.fn(),
      activateNewUser: vi.fn(),
    });
    const realProvisionUser = new ProvisionUser({
      userRepository: asDep(userRepo),
      accountRepository: asDep(accountRepo),
      seeder: seederStub,
      retentionEnroller: retentionStub,
    });
    provisionUser.execute.mockImplementation((input) => realProvisionUser.execute(input));
  });

  describe("register", () => {
    const registerInput = {
      email: "test@example.com",
      password: "Password123@",
      passwordConfirm: "Password123@",
      termsAgreed: true,
      privacyAgreed: true,
      marketingAgreed: false,
    } as const;

    /**
     * 회원가입 성공 시나리오 mock 설정 헬퍼
     */
    const setupSuccessfulRegistration = (
      mockUser: ReturnType<typeof UserBuilder.prototype.build>,
    ) => {
      userRepo.findByEmail.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue("hashed-password");
      uow.run.mockImplementation((work) => work());
      userRepo.create.mockResolvedValue(mockUser);
      userRepo.createProfile.mockResolvedValue(undefined);
      asMock(accountRepo.createCredentialAccount).mockResolvedValue({
        ...AccountBuilder.create("user-123").build(),
      });
      verificationService.createEmailVerification.mockResolvedValue({
        code: "123456",
        expiresAt: new Date(),
      });
      verificationService.sendVerificationEmail.mockResolvedValue(undefined);
      asMock(securityLogRepo.create).mockResolvedValue({});
    };

    it("새 사용자를 등록하고 인증 코드를 발송한다", async () => {
      // Given - Builder로 테스트 데이터 생성
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(registerInput.email)
        .withStatus("PENDING_VERIFY")
        .build();

      setupSuccessfulRegistration(mockUser);

      // When
      const result = await service.register(registerInput);

      // Then - 행동 기반 assertion
      expect(result.userId).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.message).toContain("회원가입이 완료되었습니다");
    });

    it("이미 존재하는 이메일이면 에러를 던진다", async () => {
      // Given
      const existingUser = UserBuilder.create().withEmail(registerInput.email).verified().build();
      userRepo.findByEmail.mockResolvedValue(existingUser);

      // When & Then
      await expect(service.register(registerInput)).rejects.toThrow(ApplicationException);
    });

    it("비밀번호를 해시하여 저장한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(registerInput.email)
        .build();

      setupSuccessfulRegistration(mockUser);

      // When
      await service.register(registerInput);

      // Then
      expect(passwordService.hash).toHaveBeenCalledWith(registerInput.password);
      expect(accountRepo.createCredentialAccount).toHaveBeenCalled();
    });

    it("credential 계정을 생성한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(registerInput.email)
        .build();

      setupSuccessfulRegistration(mockUser);

      // When
      await service.register(registerInput);

      // Then
      expect(accountRepo.createCredentialAccount).toHaveBeenCalledWith(
        mockUser.id,
        "hashed-password",
      );
    });

    it("이메일 인증 코드를 발송한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(registerInput.email)
        .build();

      setupSuccessfulRegistration(mockUser);

      // When
      await service.register(registerInput);

      // Then
      expect(verificationService.createEmailVerification).toHaveBeenCalled();
      expect(verificationService.sendVerificationEmail).toHaveBeenCalledWith(
        registerInput.email,
        expect.any(String),
      );
    });

    it("보안 로그를 기록한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(registerInput.email)
        .build();

      setupSuccessfulRegistration(mockUser);

      // When
      await service.register(registerInput);

      // Then
      expect(securityLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          event: SECURITY_EVENT.REGISTRATION,
        }),
      );
    });

    it("SQLSTATE 23505 unique constraint(이메일 중복) 시 emailAlreadyRegistered를 던져야 한다", async () => {
      // Given - 트랜잭션에서 SQLSTATE 23505 발생 (동시 가입 race condition)
      uow.run.mockRejectedValue(new AuthPersistenceConflict("EMAIL_ALREADY_EXISTS"));

      // When & Then
      await expect(service.register(registerInput)).rejects.toThrow(
        new ApplicationException(ErrorCode.EMAIL_0501, {
          email: registerInput.email,
        }),
      );
    });

    it("SQLSTATE 23505 unique constraint(이메일 외) 시 원본 에러를 re-throw해야 한다", async () => {
      // Given - userTag 충돌 등 email이 아닌 SQLSTATE 23505
      const prismaError = new Error("unrelated persistence failure");
      uow.run.mockRejectedValue(prismaError);

      // When & Then - emailAlreadyRegistered가 아닌 원본 에러가 던져져야 함
      await expect(service.register(registerInput)).rejects.toThrow(prismaError);
    });

    it("이메일 전송 실패해도 회원가입은 성공한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(registerInput.email)
        .build();

      setupSuccessfulRegistration(mockUser);
      verificationService.sendVerificationEmail.mockRejectedValue(
        new Error("SMTP connection failed"),
      );

      // When
      const result = await service.register(registerInput);

      // Then - 회원가입은 성공
      expect(result.userId).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it("회원가입 성공 시 관리자 알림 및 온보딩 큐 잡을 등록한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(registerInput.email)
        .build();

      setupSuccessfulRegistration(mockUser);

      // When
      await service.register(registerInput);

      // Then
      expect(adminEventNotifier.notifyUserRegistered).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          email: registerInput.email,
          provider: "credential",
        }),
      );
      // 기본 카테고리는 register() 트랜잭션 내에서 동기 생성됨 (큐 아님)
    });
  });

  describe("verifyEmail", () => {
    const verifyInput = {
      email: "test@example.com",
      code: "123456",
    };

    /**
     * 이메일 인증 성공 시나리오 mock 설정 헬퍼
     */
    const setupSuccessfulVerification = (
      mockUser: ReturnType<typeof UserBuilder.prototype.build>,
    ) => {
      userRepo.findByEmail.mockResolvedValue(mockUser);
      uow.run.mockImplementation((work) => work());
      asMock(verificationService.verifyCode).mockResolvedValue(true);
      asMock(userRepo.markEmailVerified).mockResolvedValue({});
      sessionService.createSessionWithTokens.mockResolvedValue({
        sessionId: "session-id",
        tokens: mockTokens,
        tokenFamily: "family-id",
      });
      asMock(securityLogRepo.create).mockResolvedValue({});
      asMock(userRepo.findByIdWithProfile).mockResolvedValue({
        ...mockUser,
        profile: { name: "Test User", profileImage: null },
      });
    };

    it("올바른 코드로 이메일 인증에 성공한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(verifyInput.email)
        .withStatus("PENDING_VERIFY")
        .build();

      setupSuccessfulVerification(mockUser);

      // When
      const result = await service.verifyEmail(verifyInput);

      // Then
      expect(result.userId).toBe(mockUser.id);
      expect(result.tokens).toEqual(mockTokens);
      expect(retentionEnroller.activateNewUser).toHaveBeenCalledWith(mockUser.id);
    });

    it("존재하지 않는 이메일이면 에러를 던진다", async () => {
      // Given
      userRepo.findByEmail.mockResolvedValue(null);

      // When & Then
      await expect(service.verifyEmail(verifyInput)).rejects.toThrow(ApplicationException);
    });

    it("이미 인증된 사용자면 에러를 던진다", async () => {
      // Given
      const verifiedUser = UserBuilder.create().withEmail(verifyInput.email).verified().build();
      userRepo.findByEmail.mockResolvedValue(verifiedUser);

      // When & Then
      await expect(service.verifyEmail(verifyInput)).rejects.toThrow(ApplicationException);
    });

    it("인증 성공 시 토큰을 발급한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(verifyInput.email)
        .withStatus("PENDING_VERIFY")
        .build();

      setupSuccessfulVerification(mockUser);

      // When
      const result = await service.verifyEmail(verifyInput);

      // Then
      expect(sessionService.createSessionWithTokens).toHaveBeenCalled();
      expect(result.tokens.accessToken).toBe(mockTokens.accessToken);
    });

    it("세션을 생성한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(verifyInput.email)
        .withStatus("PENDING_VERIFY")
        .build();

      setupSuccessfulVerification(mockUser);

      // When
      await service.verifyEmail(verifyInput);

      // Then
      expect(sessionService.createSessionWithTokens).toHaveBeenCalled();
    });

    it("보안 이벤트를 기록한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(verifyInput.email)
        .withStatus("PENDING_VERIFY")
        .build();

      setupSuccessfulVerification(mockUser);

      // When
      await service.verifyEmail(verifyInput);

      // Then
      expect(securityLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          event: SECURITY_EVENT.EMAIL_VERIFIED,
        }),
      );
    });

    it("탈퇴한 사용자가 이메일 인증 시도 시 USER_0606 에러", async () => {
      // Given
      const deletedUser = UserBuilder.create()
        .withEmail(verifyInput.email)
        .verified()
        .deleted()
        .build();
      userRepo.findByEmail.mockResolvedValue(deletedUser);

      // When & Then
      await expect(service.verifyEmail(verifyInput)).rejects.toThrow(ApplicationException);
      expect(verificationService.verifyCode).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    const loginInput = {
      email: "test@example.com",
      password: "Password123@",
    };

    /**
     * 로그인 성공 시나리오 mock 설정 헬퍼
     */
    const setupSuccessfulLogin = (mockUser: ReturnType<typeof UserBuilder.prototype.build>) => {
      loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);
      userRepo.findByEmail.mockResolvedValue(mockUser);
      asMock(accountRepo.findByUserIdAndProvider).mockResolvedValue({
        ...AccountBuilder.create(mockUser.id).build(),
        id: 123,
        userId: mockUser.id,
        provider: "CREDENTIAL",
        password: "hashed-password",
      });
      passwordService.verify.mockResolvedValue(true);
      uow.run.mockImplementation((work) => work());
      sessionService.createSessionWithTokens.mockResolvedValue({
        sessionId: "session-id",
        tokens: mockTokens,
        tokenFamily: "family-id",
      });
      asMock(loginAttemptRepo.create).mockResolvedValue({});
      asMock(securityLogRepo.create).mockResolvedValue({});
      asMock(userRepo.findByIdWithProfile).mockResolvedValue({
        ...mockUser,
        profile: { name: "Test User", profileImage: null },
      });
    };

    it("올바른 자격 증명으로 토큰을 반환한다", async () => {
      // Given - Builder로 인증 완료된 사용자 생성
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(loginInput.email)
        .verified()
        .build();

      setupSuccessfulLogin(mockUser);

      // When
      const result = await service.login(loginInput);

      // Then
      expect(result.userId).toBe(mockUser.id);
      expect(result.tokens).toEqual(mockTokens);
      expect(result.sessionId).toBe("session-id");
      expect(result.accountRestored).toBe(false);
    });

    it("존재하지 않는 이메일이면 에러를 던진다", async () => {
      // Given
      loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);
      userRepo.findByEmail.mockResolvedValue(null);
      asMock(loginAttemptRepo.create).mockResolvedValue({});

      // When & Then
      await expect(service.login(loginInput)).rejects.toThrow(ApplicationException);
      expect(loginAttemptRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it("잘못된 비밀번호면 에러를 던진다", async () => {
      // Given
      const mockUser = UserBuilder.create().withEmail(loginInput.email).verified().build();

      loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);
      userRepo.findByEmail.mockResolvedValue(mockUser);
      asMock(accountRepo.findByUserIdAndProvider).mockResolvedValue({
        ...AccountBuilder.create(mockUser.id).build(),
        id: 123,
        userId: mockUser.id,
        password: "hashed-password",
      });
      passwordService.verify.mockResolvedValue(false);
      asMock(loginAttemptRepo.create).mockResolvedValue({});

      // When & Then
      await expect(service.login(loginInput)).rejects.toThrow(ApplicationException);
      expect(loginAttemptRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it("이메일 미인증 사용자면 에러를 던진다", async () => {
      // Given - Builder로 미인증 사용자 간단하게 생성
      const pendingUser = UserBuilder.create()
        .withEmail(loginInput.email)
        .withStatus("PENDING_VERIFY")
        .build();

      loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);
      userRepo.findByEmail.mockResolvedValue(pendingUser);
      asMock(accountRepo.findByUserIdAndProvider).mockResolvedValue({
        ...AccountBuilder.create(pendingUser.id).build(),
        id: 123,
        userId: pendingUser.id,
        password: "hashed-password",
      });
      passwordService.verify.mockResolvedValue(true);

      // When & Then
      await expect(service.login(loginInput)).rejects.toThrow(ApplicationException);
    });

    it("세션을 생성하고 보안 이벤트를 기록한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(loginInput.email)
        .verified()
        .build();

      setupSuccessfulLogin(mockUser);

      // When
      await service.login(loginInput);

      // Then
      expect(sessionService.createSessionWithTokens).toHaveBeenCalled();
      expect(securityLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          event: SECURITY_EVENT.LOGIN_SUCCESS,
        }),
      );
    });

    it("로그인 시도를 기록한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(loginInput.email)
        .verified()
        .build();

      setupSuccessfulLogin(mockUser);

      // When
      await service.login(loginInput);

      // Then
      expect(loginAttemptRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: loginInput.email,
          provider: "CREDENTIAL",
          success: true,
        }),
      );
    });

    it("로그인 시도 횟수 초과 시 에러를 던지고 ACCOUNT_LOCKED 보안 로그를 기록한다", async () => {
      // Given
      loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(LOGIN_ATTEMPT.MAX_FAILURES);

      // When & Then
      await expect(service.login(loginInput)).rejects.toThrow(ApplicationException);
      expect(securityLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event: SECURITY_EVENT.ACCOUNT_LOCKED,
          metadata: expect.objectContaining({
            email: loginInput.email,
            recentFailures: LOGIN_ATTEMPT.MAX_FAILURES,
          }),
        }),
      );
    });

    it("계정이 잠긴 상태면 에러를 던진다", async () => {
      // Given - Builder로 잠긴 계정 생성
      const lockedUser = UserBuilder.create().withEmail(loginInput.email).locked().build();

      loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);
      userRepo.findByEmail.mockResolvedValue(lockedUser);
      asMock(accountRepo.findByUserIdAndProvider).mockResolvedValue({
        ...AccountBuilder.create(lockedUser.id).build(),
        id: 123,
        userId: lockedUser.id,
        password: "hashed-password",
      });
      passwordService.verify.mockResolvedValue(true);

      // When & Then - 계정 상태 게이트는 도메인 불변식(account-status-policy)이 소유
      await expect(service.login(loginInput)).rejects.toThrow(DomainException);
    });
  });

  describe("deleteAccount", () => {
    const userId = "user-123";
    const sessionId = "session-123";
    const metadata = { ip: "127.0.0.1", userAgent: "test-agent" };

    it("CREDENTIAL 계정: 비밀번호 확인 후 soft delete 처리", async () => {
      // Given
      const user = UserBuilder.create().withId(userId).verified().build();
      userRepo.findById.mockResolvedValue(user);
      asMock(accountRepo.findAllByUserId).mockResolvedValue([
        {
          ...AccountBuilder.create("user-123").build(),
          id: 1,
          userId,
          provider: "CREDENTIAL",
          password: "hashed-pw",
        },
      ]);
      passwordService.verify.mockResolvedValue(true);
      sessionRepo.findActiveByUserId.mockResolvedValue([
        SessionBuilder.create(userId).withId(sessionId).build(),
      ]);
      uow.run.mockImplementation((work) => work());
      asMock(userRepo.softDelete).mockResolvedValue({});
      sessionRepo.revokeAllByUserId.mockResolvedValue(1);
      asMock(securityLogRepo.create).mockResolvedValue({});

      // When
      const result = await service.deleteAccount(
        userId,
        sessionId,
        { password: "CurrentPw123" },
        metadata,
      );

      // Then
      expect(result.message).toContain("탈퇴 처리되었습니다");
      expect(result.gracePeriodDays).toBe(30);
      expect(userRepo.softDelete).toHaveBeenCalledWith(userId);
      expect(sessionRepo.revokeAllByUserId).toHaveBeenCalledWith(
        userId,
        REVOKE_REASON.ACCOUNT_DELETION,
        undefined,
      );
    });

    it("CREDENTIAL 계정: 비밀번호 미입력 시 USER_0612 에러", async () => {
      // Given
      const user = UserBuilder.create().withId(userId).verified().build();
      userRepo.findById.mockResolvedValue(user);
      asMock(accountRepo.findAllByUserId).mockResolvedValue([
        {
          ...AccountBuilder.create("user-123").build(),
          id: 1,
          userId,
          provider: "CREDENTIAL",
          password: "hashed-pw",
        },
      ]);

      // When & Then
      await expect(service.deleteAccount(userId, sessionId, {}, metadata)).rejects.toThrow(
        ApplicationException,
      );
    });

    it("CREDENTIAL 계정: 비밀번호 불일치 시 USER_0602 에러", async () => {
      // Given
      const user = UserBuilder.create().withId(userId).verified().build();
      userRepo.findById.mockResolvedValue(user);
      asMock(accountRepo.findAllByUserId).mockResolvedValue([
        {
          ...AccountBuilder.create("user-123").build(),
          id: 1,
          userId,
          provider: "CREDENTIAL",
          password: "hashed-pw",
        },
      ]);
      passwordService.verify.mockResolvedValue(false);

      // When & Then
      await expect(
        service.deleteAccount(userId, sessionId, { password: "WrongPassword123" }, metadata),
      ).rejects.toThrow(ApplicationException);
    });

    it("소셜 전용 계정: 세션 기반 확인으로 soft delete 처리", async () => {
      // Given
      const user = UserBuilder.create().withId(userId).verified().build();
      userRepo.findById.mockResolvedValue(user);
      asMock(accountRepo.findAllByUserId).mockResolvedValue([
        {
          ...AccountBuilder.create("user-123").build(),
          id: 1,
          userId,
          provider: "GOOGLE",
          password: null,
        },
      ]);
      sessionRepo.findActiveByUserId.mockResolvedValue([
        SessionBuilder.create(userId).withId(sessionId).build(),
      ]);
      uow.run.mockImplementation((work) => work());
      asMock(userRepo.softDelete).mockResolvedValue({});
      sessionRepo.revokeAllByUserId.mockResolvedValue(1);
      asMock(securityLogRepo.create).mockResolvedValue({});

      // When
      const result = await service.deleteAccount(userId, sessionId, {}, metadata);

      // Then
      expect(result.message).toContain("탈퇴 처리되었습니다");
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it("이미 탈퇴한 계정 시도 시 USER_0606 에러", async () => {
      // Given
      const user = UserBuilder.create().withId(userId).verified().deleted().build();
      userRepo.findById.mockResolvedValue(user);

      // When & Then
      await expect(service.deleteAccount(userId, sessionId, {}, metadata)).rejects.toThrow(
        ApplicationException,
      );
    });

    it("존재하지 않는 사용자 시 USER_0601 에러", async () => {
      // Given
      userRepo.findById.mockResolvedValue(null);

      // When & Then
      await expect(service.deleteAccount(userId, sessionId, {}, metadata)).rejects.toThrow(
        ApplicationException,
      );
    });

    it("트랜잭션 내 softDelete + revokeAllByUserId + securityLog 호출 확인", async () => {
      // Given
      const user = UserBuilder.create().withId(userId).verified().build();
      userRepo.findById.mockResolvedValue(user);
      asMock(accountRepo.findAllByUserId).mockResolvedValue([
        {
          ...AccountBuilder.create("user-123").build(),
          id: 1,
          userId,
          provider: "GOOGLE",
          password: null,
        },
      ]);
      sessionRepo.findActiveByUserId.mockResolvedValue([
        SessionBuilder.create(userId).withId(sessionId).build(),
      ]);
      uow.run.mockImplementation((work) => work());
      asMock(userRepo.softDelete).mockResolvedValue({});
      sessionRepo.revokeAllByUserId.mockResolvedValue(1);
      asMock(securityLogRepo.create).mockResolvedValue({});

      // When
      await service.deleteAccount(userId, sessionId, {}, metadata);

      // Then
      expect(uow.run).toHaveBeenCalled();
      expect(securityLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          event: SECURITY_EVENT.ACCOUNT_DELETION_REQUESTED,
        }),
      );
    });
  });

  describe("login - 탈퇴 사용자", () => {
    it("유예 기간 초과 시 USER_0606 에러", async () => {
      // Given - 31일 전에 탈퇴한 사용자
      const deletedUser = UserBuilder.create()
        .withEmail("deleted@example.com")
        .verified()
        .deleted(new Date(Date.now() - 31 * 24 * 60 * 60 * 1000))
        .build();
      userRepo.findByEmail.mockResolvedValue(deletedUser);
      asMock(accountRepo.findByUserIdAndProvider).mockResolvedValue({
        ...AccountBuilder.create(deletedUser.id).build(),
        id: 1,
        userId: deletedUser.id,
        provider: "CREDENTIAL",
        password: "hashed-pw",
      });
      passwordService.verify.mockResolvedValue(true);
      loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);

      // When & Then - 탈퇴 계정 복구 불변식(account-restoration-policy)이 소유
      await expect(
        service.login({
          email: "deleted@example.com",
          password: "Password123",
        }),
      ).rejects.toThrow(DomainException);
    });

    it("유예 기간 내 탈퇴 사용자 로그인 시 자동 복구", async () => {
      // Given - 29일 전에 탈퇴한 사용자
      const deletedAt = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
      const deletedUser = UserBuilder.create()
        .withEmail("deleted@example.com")
        .verified()
        .deleted(deletedAt)
        .build();
      userRepo.findByEmail.mockResolvedValue(deletedUser);
      asMock(accountRepo.findByUserIdAndProvider).mockResolvedValue({
        ...AccountBuilder.create(deletedUser.id).build(),
        id: 1,
        userId: deletedUser.id,
        provider: "CREDENTIAL",
        password: "hashed-pw",
      });
      passwordService.verify.mockResolvedValue(true);
      loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);
      uow.run.mockImplementation((work) => work());
      sessionService.createSessionWithTokens.mockResolvedValue({
        sessionId: "session-123",
        tokens: {
          accessToken: "access",
          refreshToken: "refresh",
          expiresIn: 900,
        },
        tokenFamily: "family-123",
      });
      asMock(userRepo.findByIdWithProfile).mockResolvedValue({
        id: deletedUser.id,
        profile: { name: "Test", profileImage: null },
      });

      // When
      const result = await service.login({
        email: "deleted@example.com",
        password: "Password123",
      });

      // Then - 로그인 성공 + accountRestored 플래그
      expect(result.tokens).toBeDefined();
      expect(result.userId).toBe(deletedUser.id);
      expect(result.accountRestored).toBe(true);

      // 복구 호출 확인
      expect(userRepo.restore).toHaveBeenCalledWith(deletedUser.id);
      // ACCOUNT_RESTORED 보안 로그 확인
      expect(securityLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "ACCOUNT_RESTORED",
          userId: deletedUser.id,
        }),
      );
      // 캐시 무효화 확인
      expect(cacheService.invalidateUserProfile).toHaveBeenCalledWith(deletedUser.id);
    });
  });

  describe("resendVerification", () => {
    const email = "test@example.com";

    it("인증 코드를 재발송한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(email)
        .withStatus("PENDING_VERIFY")
        .build();

      userRepo.findByEmail.mockResolvedValue(mockUser);
      uow.run.mockImplementation((work) => work());
      verificationService.createEmailVerification.mockResolvedValue({
        code: "123456",
        expiresAt: new Date(),
      });
      verificationService.sendVerificationEmail.mockResolvedValue(undefined);

      // When
      const result = await service.resendVerification(email);

      // Then
      expect(verificationService.createEmailVerification).toHaveBeenCalled();
      expect(verificationService.sendVerificationEmail).toHaveBeenCalledWith(
        email,
        expect.any(String),
      );
      expect(result.message).toBeDefined();
    });

    it("존재하지 않는 이메일도 동일한 응답을 반환한다 (보안)", async () => {
      // Given
      userRepo.findByEmail.mockResolvedValue(null);

      // When
      const result = await service.resendVerification(email);

      // Then
      expect(result.message).toBeDefined();
    });

    it("이미 인증된 사용자면 에러를 던진다", async () => {
      // Given
      const verifiedUser = UserBuilder.create().withEmail(email).verified().build();

      userRepo.findByEmail.mockResolvedValue(verifiedUser);

      // When & Then
      await expect(service.resendVerification(email)).rejects.toThrow(ApplicationException);
    });

    it("이메일 전송 실패해도 재전송 요청은 성공한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail(email)
        .withStatus("PENDING_VERIFY")
        .build();

      userRepo.findByEmail.mockResolvedValue(mockUser);
      uow.run.mockImplementation((work) => work());
      verificationService.createEmailVerification.mockResolvedValue({
        code: "654321",
        expiresAt: new Date(),
      });
      verificationService.sendVerificationEmail.mockRejectedValue(
        new Error("Email service unavailable"),
      );

      // When
      const result = await service.resendVerification(email);

      // Then
      expect(result.message).toBeDefined();
    });
  });

  describe("getCurrentUser", () => {
    it("캐시된 프로필을 조회하여 사용자 정보를 반환한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail("test@example.com")
        .verified()
        .build();

      const cachedProfile: AuthCachedUserProfile = {
        id: mockUser.id,
        email: mockUser.email,
        userTag: mockUser.userTag,
        role: mockUser.role,
        status: mockUser.status,
        emailVerifiedAt: mockUser.emailVerifiedAt?.toISOString() ?? null,
        subscriptionStatus: mockUser.subscriptionStatus,
        subscriptionExpiresAt: null,
        name: "Test User",
        profileImage: null,
        createdAt: mockUser.createdAt.toISOString(),
        providers: ["CREDENTIAL"],
      };
      asMock(cacheService.wrapUserProfile).mockResolvedValue(cachedProfile);

      // When
      const result = await service.getCurrentUser(mockUser.id, mockUser.email, "session-123");

      // Then
      expect(result.userId).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.name).toBe("Test User");
      expect(result.providers).toEqual(["CREDENTIAL"]);
    });

    it("사용자가 존재하지 않으면 에러를 던진다", async () => {
      // Given
      cacheService.wrapUserProfile.mockResolvedValue(undefined);

      // When & Then
      await expect(
        service.getCurrentUser("user-123", "test@example.com", "session-123"),
      ).rejects.toThrow(ApplicationException);
    });

    it("다중 provider (CREDENTIAL + GOOGLE) 목록을 반환한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail("multi@example.com")
        .verified()
        .build();

      const cachedProfile: AuthCachedUserProfile = {
        id: mockUser.id,
        email: mockUser.email,
        userTag: mockUser.userTag,
        role: mockUser.role,
        status: mockUser.status,
        emailVerifiedAt: mockUser.emailVerifiedAt?.toISOString() ?? null,
        subscriptionStatus: mockUser.subscriptionStatus,
        subscriptionExpiresAt: null,
        name: "Multi Provider User",
        profileImage: null,
        createdAt: mockUser.createdAt.toISOString(),
        providers: ["CREDENTIAL", "GOOGLE"],
      };
      asMock(cacheService.wrapUserProfile).mockResolvedValue(cachedProfile);

      // When
      const result = await service.getCurrentUser(mockUser.id, mockUser.email, "session-123");

      // Then
      expect(result.providers).toEqual(["CREDENTIAL", "GOOGLE"]);
      expect(result.providers).toHaveLength(2);
    });

    it("sessionId는 캐시되지 않고 항상 파라미터 값을 사용한다", async () => {
      // Given
      const mockUser = UserBuilder.create()
        .withId("user-123")
        .withEmail("test@example.com")
        .verified()
        .build();

      const cachedProfile: AuthCachedUserProfile = {
        id: mockUser.id,
        email: mockUser.email,
        userTag: mockUser.userTag,
        role: mockUser.role,
        status: mockUser.status,
        emailVerifiedAt: mockUser.emailVerifiedAt?.toISOString() ?? null,
        subscriptionStatus: mockUser.subscriptionStatus,
        subscriptionExpiresAt: null,
        name: "Test User",
        profileImage: null,
        createdAt: mockUser.createdAt.toISOString(),
        providers: ["CREDENTIAL"],
      };
      asMock(cacheService.wrapUserProfile).mockResolvedValue(cachedProfile);

      // When
      const result = await service.getCurrentUser(
        mockUser.id,
        mockUser.email,
        "different-session-456",
      );

      // Then
      expect(result.sessionId).toBe("different-session-456");
    });
  });

  describe("updateProfile", () => {
    const userId = "user-123";
    const updateData = { name: "Updated Name" };

    it("프로필을 업데이트하고 캐시를 무효화한다", async () => {
      // Given
      asMock(userRepo.updateProfile).mockResolvedValue({
        name: "Updated Name",
        profileImage: null,
      });
      cacheService.invalidateUserProfile.mockResolvedValue(undefined);

      // When
      const result = await service.updateProfile(userId, updateData);

      // Then
      expect(result.message).toContain("프로필이 수정되었습니다");
      expect(result.name).toBe("Updated Name");
      expect(cacheService.invalidateUserProfile).toHaveBeenCalledWith(userId);
    });

    it("프로필 업데이트 후 캐시 무효화가 호출된다", async () => {
      // Given
      asMock(userRepo.updateProfile).mockResolvedValue({
        name: "Updated Name",
        profileImage: null,
      });
      cacheService.invalidateUserProfile.mockResolvedValue(undefined);

      // When
      await service.updateProfile(userId, updateData);

      // Then - 호출 순서 검증
      const updateCallOrder = userRepo.updateProfile.mock.invocationCallOrder[0];
      const invalidateCallOrder = cacheService.invalidateUserProfile.mock.invocationCallOrder[0];
      expect(invalidateCallOrder).toBeGreaterThan(updateCallOrder ?? 0);
    });

    it("프로필 이미지를 URL로 업데이트할 수 있다", async () => {
      // Given
      const imageUpdateData = {
        profileImage: "https://example.com/new-image.jpg",
      };
      asMock(userRepo.updateProfile).mockResolvedValue({
        name: "Test User",
        profileImage: "https://example.com/new-image.jpg",
      });
      cacheService.invalidateUserProfile.mockResolvedValue(undefined);

      // When
      const result = await service.updateProfile(userId, imageUpdateData);

      // Then
      expect(result.profileImage).toBe("https://example.com/new-image.jpg");
    });

    it("프로필 이미지를 아이콘 키로 업데이트할 수 있다", async () => {
      // Given
      const iconKeyUpdateData = {
        profileImage: "scottish_fold",
      };
      asMock(userRepo.updateProfile).mockResolvedValue({
        name: "Test User",
        profileImage: "scottish_fold",
      });
      cacheService.invalidateUserProfile.mockResolvedValue(undefined);

      // When
      const result = await service.updateProfile(userId, iconKeyUpdateData);

      // Then
      expect(result.profileImage).toBe("scottish_fold");
    });
  });
});
