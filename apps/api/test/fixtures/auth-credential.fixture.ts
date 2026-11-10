import { mock } from "vitest-mock-extended";

import type {
  AccessSnapshot,
  EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import type { MeteredFeatureQuota, QuotaLedgerPort } from "#api/modules/access/access-quota.public";
import {
  type AccessTier,
  NO_RESOURCE_BONUSES,
  resolveAllFeatureAccess,
} from "#api/modules/access/domain/policies/entitlement/entitlement.policy";
import type {
  PremiumAccess,
  PremiumAccessReaderPort,
} from "#api/modules/billing/billing-subscriptions.public";
import { SessionService } from "#api/modules/identity/auth/application/use-cases/create-session.use-case";
import { IssueLoginUseCase } from "#api/modules/identity/auth/application/use-cases/issue-login.use-case";
import { VerificationService } from "#api/modules/identity/auth/application/use-cases/issue-verification-code.use-case";
import { ProvisionUserUseCase } from "#api/modules/identity/auth/application/use-cases/provision-user.use-case";
import { RestoreAccountUseCase } from "#api/modules/identity/auth/application/use-cases/restore-account.use-case";
import type {
  DailySendUsage,
  DailySendUsageReaderPort,
} from "#api/modules/social/social-cheers.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
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
  StubSessionPushDeviceReleaser,
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
  const pushDevices = new StubSessionPushDeviceReleaser();
  const emailSender = new FakeEmailService();
  const adminEventNotifier = new StubAuthRegistrationNotifier();
  const retentionEnroller = new StubAuthRetentionEnroller();
  const seeder = new StubAuthProvisioningSeeder();
  const logger = mock<ApplicationLoggerPort>();
  const unitOfWork = createUnitOfWorkMock();
  const sessionService = new SessionService({ sessionRepository, tokenService });
  const verificationService = new VerificationService({
    verificationRepository,
    verificationCodeSecurity,
    emailSender,
    logger,
  });
  const provisionUserUseCase = new ProvisionUserUseCase({
    userRepository,
    accountRepository,
    seeder,
    retentionEnroller,
  });
  const issueLoginUseCase = new IssueLoginUseCase({
    sessionService,
    loginAttemptRepository,
    securityLogRepository,
    userRepository,
  });
  const restoreAccount = new RestoreAccountUseCase({ userRepository, securityLogRepository });
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
    pushDevices,
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
    premiumAccessReader: new StubPremiumAccessReader(),
    entitlementReader: new StubCurrentUserAccess(),
    quotaLedger: new StubCurrentUserQuotaLedger(),
    cheerUsageReader: new StubDailySendUsage(),
    nudgeUsageReader: new StubDailySendUsage(),
  };
}

/** 사용자별 권한 주체를 정해 두는 대역. 기능 권한은 실제 Access 정책으로 계산한다. */
export class StubCurrentUserAccess implements Pick<EntitlementReaderPort, "getAccessSnapshot"> {
  readonly tiers = new Map<string, AccessTier>();
  readonly activeSubscriptionUserIds = new Set<string>();

  async getAccessSnapshot(userId: string): Promise<AccessSnapshot> {
    const tier = this.tiers.get(userId) ?? "FREE";
    return {
      tier,
      isPremium: this.activeSubscriptionUserIds.has(userId),
      features: resolveAllFeatureAccess(tier, NO_RESOURCE_BONUSES),
    };
  }
}

export class StubCurrentUserQuotaLedger implements Pick<QuotaLedgerPort, "read"> {
  used = 0;
  resetsAt = "2026-11-30T15:00:00.000Z";

  async read(_userId: string): Promise<MeteredFeatureQuota> {
    return {
      feature: "AI_PARSE",
      allowed: true,
      limit: null,
      used: this.used,
      remaining: null,
      period: "month",
      resetsAt: this.resetsAt,
      isFairUse: false,
      perUse: null,
    };
  }
}

export class StubDailySendUsage implements Pick<DailySendUsageReaderPort, "readDailyUsage"> {
  used = 0;
  resetsAt = new Date("2026-11-03T15:00:00.000Z");
  readonly timezones: string[] = [];

  async readDailyUsage(_userId: string, timezone: string): Promise<DailySendUsage> {
    this.timezones.push(timezone);
    return { used: this.used, resetsAt: new Date(this.resetsAt) };
  }
}

/** 사용자별 프리미엄 출처를 정해 두는 대역. 기본값은 프리미엄 아님이다. */
export class StubPremiumAccessReader implements PremiumAccessReaderPort {
  readonly accesses = new Map<string, PremiumAccess>();
  readonly requestedUserIds: string[] = [];

  async getPremiumAccess(userId: string): Promise<PremiumAccess> {
    this.requestedUserIds.push(userId);
    return (
      this.accesses.get(userId) ?? {
        source: null,
        endsAt: null,
        periodEndsAt: null,
        willRenew: false,
        bankedDays: 0,
        recentGrantEndedAt: null,
        isTrial: false,
        planType: null,
      }
    );
  }
}
