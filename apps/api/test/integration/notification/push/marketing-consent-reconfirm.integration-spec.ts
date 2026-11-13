import { and, eq, sql } from "drizzle-orm";

import { MarketingConsentReconfirmPort } from "#api/modules/notification/push/application/ports/marketing-consent-reconfirm.port";
import { ReconfirmMarketingConsentsUseCase } from "#api/modules/notification/push/application/use-cases/reconfirm-marketing-consents.use-case";
import {
  notification,
  user as userTable,
  userConsent,
  userPreference,
} from "#api/platform/database/schema/index";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { UserConsentBuilder, UserPreferenceBuilder } from "#test/builders/index";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const now = Temporal.Instant.from("2026-12-01T02:00:00.000Z");
const cutoff = Temporal.Instant.from("2024-12-01T02:00:00.000Z");

describe("광고성 수신 동의 2년 재확인 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let reconfirm: ReconfirmMarketingConsentsUseCase;
  let access: MarketingConsentReconfirmPort;
  let unitOfWork: UnitOfWorkPort;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 5 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    reconfirm = context.module.get(ReconfirmMarketingConsentsUseCase);
    access = context.module.get(MarketingConsentReconfirmPort);
    unitOfWork = context.module.get(UnitOfWorkPort);
  });

  beforeEach(async () => {
    await context.reset();
  });

  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  async function givenUser(
    tag: string,
    consent: Partial<typeof userConsent.$inferInsert>,
    overrides: Partial<ReturnType<typeof UserFixture.create>> = {},
  ): Promise<string> {
    const user = UserFixture.create({
      id: createEntityId(),
      email: `reconfirm-${tag.toLowerCase()}@example.com`,
      userTag: tag,
      status: "ACTIVE",
      ...overrides,
    });
    await client.insert(userTable).values(user);
    await client
      .insert(userPreference)
      .values(UserPreferenceBuilder.create(user.id).withTimezone("Asia/Seoul").build());
    await client
      .insert(userConsent)
      .values({ ...UserConsentBuilder.create(user.id).build(), ...consent });
    return user.id;
  }

  async function reconfirmNotices(userId: string) {
    return client
      .select({ title: notification.title, body: notification.body })
      .from(notification)
      .where(and(eq(notification.userId, userId), eq(notification.type, "SYSTEM_NOTICE")));
  }

  it("동의한 지 2년이 지난 사용자에게만 한 번 알리고 재확인 시각을 남긴다", async () => {
    // Given
    const due = await givenUser("RECONF01", {
      marketingPushAgreedAt: Temporal.Instant.from("2024-11-08T16:00:00.000Z"),
    });
    const recent = await givenUser("RECONF02", {
      marketingAgreedAt: Temporal.Instant.from("2025-06-01T00:00:00.000Z"),
    });
    const reconfirmedLastYear = await givenUser("RECONF03", {
      marketingAgreedAt: Temporal.Instant.from("2023-01-01T00:00:00.000Z"),
      marketingReconfirmedAt: Temporal.Instant.from("2025-12-01T00:00:00.000Z"),
    });
    const withdrawn = await givenUser("RECONF04", {});
    const deleted = await givenUser(
      "RECONF05",
      { marketingAgreedAt: Temporal.Instant.from("2023-01-01T00:00:00.000Z") },
      { deletedAt: Temporal.Instant.from("2026-11-01T00:00:00.000Z") },
    );

    // When
    const first = await reconfirm.execute({ now });
    const second = await reconfirm.execute({ now });

    // Then
    expect(first.notifiedCount).toBe(1);
    expect(second.notifiedCount).toBe(0);
    expect(await reconfirmNotices(due)).toEqual([
      {
        title: "광고성 알림 수신에 동의 중이에요",
        body: "2024.11.09 동의 · 설정에서 바꿀 수 있어요",
      },
    ]);
    for (const userId of [recent, reconfirmedLastYear, withdrawn, deleted]) {
      expect(await reconfirmNotices(userId)).toEqual([]);
    }
    expect(
      (
        await client.query.userConsent.findFirst({
          columns: { marketingReconfirmedAt: true },
          where: { userId: due },
        })
      )?.marketingReconfirmedAt,
    ).toEqual(now);
  });

  it("마지막 재확인에서 2년이 지나면 다시 알린다", async () => {
    // Given
    const userId = await givenUser("RECONF06", {
      marketingAgreedAt: Temporal.Instant.from("2020-01-01T00:00:00.000Z"),
      marketingReconfirmedAt: Temporal.Instant.from("2024-11-30T00:00:00.000Z"),
    });

    // When
    const result = await reconfirm.execute({ now });

    // Then
    expect(result.notifiedCount).toBe(1);
    expect((await reconfirmNotices(userId))[0]?.body).toBe(
      "2020.01.01 동의 · 설정에서 바꿀 수 있어요",
    );
  });

  it("10:00 KST가 현지 야간인 사용자는 남겨 두었다가 현지 낮의 매시 실행에서 알린다", async () => {
    // Given: 런던은 10:00 KST(01:00Z)에 01:00, 19:00 KST(10:00Z)에 10:00이다
    const userId = await givenUser("RECONF08", {
      marketingAgreedAt: Temporal.Instant.from("2023-01-01T00:00:00.000Z"),
    });
    await client
      .update(userPreference)
      .set({ timezone: "Europe/London" })
      .where(eq(userPreference.userId, userId));

    // When
    const atTenKst = await reconfirm.execute({
      now: Temporal.Instant.from("2026-12-01T01:00:00.000Z"),
    });
    const atLondonMorning = await reconfirm.execute({
      now: Temporal.Instant.from("2026-12-01T10:00:00.000Z"),
    });

    // Then
    expect(atTenKst.notifiedCount).toBe(0);
    expect(atLondonMorning.notifiedCount).toBe(1);
    expect(await reconfirmNotices(userId)).toHaveLength(1);
  });

  it("두 실행이 같은 사용자를 동시에 표시하면 행 잠금 뒤 한 실행만 얻는다", async () => {
    // Given
    const userId = await givenUser("RECONF07", {
      marketingAgreedAt: Temporal.Instant.from("2023-01-01T00:00:00.000Z"),
    });
    const firstClaimed = Promise.withResolvers<void>();
    const releaseFirst = Promise.withResolvers<void>();

    // When
    const first = unitOfWork.run(async () => {
      const claimed = await access.claimMarketingReconfirm([UserId.reconstitute(userId)], {
        cutoff,
        at: now,
      });
      firstClaimed.resolve();
      await releaseFirst.promise;
      return claimed;
    });
    await firstClaimed.promise;
    const second = unitOfWork.run(() =>
      access.claimMarketingReconfirm([UserId.reconstitute(userId)], { cutoff, at: now }),
    );
    try {
      await vi.waitFor(
        async () => {
          const waiting = await client.execute<{ count: number }>(sql`
            SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query ILIKE '%update "UserConsent"%marketingReconfirmedAt%'
          `);
          expect(waiting.rows[0]?.count).toBe(1);
        },
        { timeout: 10_000 },
      );
    } finally {
      releaseFirst.resolve();
    }

    // Then
    expect((await first).map((target) => target.userId)).toEqual([userId]);
    expect(await second).toEqual([]);
  });
});
