import { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { SweepPremiumGrantsUseCase } from "#api/modules/billing/premium-grants/application/use-cases/sweep-premium-grants.use-case";
import {
  PremiumAccessReaderPort,
  PremiumGranterPort,
} from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { STORE_RENEWAL_GRACE_MS } from "#api/modules/billing/shared/domain/store-renewal-grace.domain-service";
import type { RevenueCatWebhookPayload } from "#api/modules/billing/subscriptions/infrastructure/adapters/revenuecat/revenuecat-webhook.wire";
import { RevenueCatWebhookController } from "#api/modules/billing/subscriptions/presentation/http/v1/revenuecat-webhook.controller";
import { GetCurrentUserUseCase } from "#api/modules/identity/users/application/use-cases/get-current-user.use-case";
import { user as userTable } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { instantFromDate } from "#api/shared/domain/time/instant";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { createSubscriptionEventFixture } from "#test/fixtures/billing/subscription-event.fixture";
import { toDateOrNull } from "#test/fixtures/billing/subscription.fixture";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

// KST 13:00
const AT = new Date("2028-02-26T04:00:00.000Z");
const STORE_EXPIRY = new Date("2028-03-10T04:00:00.000Z");
const CHAIN = "timeline-store-chain";
const DAY_MS = 24 * 60 * 60 * 1000;

describe("결제 구독과 보상 기간 결합 타임라인 QA (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let granter: PremiumGranterPort;
  let entitlement: EntitlementReaderPort;
  let userId: string;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 8 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    granter = context.module.get<PremiumGranterPort>(PremiumGranterPort);
    entitlement = context.module.get(EntitlementReaderPort);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const user = createUserRowFixture({
      id: createEntityId(),
      email: "timeline@example.com",
      userTag: "TLINE001",
      createdAt: instantFromDate(AT),
      updatedAt: instantFromDate(AT),
    });
    await client.insert(userTable).values(user);
    userId = user.id;
  });

  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  function webhook(body: unknown) {
    return context.module.get(RevenueCatWebhookController).receive(body);
  }

  function storeEvent(payload: RevenueCatWebhookPayload, eventId: string) {
    return {
      ...payload,
      event: {
        ...payload.event,
        app_user_id: userId,
        original_transaction_id: CHAIN,
        transaction_id: CHAIN,
        id: eventId,
        purchased_at_ms: AT.getTime(),
        expiration_at_ms: STORE_EXPIRY.getTime(),
      },
    };
  }

  function premiumAccess() {
    return context.module
      .get<PremiumAccessReaderPort>(PremiumAccessReaderPort)
      .getPremiumAccess(UserId.reconstitute(userId));
  }

  function isPremium() {
    return entitlement.canInTransaction(UserId.reconstitute(userId), "AI_REPORT");
  }

  async function userProjection() {
    const row = await client.query.user.findFirst({
      columns: { subscriptionStatus: true, subscriptionExpiresAt: true },
      where: { id: userId },
    });
    return row == null
      ? row
      : { ...row, subscriptionExpiresAt: toDateOrNull(row.subscriptionExpiresAt) };
  }

  async function grantsOf() {
    const rows = await client.query.premiumGrant.findMany({
      columns: {
        sourceKey: true,
        status: true,
        durationDays: true,
        durationMs: true,
        startsAt: true,
        endsAt: true,
      },
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      ...row,
      startsAt: toDateOrNull(row.startsAt),
      endsAt: toDateOrNull(row.endsAt),
    }));
  }

  it("자동 갱신 구독 중 받은 보상은 쌓이고 /me 끝은 유예 3시간 뒤부터 이어 붙인다", async () => {
    // Given
    await webhook(storeEvent(createSubscriptionEventFixture("INITIAL_PURCHASE"), "s5-purchase"));

    // When
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "s5:invite",
      durationDays: 7,
    });

    // Then
    expect(await premiumAccess()).toEqual({
      source: "STORE",
      endsAt: new Date(STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS + 7 * DAY_MS),
      periodEndsAt: STORE_EXPIRY,
      willRenew: true,
      bankedDays: 7,
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });
    expect((await grantsOf())[0]).toMatchObject({ status: "BANKED" });
  });

  it("자동 갱신을 끈 구독과 쌓아 둔 보상은 /me와 취소 웹훅 projection 모두 만료 시각부터 이어 붙인다", async () => {
    // Given
    await webhook(storeEvent(createSubscriptionEventFixture("INITIAL_PURCHASE"), "s6-purchase"));
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "s6:invite",
      durationDays: 7,
    });
    vi.setSystemTime(new Date("2028-03-01T04:00:00.000Z"));

    // When
    await webhook(storeEvent(createSubscriptionEventFixture("CANCELLATION"), "s6-cancel"));

    // Then
    expect(await premiumAccess()).toEqual({
      source: "STORE",
      endsAt: new Date(STORE_EXPIRY.getTime() + 7 * DAY_MS),
      periodEndsAt: STORE_EXPIRY,
      willRenew: false,
      bankedDays: 7,
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });
    expect(await userProjection()).toEqual({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: new Date(STORE_EXPIRY.getTime() + 7 * DAY_MS),
    });

    // When
    vi.setSystemTime(STORE_EXPIRY);
    await webhook(storeEvent(createSubscriptionEventFixture("EXPIRATION"), "s6-expire"));

    // Then
    expect(await premiumAccess()).toMatchObject({
      source: "GRANT",
      periodEndsAt: new Date(STORE_EXPIRY.getTime() + 7 * DAY_MS),
      bankedDays: 0,
    });
  });

  it("환불되면 스토어는 즉시 끝나고 쌓아 둔 보상은 환불 시각부터 바로 시작한다", async () => {
    // Given
    await webhook(storeEvent(createSubscriptionEventFixture("INITIAL_PURCHASE"), "s8-purchase"));
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "s8:invite",
      durationDays: 7,
    });
    const refundedAt = new Date("2028-03-01T04:00:00.000Z");
    vi.setSystemTime(refundedAt);

    // When
    await webhook(
      storeEvent(
        createSubscriptionEventFixture("CANCELLATION", { cancel_reason: "CUSTOMER_SUPPORT" }),
        "s8-refund",
      ),
    );

    // Then
    expect(await premiumAccess()).toEqual({
      source: "GRANT",
      endsAt: new Date(refundedAt.getTime() + 7 * DAY_MS),
      periodEndsAt: new Date(refundedAt.getTime() + 7 * DAY_MS),
      willRenew: false,
      bankedDays: 0,
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });
    expect(await entitlement.canInTransaction(UserId.reconstitute(userId), "AI_REPORT")).toBe(true);
  });

  function billingIssue(eventId: string, graceEndsAt: Date) {
    return createSubscriptionEventFixture("BILLING_ISSUE", {
      app_user_id: userId,
      original_transaction_id: CHAIN,
      transaction_id: CHAIN,
      id: eventId,
      purchased_at_ms: AT.getTime(),
      expiration_at_ms: STORE_EXPIRY.getTime(),
      grace_period_expiration_at_ms: graceEndsAt.getTime(),
    });
  }

  function billingErrorCancellation(eventId: string) {
    return storeEvent(
      createSubscriptionEventFixture("CANCELLATION", { cancel_reason: "BILLING_ERROR" }),
      eventId,
    );
  }

  it("스토어 결제 유예 10일째에는 프리미엄을 유지하고 보상을 시작하지 않으며, 결제가 복구되면 쌓아 둔 일수를 그대로 둔다", async () => {
    // Given
    // 결제 실패: RevenueCat은 BILLING_ISSUE와 CANCELLATION(BILLING_ERROR)을 함께 보낸다
    await webhook(storeEvent(createSubscriptionEventFixture("INITIAL_PURCHASE"), "s7-purchase"));
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "s7:invite",
      durationDays: 7,
    });
    const graceEndsAt = new Date(STORE_EXPIRY.getTime() + 16 * DAY_MS);
    vi.setSystemTime(STORE_EXPIRY);
    await webhook(billingIssue("s7-billing", graceEndsAt));
    await webhook(billingErrorCancellation("s7-billing-cancel"));

    // When
    // 유예 10일째 정리
    const insideGrace = new Date(STORE_EXPIRY.getTime() + 10 * DAY_MS);
    vi.setSystemTime(insideGrace);
    await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(insideGrace) });
    const accessInsideGrace = await premiumAccess();
    const premiumInsideGrace = await isPremium();
    const grantsInsideGrace = await grantsOf();

    // When
    // 12일째 결제 복구
    const recoveredAt = new Date(STORE_EXPIRY.getTime() + 12 * DAY_MS);
    vi.setSystemTime(recoveredAt);
    const nextExpiry = new Date(STORE_EXPIRY.getTime() + 42 * DAY_MS);
    await webhook(
      createSubscriptionEventFixture("RENEWAL", {
        app_user_id: userId,
        original_transaction_id: CHAIN,
        transaction_id: `${CHAIN}-r1`,
        id: "s7-renewal",
        expiration_at_ms: nextExpiry.getTime(),
      }),
    );

    // Then
    expect(accessInsideGrace).toEqual({
      source: "STORE",
      endsAt: new Date(graceEndsAt.getTime() + 7 * DAY_MS),
      periodEndsAt: graceEndsAt,
      willRenew: false,
      bankedDays: 7,
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });
    expect(premiumInsideGrace).toBe(true);
    expect(grantsInsideGrace).toEqual([
      expect.objectContaining({ sourceKey: "s7:invite", status: "BANKED", startsAt: null }),
    ]);
    expect(await premiumAccess()).toMatchObject({
      source: "STORE",
      periodEndsAt: nextExpiry,
      willRenew: true,
      bankedDays: 7,
    });
    expect(await grantsOf()).toEqual([
      expect.objectContaining({ sourceKey: "s7:invite", status: "BANKED", durationDays: 7 }),
    ]);
  });

  it("결제 유예가 복구 없이 끝나면 쌓아 둔 보상을 유예 끝부터 한 번만 시작하고 늦은 EXPIRATION도 다시 시작하지 않는다", async () => {
    // Given
    await webhook(storeEvent(createSubscriptionEventFixture("INITIAL_PURCHASE"), "g-purchase"));
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "g:invite",
      durationDays: 7,
    });
    const graceEndsAt = new Date(STORE_EXPIRY.getTime() + 16 * DAY_MS);
    vi.setSystemTime(STORE_EXPIRY);
    await webhook(billingIssue("g-billing", graceEndsAt));
    await webhook(billingErrorCancellation("g-billing-cancel"));

    // When
    const afterGrace = new Date(graceEndsAt.getTime() + 10 * 60_000);
    vi.setSystemTime(afterGrace);
    await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(afterGrace) });
    await webhook(
      createSubscriptionEventFixture("EXPIRATION", {
        app_user_id: userId,
        original_transaction_id: CHAIN,
        transaction_id: CHAIN,
        id: "g-expire",
        expiration_at_ms: STORE_EXPIRY.getTime(),
      }),
    );
    await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(afterGrace) });

    // Then
    expect(await grantsOf()).toEqual([
      {
        sourceKey: "g:invite",
        status: "ACTIVE",
        durationDays: 7,
        durationMs: null,
        startsAt: graceEndsAt,
        endsAt: new Date(graceEndsAt.getTime() + 7 * DAY_MS),
      },
    ]);
    expect(await premiumAccess()).toMatchObject({
      source: "GRANT",
      periodEndsAt: new Date(graceEndsAt.getTime() + 7 * DAY_MS),
      bankedDays: 0,
    });
  });

  it("진행 중인 보상을 두 번 끊어도 남은 기간을 ms 그대로 쌓아 일수 올림이 누적되지 않는다", async () => {
    // Given
    // 보상 진행 중 1일 21시간 뒤 구매, 환불 뒤 다시 1일 9시간 뒤 구매
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "r:invite",
      durationDays: 7,
    });
    vi.setSystemTime(new Date(AT.getTime() + DAY_MS + 21 * 3_600_000));
    await webhook(storeEvent(createSubscriptionEventFixture("INITIAL_PURCHASE"), "r-purchase"));
    const refundedAt = new Date(AT.getTime() + 3 * DAY_MS);
    vi.setSystemTime(refundedAt);
    await webhook(
      storeEvent(
        createSubscriptionEventFixture("CANCELLATION", { cancel_reason: "CUSTOMER_SUPPORT" }),
        "r-refund",
      ),
    );

    // When
    vi.setSystemTime(new Date(refundedAt.getTime() + DAY_MS + 9 * 3_600_000));
    await webhook(
      createSubscriptionEventFixture("INITIAL_PURCHASE", {
        app_user_id: userId,
        original_transaction_id: `${CHAIN}-second`,
        transaction_id: `${CHAIN}-second`,
        id: "r-purchase-2",
        purchased_at_ms: Date.now(),
        expiration_at_ms: STORE_EXPIRY.getTime(),
      }),
    );

    // Then
    // 7일 - 1일 21시간 = 5일 3시간, 다시 1일 9시간을 써서 3일 18시간(표시 4일)
    const remainder = (await grantsOf()).find((grant) => grant.status === "BANKED");
    expect(remainder).toMatchObject({ durationDays: 4, durationMs: 3 * DAY_MS + 18 * 3_600_000 });
    expect(await premiumAccess()).toMatchObject({
      source: "STORE",
      bankedDays: 4,
      endsAt: new Date(
        STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS + 3 * DAY_MS + 18 * 3_600_000,
      ),
    });
  });

  it("행이 지워진 체인의 RENEWAL은 payload로 체인 행을 만들어 복원한 사용자를 프리미엄으로 이어 간다", async () => {
    // Given
    // 탈퇴(hard delete)로 행이 함께 지워져 TRANSFER로 옮길 행이 없다
    const nextExpiry = new Date(STORE_EXPIRY.getTime() + 30 * DAY_MS);
    vi.setSystemTime(STORE_EXPIRY);

    // When
    await webhook(
      createSubscriptionEventFixture("RENEWAL", {
        app_user_id: userId,
        original_transaction_id: CHAIN,
        transaction_id: `${CHAIN}-r2`,
        id: "adopt-renewal",
        purchased_at_ms: STORE_EXPIRY.getTime(),
        expiration_at_ms: nextExpiry.getTime(),
        environment: "SANDBOX",
      }),
    );

    // Then
    expect(
      await client.query.subscription.findFirst({
        columns: {
          userId: true,
          status: true,
          expiresAt: true,
          environment: true,
          productId: true,
        },
        where: { storeSubscriptionId: CHAIN },
      }),
    ).toEqual({
      userId,
      status: "ACTIVE",
      expiresAt: instantFromDate(nextExpiry),
      environment: "SANDBOX",
      productId: "premium_monthly",
    });
    expect(await userProjection()).toEqual({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: nextExpiry,
    });
    expect(await isPremium()).toBe(true);
  });

  it("만료 시각 없는 UNCANCELLATION은 저장된 만료 시각을 유지해 유료 기간 중에 쌓아 둔 보상을 시작하지 않는다", async () => {
    // Given
    await webhook(storeEvent(createSubscriptionEventFixture("INITIAL_PURCHASE"), "u-purchase"));
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "u:invite",
      durationDays: 7,
    });
    vi.setSystemTime(new Date("2028-03-01T04:00:00.000Z"));
    await webhook(storeEvent(createSubscriptionEventFixture("CANCELLATION"), "u-cancel"));
    const uncancelledAt = new Date("2028-03-02T04:00:00.000Z");
    vi.setSystemTime(uncancelledAt);

    // When
    await webhook(
      createSubscriptionEventFixture("UNCANCELLATION", {
        app_user_id: userId,
        original_transaction_id: CHAIN,
        transaction_id: CHAIN,
        id: "u-uncancel",
        expiration_at_ms: undefined,
      }),
    );
    const grantsAfterUncancel = await grantsOf();

    // Then
    expect(grantsAfterUncancel[0]).toMatchObject({ status: "BANKED", startsAt: null });
    expect(await premiumAccess()).toMatchObject({
      source: "STORE",
      periodEndsAt: STORE_EXPIRY,
      willRenew: true,
      bankedDays: 7,
    });
  });

  it("결제 유예가 끝난 직후 sweep·만료 웹훅 전이라도 /me 프로필 캐시가 유예 끝에서 만료돼 무료가 된다", async () => {
    // Given
    // 결제 유예 중 /me를 캐시해 둔다
    await webhook(storeEvent(createSubscriptionEventFixture("INITIAL_PURCHASE"), "m-purchase"));
    const graceEndsAt = new Date(STORE_EXPIRY.getTime() + 16 * DAY_MS);
    vi.setSystemTime(STORE_EXPIRY);
    await webhook(billingIssue("m-billing", graceEndsAt));
    await webhook(billingErrorCancellation("m-billing-cancel"));
    const getMe = context.module.get(GetCurrentUserUseCase);
    const input = { userId, sessionId: "qa-session", timezone: "Asia/Seoul" };
    vi.setSystemTime(new Date(graceEndsAt.getTime() - 60_000));
    const beforeEnd = await getMe.execute(input);

    // When
    vi.setSystemTime(new Date(graceEndsAt.getTime() + 1));
    const afterEnd = await getMe.execute(input);

    // Then
    expect({ source: beforeEnd.premiumSource, isPremium: beforeEnd.isPremium }).toEqual({
      source: "STORE",
      isPremium: true,
    });
    expect({ source: afterEnd.premiumSource, isPremium: afterEnd.isPremium }).toEqual({
      source: null,
      isPremium: false,
    });
  });

  it("보상이 끝난 직후 sweep 전이라도 /me 프로필 캐시가 경계에서 만료돼 source와 isPremium이 함께 무료가 된다", async () => {
    // Given
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "c:invite",
      durationDays: 7,
    });
    const endsAt = new Date(AT.getTime() + 7 * DAY_MS);
    const getMe = context.module.get(GetCurrentUserUseCase);
    const input = { userId, sessionId: "qa-session", timezone: "Asia/Seoul" };
    vi.setSystemTime(new Date(endsAt.getTime() - 60_000));
    await getMe.execute(input);

    // When
    vi.setSystemTime(new Date(endsAt.getTime() + 60_000));
    const afterEnd = await getMe.execute(input);
    await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(new Date()) });
    const fresh = await getMe.execute(input);

    // Then
    expect({ source: afterEnd.premiumSource, isPremium: afterEnd.isPremium }).toEqual({
      source: null,
      isPremium: false,
    });
    expect({ source: fresh.premiumSource, isPremium: fresh.isPremium }).toEqual({
      source: null,
      isPremium: false,
    });
  });

  it("월간에서 연간으로 바꾸면 상품 변경 안내는 기간을 두고, 연간 갱신이 만료만 늘리며 쌓아 둔 보상은 유지된다", async () => {
    // Given
    await webhook(storeEvent(createSubscriptionEventFixture("INITIAL_PURCHASE"), "p-purchase"));
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "p:invite",
      durationDays: 7,
    });
    const annualExpiry = new Date("2029-03-10T04:00:00.000Z");

    // When
    await webhook(
      storeEvent(
        createSubscriptionEventFixture("PRODUCT_CHANGE", { new_product_id: "premium_annual" }),
        "p-change",
      ),
    );
    const afterChange = await premiumAccess();
    await webhook(
      createSubscriptionEventFixture("RENEWAL", {
        app_user_id: userId,
        original_transaction_id: CHAIN,
        transaction_id: `${CHAIN}-annual`,
        product_id: "premium_annual",
        id: "p-renew-annual",
        expiration_at_ms: annualExpiry.getTime(),
      }),
    );

    // Then
    expect(afterChange).toMatchObject({ periodEndsAt: STORE_EXPIRY, bankedDays: 7 });
    expect(await premiumAccess()).toMatchObject({
      source: "STORE",
      periodEndsAt: annualExpiry,
      bankedDays: 7,
    });
    expect((await grantsOf())[0]).toMatchObject({ status: "BANKED" });
  });
});
