import type { AccessTier } from "@aido/api/vocabulary";

import type {
  EntitlementReaderPort,
  UserEntitlementsReadModel,
} from "#api/modules/access/feature-grants/access-feature-grants.public";
import type {
  MeteredFeatureQuotaReadModel,
  QuotaLedgerPort,
} from "#api/modules/access/quota-charges/access-quota-charges.public";
import { planOfTier } from "#api/modules/access/shared/domain/entitlement.domain-service";
import type {
  PremiumAccessReadModel,
  PremiumAccessReaderPort,
} from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { CreateSessionUseCase } from "#api/modules/identity/sessions/application/use-cases/create-session.use-case";
import { IssueLoginUseCase } from "#api/modules/identity/sessions/application/use-cases/issue-login.use-case";
import { ProvisionUserUseCase } from "#api/modules/identity/users/application/use-cases/provision-user.use-case";
import { RestoreAccountUseCase } from "#api/modules/identity/users/application/use-cases/restore-account.use-case";
import { ConsumeVerificationCodeUseCase } from "#api/modules/identity/verifications/application/use-cases/consume-verification-code.use-case";
import { IssueVerificationCodeUseCase } from "#api/modules/identity/verifications/application/use-cases/issue-verification-code.use-case";
import { ReleaseVerificationEmailCapUseCase } from "#api/modules/identity/verifications/application/use-cases/release-verification-email-cap.use-case";
import { ReserveVerificationEmailCapUseCase } from "#api/modules/identity/verifications/application/use-cases/reserve-verification-email-cap.use-case";
import { SendVerificationCodeUseCase } from "#api/modules/identity/verifications/application/use-cases/send-verification-code.use-case";
import type {
  DailySendUsage,
  DailySendUsageReaderPort,
} from "#api/modules/social/cheers/social-cheers.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryEntitlementCache } from "#test/doubles/access/in-memory-entitlement-cache";
import { InMemoryLinkedAccountsRepository } from "#test/doubles/identity/in-memory-linked-accounts.repository";
import { InMemoryLoginAttemptRepository } from "#test/doubles/identity/in-memory-login-attempt.repository";
import { InMemoryPasswordResetCooldown } from "#test/doubles/identity/in-memory-password-reset-cooldown";
import { InMemorySecurityLogRepository } from "#test/doubles/identity/in-memory-security-log.repository";
import { InMemorySessionRepository } from "#test/doubles/identity/in-memory-session.repository";
import { InMemoryUserMutationLock } from "#test/doubles/identity/in-memory-user-mutation-lock";
import { InMemoryUserRepository } from "#test/doubles/identity/in-memory-user.repository";
import { InMemoryVerificationEmailCap } from "#test/doubles/identity/in-memory-verification-email-cap";
import { InMemoryVerificationRepository } from "#test/doubles/identity/in-memory-verification.repository";
import {
  StubPasswordHasher,
  StubUserProfileCache,
  StubVerificationCodeSecurity,
  StubUserRegistrationNotifier,
  StubRetentionEnroller,
  StubUserProvisioningSeeder,
} from "#test/doubles/identity/stub-auth-credentials";
import {
  StubSessionPushDeviceReleaser,
  StubTokenIssuer,
} from "#test/doubles/identity/stub-auth-session";
import { FakeEmailSender } from "#test/doubles/notification/fake-email-sender";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createFeatureEntitlementsFixture } from "#test/fixtures/access/access-user.fixture";
import { createLinkedAccountFixture } from "#test/fixtures/identity/auth-credential.fixture";
import { AUTH_FIXTURE_NOW, createUserFixture } from "#test/fixtures/identity/session.fixture";

export const AUTH_CREDENTIAL_NOW = AUTH_FIXTURE_NOW;
export const AUTH_CREDENTIAL_PASSWORD = "CorrectPassword1!";

export function createAuthCredentialFixture(
  input: { socialOnly?: boolean; pending?: boolean; empty?: boolean } = {},
) {
  const user = createUserFixture({
    id: "credential-user",
    email: "credential@example.com",
    userTag: "CRED0001",
    status: input.pending ? "PENDING_VERIFY" : "ACTIVE",
    emailVerifiedAt: input.pending ? null : AUTH_CREDENTIAL_NOW,
  }).toPrimitives();
  const accountRepository = new InMemoryLinkedAccountsRepository(
    input.empty
      ? []
      : [
          createLinkedAccountFixture({
            userId: user.id,
            providerAccountId: user.id,
            provider: input.socialOnly ? "GOOGLE" : "CREDENTIAL",
            password: input.socialOnly ? null : `digest:${AUTH_CREDENTIAL_PASSWORD}`,
          }),
        ],
  );
  const userRepository = new InMemoryUserRepository(input.empty ? [] : [createUserFixture(user)], {
    accounts: accountRepository,
    profiles: new Map(input.empty ? [] : [[user.id, { name: "사용자", profileImage: null }]]),
  });
  const sessionRepository = new InMemorySessionRepository();
  const securityLogRepository = new InMemorySecurityLogRepository();
  const tokenService = new StubTokenIssuer();
  const passwordService = new StubPasswordHasher();
  const loginAttemptRepository = new InMemoryLoginAttemptRepository();
  const verificationRepository = new InMemoryVerificationRepository();
  const verificationCodeSecurity = new StubVerificationCodeSecurity();
  const cacheService = new StubUserProfileCache();
  const pushDevices = new StubSessionPushDeviceReleaser();
  const emailSender = new FakeEmailSender();
  const adminEventNotifier = new StubUserRegistrationNotifier();
  const retentionEnroller = new StubRetentionEnroller();
  const seeder = new StubUserProvisioningSeeder();
  const logger = new SilentLogger();
  const unitOfWork = new ImmediateUnitOfWork();
  const clock = new FixedClock(AUTH_CREDENTIAL_NOW);
  const sessionService = new CreateSessionUseCase({ sessionRepository, tokenService, clock });
  const verificationEmailCap = new InMemoryVerificationEmailCap();
  const reserveVerificationEmailCap = new ReserveVerificationEmailCapUseCase({
    verificationEmailCap,
    clock,
  });
  const releaseVerificationEmailCap = new ReleaseVerificationEmailCapUseCase({
    verificationEmailCap,
  });
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
    clock,
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
    userMutationLock: new InMemoryUserMutationLock(userRepository),
    accountRepository,
    sessionRepository,
    securityLogRepository,
    resetCooldown: new InMemoryPasswordResetCooldown(),
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
    verificationEmailCap,
    reserveVerificationEmailCap,
    releaseVerificationEmailCap,
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

  async getEntitlements(userId: UserId): Promise<UserEntitlementsReadModel> {
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

  async read(_userId: UserId): Promise<MeteredFeatureQuotaReadModel> {
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
  readonly accesses = new Map<string, PremiumAccessReadModel>();
  readonly requestedUserIds: string[] = [];

  async getPremiumAccess(userId: UserId): Promise<PremiumAccessReadModel> {
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
