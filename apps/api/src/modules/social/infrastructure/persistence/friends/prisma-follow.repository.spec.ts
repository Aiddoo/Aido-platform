import { and } from "@prisma/orm-postgres/orm-client";

import { varchar } from "#api/platform/database/database-values";
import { DELETED_COMMENT_AUTHOR } from "#api/shared/domain/system-user";
import {
  assertNativeWhere,
  createMockTransactionHost,
  databaseFixture,
} from "#test/mocks/database.mock";
import { asMock, createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { PrismaFollowRepository } from "./prisma-follow.repository.js";

describe("PrismaFollowRepository 사용자 대상 제한", () => {
  let repository: PrismaFollowRepository;
  let db: MockDatabaseContext;

  beforeEach(async () => {
    db = createMockDatabaseContext();
    repository = new PrismaFollowRepository(createMockTransactionHost(db));
  });

  it("ID 친구 요청은 ACTIVE이고 삭제되지 않은 사용자만 찾는다", async () => {
    asMock(db.orm.public.User.first).mockResolvedValue(databaseFixture("User", null));

    await expect(repository.userExists("locked-system-user")).resolves.toBe(false);
    assertNativeWhere("User", db.orm.public.User.where.mock.calls[0]?.[0], (row) =>
      and(row.id.eq("locked-system-user"), row.status.eq("ACTIVE"), row.deletedAt.isNull()),
    );
  });

  it("태그 친구 요청도 LOCKED·삭제 사용자를 후보에서 제외한다", async () => {
    asMock(db.orm.public.User.first).mockResolvedValue(databaseFixture("User", null));

    await expect(repository.findUserByTag(DELETED_COMMENT_AUTHOR.userTag)).resolves.toBeNull();
    assertNativeWhere("User", db.orm.public.User.where.mock.calls[0]?.[0], (row) =>
      and(
        row.userTag.eq(varchar(DELETED_COMMENT_AUTHOR.userTag, 8)),
        row.status.eq("ACTIVE"),
        row.deletedAt.isNull(),
      ),
    );
  });
});
