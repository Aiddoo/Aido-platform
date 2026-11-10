import { GetResolvedAccessUseCase } from "#api/modules/access/entitlements/application/use-cases/get-resolved-access.use-case";
import { hasPaidAccess } from "#api/modules/access/entitlements/domain/paid-access.domain-service";
import { EntitlementReaderAdapter } from "#api/modules/access/entitlements/infrastructure/adapters/entitlement-reader.adapter";
import { DrizzleAccessStateReader } from "#api/modules/access/entitlements/infrastructure/persistence/drizzle-access-state.reader";
import { activeSubscriptionCondition } from "#api/modules/access/entitlements/infrastructure/persistence/premium-access-condition.reader";
import { STORE_RENEWAL_GRACE_MS } from "#api/modules/billing/subscriptions/billing-subscriptions-entitlement.public";
import { DrizzleSchedulerReader } from "#api/modules/notification/reminders/infrastructure/persistence/drizzle-scheduler.reader";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheService } from "#api/platform/cache/cache.service";
import { createEntityId } from "#api/platform/database/entity-id";
import { subscription, user, userPreference } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { UserPreferenceBuilder } from "#test/builders/index";
import { DateClock } from "#test/doubles/platform/date-clock";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
const TODAY = new Date("2026-11-03T00:00:00.000Z");
const TOMORROW = new Date("2026-11-04T00:00:00.000Z");

type Scenario =
  | "expiredProjection"
  | "renewingInGrace"
  | "renewingAfterGrace"
  | "cancelledStoreExpired"
  | "cancelledInBillingGrace"
  | "billingGraceEnded"
  | "noDeadline"
  | "futureProjection"
  | "admin"
  | "free";

describe("유효 프리미엄 SQL 조건과 스케줄러 대상 (실제 PostgreSQL)", () => {
  const database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 2 }) });
  let client: TestDatabaseClient;
  let memory: InMemoryCacheStore;
  let reader: DrizzleSchedulerReader;
  let entitlement: EntitlementReaderAdapter;
  let entitlementReader: DrizzleAccessStateReader;
  let userIds: Record<Scenario, string>;

  beforeAll(async () => {
    client = await database.start();
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 10 });
    const { txHost } = createDatabaseTransactionFixture(client);
    reader = new DrizzleSchedulerReader(txHost, new CacheService(memory), {
      onboardingV2: { enabled: false, treatmentPercent: 50 },
    });
    entitlementReader = new DrizzleAccessStateReader(txHost);
    entitlement = new EntitlementReaderAdapter(
      new GetResolvedAccessUseCase({
        accessStateReader: entitlementReader,
        entitlementCache: { wrap: (_userId, factory) => factory() },
        clock: new DateClock(),
      }),
    );
  });

  beforeEach(async () => {
    suppressLogger();
    await database.cleanup();
    const now = Date.now();
    const at = (offsetMs: number) => new Date(now + offsetMs);
    userIds = {
      expiredProjection: createEntityId(),
      renewingInGrace: createEntityId(),
      renewingAfterGrace: createEntityId(),
      cancelledStoreExpired: createEntityId(),
      cancelledInBillingGrace: createEntityId(),
      billingGraceEnded: createEntityId(),
      noDeadline: createEntityId(),
      futureProjection: createEntityId(),
      admin: createEntityId(),
      free: createEntityId(),
    };
    const active = (id: string, subscriptionExpiresAt: Date | null) =>
      UserFixture.create({
        id,
        subscriptionStatus: "ACTIVE",
        subscriptionExpiresAt:
          subscriptionExpiresAt == null ? null : instantFromDate(subscriptionExpiresAt),
      });
    await client
      .insert(user)
      .values([
        active(userIds.expiredProjection, at(-4 * HOUR_MS)),
        active(userIds.renewingInGrace, at(-HOUR_MS)),
        active(userIds.renewingAfterGrace, at(-STORE_RENEWAL_GRACE_MS - HOUR_MS)),
        active(userIds.cancelledStoreExpired, at(-HOUR_MS)),
        active(userIds.cancelledInBillingGrace, at(-5 * DAY_MS)),
        active(userIds.billingGraceEnded, at(-20 * DAY_MS)),
        active(userIds.noDeadline, null),
        active(userIds.futureProjection, at(24 * HOUR_MS)),
        UserFixture.create({ id: userIds.admin, role: "ADMIN" }),
        UserFixture.create({ id: userIds.free }),
      ]);
    const store = (
      userId: string,
      status: "ACTIVE" | "CANCELLED",
      expiresAt: Date,
      gracePeriodEndsAt: Date | null = null,
    ) => ({
      userId,
      revenueCatId: `store-${userId}`,
      productId: "premium_monthly",
      status,
      startedAt: instantFromDate(at(-30 * 24 * HOUR_MS)),
      expiresAt: instantFromDate(expiresAt),
      gracePeriodEndsAt: gracePeriodEndsAt == null ? null : instantFromDate(gracePeriodEndsAt),
      updatedAt: instantFromDate(at(0)),
    });
    await client.insert(subscription).values([
      store(userIds.renewingInGrace, "ACTIVE", at(-HOUR_MS)),
      store(userIds.renewingAfterGrace, "ACTIVE", at(-STORE_RENEWAL_GRACE_MS - HOUR_MS)),
      store(userIds.cancelledStoreExpired, "CANCELLED", at(-HOUR_MS)),
      // 결제 실패(BILLING_ISSUE + CANCELLATION) 뒤 스토어 결제 유예 10일째
      store(userIds.cancelledInBillingGrace, "CANCELLED", at(-5 * DAY_MS), at(5 * DAY_MS)),
      store(userIds.billingGraceEnded, "ACTIVE", at(-20 * DAY_MS), at(-HOUR_MS)),
    ]);
    await client
      .insert(userPreference)
      .values(Object.values(userIds).map((id) => UserPreferenceBuilder.create(id).build()));
  });

  afterAll(async () => {
    await database.stop();
  });

  const premium: Scenario[] = [
    "renewingInGrace",
    "cancelledInBillingGrace",
    "noDeadline",
    "futureProjection",
    "admin",
  ];
  const free: Scenario[] = [
    "expiredProjection",
    "renewingAfterGrace",
    "cancelledStoreExpired",
    "billingGraceEnded",
    "free",
  ];

  it("만료가 지난 ACTIVE projection은 무료 대상이고 자동 갱신 유예 안의 구독자는 프리미엄 대상이다", async () => {
    // When
    const freeIds = await reader.findFreeRecipientIds(Object.values(userIds));
    const premiumMorning = await reader.findPremiumMorningReminderUsers({
      tz: "UTC",
      hour: 8,
      minute: 0,
      today: TODAY,
      tomorrow: TOMORROW,
    });

    // Then
    expect([...freeIds].sort()).toEqual(free.map((scenario) => userIds[scenario]).sort());
    expect(premiumMorning.map((row) => row.id).sort()).toEqual(
      premium.map((scenario) => userIds[scenario]).sort(),
    );
  });

  it("SQL 조건은 모든 경우에 EntitlementReaderAdapter의 프리미엄 판단과 같다", async () => {
    // When
    const freeIds = await reader.findFreeRecipientIds(Object.values(userIds));
    const decisions = await Promise.all(
      Object.entries(userIds).map(async ([scenario, id]) => ({
        scenario,
        sql: !freeIds.has(id),
        service: await entitlement.canInTx(id, "AI_REPORT"),
      })),
    );

    // Then
    for (const decision of decisions) {
      expect(decision.sql, decision.scenario).toBe(decision.service);
    }
  });

  it("유료 접근은 TS hasPaidAccess·/me isPremium·SQL activeSubscriptionCondition이 모두 같다", async () => {
    // Given
    const at = new Date();
    const sqlRows = await client
      .select({ id: user.id, paid: activeSubscriptionCondition(user, at) })
      .from(user);
    const sqlPaid = new Map(sqlRows.map((row) => [row.id, row.paid === true]));

    // When
    const decisions = await Promise.all(
      Object.entries(userIds).map(async ([scenario, id]) => {
        const state = await entitlementReader.findActiveUserAccessState(UserId.reconstitute(id));
        return {
          scenario,
          sql: sqlPaid.get(id),
          ts: state != null && hasPaidAccess({ state, now: instantFromDate(at) }),
          isPremium: (await entitlement.getAccessSnapshot(id)).isPremium,
        };
      }),
    );

    // Then
    for (const decision of decisions) {
      expect([decision.ts, decision.isPremium], decision.scenario).toEqual([
        decision.sql,
        decision.sql,
      ]);
    }
  });
});
