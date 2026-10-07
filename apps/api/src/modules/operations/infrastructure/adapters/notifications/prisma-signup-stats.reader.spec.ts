import { assertNativeWhere } from "#test/mocks/database.mock";
import { asMock, createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";
import { createMockDatabaseService } from "#test/mocks/mock-database.factory";

import { PrismaSignupStatsReader } from "./prisma-signup-stats.reader.js";

describe("PrismaSignupStatsReader", () => {
  let reader: PrismaSignupStatsReader;
  let db: MockDatabaseContext;

  beforeEach(async () => {
    db = createMockDatabaseContext();
    reader = new PrismaSignupStatsReader(createMockDatabaseService(db));
  });

  it("총 가입자는 인증 계정이 있는 사용자만 세어 시스템 FK 사용자를 제외한다", async () => {
    asMock(db.orm.public.Account.groupBy("provider").aggregate).mockResolvedValue([]);
    asMock(db.orm.public.User.aggregate).mockResolvedValue({ count: 12 });

    await expect(
      reader.getSignupStats(
        new Date("2026-08-25T15:00:00.000Z"),
        new Date("2026-08-26T15:00:00.000Z"),
      ),
    ).resolves.toMatchObject({ totalUsers: 12 });
    assertNativeWhere("User", db.orm.public.User.where.mock.calls.at(-1)?.[0], (row) =>
      row.accounts.some(),
    );
  });
});
