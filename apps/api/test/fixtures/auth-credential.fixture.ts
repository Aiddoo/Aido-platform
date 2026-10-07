import { mock } from "vitest-mock-extended";

import { SessionService } from "#api/modules/identity/application/services/auth/session.service";
import { VerificationService } from "#api/modules/identity/application/services/auth/verification.service";
import { IssueLogin } from "#api/modules/identity/application/use-cases/auth/issue-login.use-case";
import { ProvisionUser } from "#api/modules/identity/application/use-cases/auth/provision-user.use-case";
import { RestoreAccount } from "#api/modules/identity/application/use-cases/auth/restore-account.use-case";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { FakeEmailService } from "#test/mocks/fake-email.service";
import { StubAccountRepository } from "#test/mocks/ports/account-lifecycle.stub";
import {
  StubAuthUserRepository,
  StubAuthPasswordHasher,
  StubAuthLoginAttemptRepository,
  StubAuthProfileCache,
  StubAuthVerificationRepository,
  StubVerificationCodeSecurity,
  StubAuthRegistrationNotifier,
  StubAuthRetentionEnroller,
  StubAuthProvisioningSeeder,
} from "#test/mocks/ports/auth-credentials.stub";
import {
  StubAuthSessionRepository,
  StubAuthSecurityLogRepository,
  StubAuthTokenIssuer,
} from "#test/mocks/ports/auth-session.stub";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { AccountFixture, UserFixture } from "./user.fixture.js";

export const AUTH_CREDENTIAL_TIME = new Date("2026-12-31T23:59:00Z");
export const AUTH_CREDENTIAL_PASSWORD = "CorrectPassword1!";

export function createAuthCredentialFixture(
  input: { socialOnly?: boolean; pending?: boolean; empty?: boolean } = {},
) {
  const user = UserFixture.create({
    id: "credential-user",
    email: "credential@example.com",
    status: input.pending ? "PENDING_VERIFY" : "ACTIVE",
    emailVerifiedAt: input.pending ? null : AUTH_CREDENTIAL_TIME,
  });
  const accountRepository = new StubAccountRepository(
    input.empty
      ? []
      : [
          AccountFixture.create({
            userId: user.id,
            provider: input.socialOnly ? "GOOGLE" : "CREDENTIAL",
            password: input.socialOnly ? null : `digest:${AUTH_CREDENTIAL_PASSWORD}`,
          }),
        ],
  );
  const userRepository = new StubAuthUserRepository(
    input.empty ? [] : [user],
    accountRepository.accounts,
  );
  userRepository.profiles.set(user.id, { name: "사용자", profileImage: null });
  const sessionRepository = new StubAuthSessionRepository();
  const securityLogRepository = new StubAuthSecurityLogRepository();
  const tokenService = new StubAuthTokenIssuer();
  const passwordService = new StubAuthPasswordHasher();
  const loginAttemptRepository = new StubAuthLoginAttemptRepository();
  const verificationRepository = new StubAuthVerificationRepository();
  const verificationCodeSecurity = new StubVerificationCodeSecurity();
  const cacheService = new StubAuthProfileCache();
  const emailSender = new FakeEmailService();
  const adminEventNotifier = new StubAuthRegistrationNotifier();
  const retentionEnroller = new StubAuthRetentionEnroller();
  const seeder = new StubAuthProvisioningSeeder();
  const logger = mock<ApplicationLogger>();
  const unitOfWork = createUnitOfWorkMock();
  const sessionService = new SessionService({ sessionRepository, tokenService });
  const verificationService = new VerificationService({
    verificationRepository,
    verificationCodeSecurity,
    emailSender,
    logger,
  });
  const provisionUserUseCase = new ProvisionUser({
    userRepository,
    accountRepository,
    seeder,
    retentionEnroller,
  });
  const issueLoginUseCase = new IssueLogin({
    sessionService,
    loginAttemptRepository,
    securityLogRepository,
    userRepository,
  });
  const restoreAccount = new RestoreAccount({ userRepository, securityLogRepository });
  return {
    user,
    userRepository,
    accountRepository,
    sessionRepository,
    securityLogRepository,
    tokenService,
    passwordService,
    loginAttemptRepository,
    verificationRepository,
    verificationCodeSecurity,
    cacheService,
    emailSender,
    adminEventNotifier,
    retentionEnroller,
    seeder,
    logger,
    unitOfWork,
    sessionService,
    verificationService,
    provisionUserUseCase,
    issueLoginUseCase,
    restoreAccount,
  };
}
