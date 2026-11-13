import type { AccessTier } from "@aido/api/vocabulary";

import type {
  EntitlementReaderPort,
  UserEntitlements,
} from "#api/modules/access/entitlements/access-entitlements.public";
import type {
  MeteredFeatureQuota,
  QuotaLedgerPort,
} from "#api/modules/access/quotas/access-quotas.public";
import { planOfTier } from "#api/modules/access/shared/domain/entitlement.domain-service";
import type {
  PremiumAccess,
  PremiumAccessReaderPort,
} from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { ConsumeVerificationCodeUseCase } from "#api/modules/identity/auth/application/use-cases/consume-verification-code.use-case";
import { CreateSessionUseCase } from "#api/modules/identity/auth/application/use-cases/create-session.use-case";
import { IssueLoginUseCase } from "#api/modules/identity/auth/application/use-cases/issue-login.use-case";
import { IssueVerificationCodeUseCase } from "#api/modules/identity/auth/application/use-cases/issue-verification-code.use-case";
import { ProvisionUserUseCase } from "#api/modules/identity/auth/application/use-cases/provision-user.use-case";
import { RestoreAccountUseCase } from "#api/modules/identity/auth/application/use-cases/restore-account.use-case";
import { SendVerificationCodeUseCase } from "#api/modules/identity/auth/application/use-cases/send-verification-code.use-case";
import type {
  DailySendUsage,
  DailySendUsageReaderPort,
} from "#api/modules/social/cheers/social-cheers.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryEntitlementCache } from "#test/doubles/access/in-memory-entitlement-cache";
import { InMemoryAuthAccountRepository } from "#test/doubles/identity/in-memory-auth-account.repository";
import { InMemoryAuthLoginAttemptRepository } from "#test/doubles/identity/in-memory-auth-login-attempt.repository";
import { InMemoryAuthSecurityLogRepository } from "#test/doubles/identity/in-memory-auth-security-log.repository";
import { InMemoryAuthSessionRepository } from "#test/doubles/identity/in-memory-auth-session.repository";
import { InMemoryAuthUserRepository } from "#test/doubles/identity/in-memory-auth-user.repository";
import { InMemoryAuthVerificationRepository } from "#test/doubles/identity/in-memory-auth-verification.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createFeatureEntitlementsFixture } from "#test/fixtures/access/access-user.fixture";
import { FakeEmailService } from "#test/mocks/fake-email.service";
import {
  StubAuthPasswordHasher,
  StubAuthProfileCache,
  StubVerificationCodeSecurity,
  StubAuthRegistrationNotifier,
  StubAuthRetentionEnroller,
  StubAuthProvisioningSeeder,
} from "#test/mocks/ports/auth-credentials.stub";
import {
  StubSessionPushDeviceReleaser,
  StubAuthTokenIssuer,
} from "#test/mocks/ports/auth-session.stub";

import { createAuthAccountFixture } from "./identity/auth-credential.fixture.js";
import { AUTH_FIXTURE_NOW, createIdentityUserFixture } from "./identity/auth-session.fixture.js";

export const AUTH_CREDENTIAL_NOW = AUTH_FIXTURE_NOW;
export const AUTH_CREDENTIAL_PASSWORD = "CorrectPassword1!";

export function createAuthCredentialFixture(
  input: { socialOnly?: boolean; pending?: boolean; empty?: boolean } = {},
) {
  const user = createIdentityUserFixture({
    id: "credential-user",
    email: "credential@example.com",
    userTag: "CRED0001",
    status: input.pending ? "PENDING_VERIFY" : "ACTIVE",
    emailVerifiedAt: input.pending ? null : AUTH_CREDENTIAL_NOW,
  }).toPrimitives();
  const accountRepository = new InMemoryAuthAccountRepository(
    input.empty
      ? []
      : [
          createAuthAccountFixture({
            userId: user.id,
            providerAccountId: user.id,
            provider: input.socialOnly ? "GOOGLE" : "CREDENTIAL",
            password: input.socialOnly ? null : `digest:${AUTH_CREDENTIAL_PASSWORD}`,
          }),
        ],
  );
  const userRepository = new InMemoryAuthUserRepository(
    input.empty ? [] : [createIdentityUserFixture(user)],
    {
      accounts: accountRepository,
      profiles: new Map(input.empty ? [] : [[user.id, { name: "사용자", profileImage: null }]]),
    },
  );
  const sessionRepository = new InMemoryAuthSessionRepository();
  const securityLogRepository = new InMemoryAuthSecurityLogRepository();
  const tokenService = new StubAuthTokenIssuer();
  const passwordService = new StubAuthPasswordHasher();
  const loginAttemptRepository = new InMemoryAuthLoginAttemptRepository();
  const verificationRepository = new InMemoryAuthVerificationRepository();
  const verificationCodeSecurity = new StubVerificationCodeSecurity();
  const cacheService = new StubAuthProfileCache();
  const pushDevices = new StubSessionPushDeviceReleaser();
  const emailSender = new FakeEmailService();
  const adminEventNotifier = new StubAuthRegistrationNotifier();
  const retentionEnroller = new StubAuthRetentionEnroller();
  const seeder = new StubAuthProvisioningSeeder();
  const logger = new SilentLogger();
  const unitOfWork = new ImmediateUnitOfWork();
  const clock = new FixedClock(AUTH_CREDENTIAL_NOW);
  const sessionService = new CreateSessionUseCase({ sessionRepository, tokenService, clock });
  const issueVerificationCode = new IssueVerificationCodeUseCase({
    verificationRepository,
    verificationCodeSecurity,
    clock,
    logger,
  });
  const sendVerificationCode = new SendVerificationCodeUseCase({ emailSender, logger });
  const consumeVerificationCode = new ConsumeVerificationCodeUseCase({
    verificationRepository,
    verificationCodeSecurity,
    clock,
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
    clock,
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
    entitlementCache: new InMemoryEntitlementCache(),
    pushDevices,
    emailSender,
    adminEventNotifier,
    retentionEnroller,
    seeder,
    logger,
    alert: new RecordingOperationalAlert(),
    unitOfWork,
    clock,
    sessionService,
    issueVerificationCode,
    sendVerificationCode,
    consumeVerificationCode,
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
export class StubCurrentUserAccess implements Pick<EntitlementReaderPort, "getEntitlements"> {
  readonly tiers = new Map<string, AccessTier>();
  readonly activeSubscriptionUserIds = new Set<string>();

  async getEntitlements(userId: UserId): Promise<UserEntitlements> {
    const tier = this.tiers.get(userId.value) ?? "FREE";
    return {
      tier,
      plan: planOfTier(tier),
      isPremium: this.activeSubscriptionUserIds.has(userId.value),
      features: createFeatureEntitlementsFixture(tier),
    };
  }
}

class StubCurrentUserQuotaLedger implements Pick<QuotaLedgerPort, "read"> {
  used = 0;
  resetsAt = "2026-11-30T15:00:00.000Z";

  async read(_userId: UserId): Promise<MeteredFeatureQuota> {
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

class StubDailySendUsage implements Pick<DailySendUsageReaderPort, "readDailyUsage"> {
  used = 0;
  resetsAt = new Date("2026-11-03T15:00:00.000Z");
  readonly timezones: string[] = [];

  async readDailyUsage(_userId: UserId, timezone: string): Promise<DailySendUsage> {
    this.timezones.push(timezone);
    return { used: this.used, resetsAt: new Date(this.resetsAt) };
  }
}

/** 사용자별 프리미엄 출처를 정해 두는 대역. 기본값은 프리미엄 아님이다. */
class StubPremiumAccessReader implements PremiumAccessReaderPort {
  readonly accesses = new Map<string, PremiumAccess>();
  readonly requestedUserIds: string[] = [];

  async getPremiumAccess(userId: UserId): Promise<PremiumAccess> {
    this.requestedUserIds.push(userId.value);
    return (
      this.accesses.get(userId.value) ?? {
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
