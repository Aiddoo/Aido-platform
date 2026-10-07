import { and } from "@prisma/orm-postgres/orm-client";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { CacheService } from "#api/platform/cache/cache.service";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { databaseDate, databaseTimestamp, varchar } from "#api/platform/database/database-values";
import { TEST_CUID } from "#test/fixtures/index";
import { asMock } from "#test/mocks/bull-job.mock";
import {
  assertNativeWhere,
  createMockDatabaseContext,
  nativeRows,
  type MockDatabaseContext,
} from "#test/mocks/database.mock";
import { createMockDatabaseService } from "#test/mocks/mock-database.factory";

import { PrismaSchedulerReader } from "./prisma-scheduler.reader.js";

describe("PrismaSchedulerReader — 기존 사용자 무영향 격리", () => {
  let context: MockDatabaseContext;
  beforeEach(() => {
    context = createMockDatabaseContext();
    context.orm.public.User.all.mockReturnValue(nativeRows([]));
    vi.useFakeTimers({ now: new Date("2026-07-16T00:00:00.000Z") });
  });
  afterEach(() => vi.useRealTimers());

  function reader(enabled: boolean): PrismaSchedulerReader {
    const cache = mock<CacheService>();
    cache.wrapActiveTimezones.mockImplementation((loader) => loader());
    const config = mock<TypedConfigService>();
    Object.defineProperty(config, "retentionOnboardingV2", {
      value: { enabled, treatmentPercent: 50 },
    });
    return new PrismaSchedulerReader(createMockDatabaseService(context), cache, config);
  }

  it("kill switch가 꺼지면 legacy 후보 쿼리에 조건을 전혀 추가하지 않는다", async () => {
    const createdSince = new Date("2026-07-01T00:00:00Z");
    await reader(false).findOnboardingCandidates({ tz: "Asia/Seoul", createdSince });
    assertNativeWhere("User", context.orm.public.User.where.mock.calls[0]?.[0], (row) =>
      and(
        row.createdAt.gte(databaseTimestamp(createdSince)),
        row.preference.some((preference) => preference.timezone.eq(varchar("Asia/Seoul", 50))),
      ),
    );
    expect(context.orm.public.User.select).toHaveBeenCalledWith("id", "createdAt");
  });

  it("활성화 시에도 최근 TREATMENT relation만 제외해 기존 사용자는 매칭된다", async () => {
    const createdSince = new Date("2026-07-01T00:00:00Z");
    await reader(true).findOnboardingCandidates({ tz: "Asia/Seoul", createdSince });
    assertNativeWhere("User", context.orm.public.User.where.mock.calls[0]?.[0], (row) =>
      and(
        row.retentionAssignments.none((assignment) =>
          and(
            assignment.experimentKey.eq(varchar("onboarding_v2_d7", 100)),
            assignment.variant.eq("TREATMENT"),
            assignment.startedAt.gte(databaseTimestamp(new Date("2026-07-08T00:00:00.000Z"))),
          ),
        ),
        row.createdAt.gte(databaseTimestamp(createdSince)),
        row.preference.some((preference) => preference.timezone.eq(varchar("Asia/Seoul", 50))),
      ),
    );
  });

  it("소셜 다이제스트는 직전 저녁 알림 수신 CUID만 후보로 조회한다", async () => {
    const today = new Date("2026-07-16T00:00:00.000Z");
    const tomorrow = new Date("2026-07-17T00:00:00.000Z");
    const recipientUserIds = [TEST_CUID.USER_1, TEST_CUID.USER_2];
    await reader(false).findSocialDigestCandidates({
      tz: "Asia/Seoul",
      today,
      tomorrow,
      recipientUserIds,
    });
    assertNativeWhere("User", context.orm.public.User.where.mock.calls[0]?.[0], (row) =>
      and(
        row.id.in(recipientUserIds),
        row.preference.some((preference) => preference.timezone.eq(varchar("Asia/Seoul", 50))),
        row.todos.some((todo) =>
          and(
            todo.startDate.gte(databaseDate(today)),
            todo.startDate.lt(databaseDate(tomorrow)),
            todo.completed.eq(false),
          ),
        ),
      ),
    );
  });

  it("잘못 저장된 타임존은 스케줄러 활성 타임존에서 제외한다", async () => {
    asMock(context.orm.public.UserPreference.groupBy("timezone").aggregate).mockResolvedValue([
      { timezone: varchar("Asia/Seoul", 50), count: 1 },
      { timezone: varchar("Invalid/Timezone", 50), count: 1 },
      { timezone: varchar("UTC", 50), count: 1 },
    ]);
    await expect(reader(false).findActiveTimezones()).resolves.toEqual(["Asia/Seoul", "UTC"]);
  });

  it("유효한 레거시 타임존 별칭은 저장값 그대로 반환해 기존 사용자를 누락하지 않는다", async () => {
    const timezones = ["UTC", "Etc/UTC", "Asia/Kolkata", "Asia/Calcutta"];
    asMock(context.orm.public.UserPreference.groupBy("timezone").aggregate).mockResolvedValue(
      timezones.map((timezone) => ({ timezone: varchar(timezone, 50), count: 1 })),
    );
    await expect(reader(false).findActiveTimezones()).resolves.toEqual(timezones);
  });
});
