import { and } from "@prisma/orm-postgres/orm-client";

import { databaseTimestamp } from "#api/platform/database/database-values";
import { DatabaseRecordNotFoundError } from "#api/platform/database/prisma-error.util";
import {
  assertNativeWhere,
  createMockTransactionHost,
  databaseWriteExpectation,
} from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { PrismaAiQuotaRepository } from "./prisma-ai-quota.repository.js";

const at = new Date("2026-09-30T15:00:01.000Z");

describe("AI quota 저장소 — literal 갱신과 period 조건", () => {
  let database: MockDatabaseContext;
  let repository: PrismaAiQuotaRepository;

  beforeEach(() => {
    database = createMockDatabaseContext();
    repository = new PrismaAiQuotaRepository(createMockTransactionHost(database));
  });

  it("사용자가 사라졌으면 사용량 저장의 기존 저장소 부재 오류를 반환한다", async () => {
    // Given
    database.orm.public.User.updateAndCount.mockResolvedValue(0);
    // When / Then
    await expect(
      repository.saveUsage("missing-user", { count: 1, resetAt: at }),
    ).rejects.toBeInstanceOf(DatabaseRecordNotFoundError);
  });

  it.each([0, 1])("조건부 보상 갱신의 실제 변경 수 %s를 boolean으로 변환한다", async (updated) => {
    // Given
    database.orm.public.User.updateAndCount.mockResolvedValue(updated);
    // When
    const released = await repository.releaseUsage("user-1", { count: 0, expectedResetAt: at });
    // Then
    expect(released).toBe(updated === 1);
    assertNativeWhere("User", database.orm.public.User.where.mock.calls[0]?.[0], (row) =>
      and(
        row.id.eq("user-1"),
        row.aiUsageResetAt.eq(databaseTimestamp(at)),
        row.aiUsageCount.gt(0),
      ),
    );
    expect(database.orm.public.User.updateAndCount).toHaveBeenCalledWith(
      databaseWriteExpectation("User", { aiUsageCount: 0 }),
    );
  });
});
