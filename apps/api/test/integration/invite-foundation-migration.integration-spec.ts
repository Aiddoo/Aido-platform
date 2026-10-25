import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import postgres from "@prisma/orm-postgres/runtime";
import { contractFromJson } from "@prisma/orm-postgres/static";
import { Pool } from "pg";

import { encodeCreate } from "#api/platform/database/database-records";
import { createEntityId } from "#api/platform/database/database-values";
import { isUniqueConstraintViolation } from "#api/platform/database/prisma-error.util";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createTestClient } from "#test/setup/database-context";
import { withTextTimestampGenerators } from "#test/setup/historical-contract";
import { startManagedTestDatabase } from "#test/setup/managed-test-database";

import type { Contract as PreviousContract } from "../../prisma/migrations8/snapshots/65d810f74acf51dc46d4ffa10564516809ad487555fff459995e1dee14e7695a/contract.d.js";
import previousContractJson from "../../prisma/migrations8/snapshots/65d810f74acf51dc46d4ffa10564516809ad487555fff459995e1dee14e7695a/contract.json" with { type: "json" };

const previousContract = contractFromJson<PreviousContract>(
  withTextTimestampGenerators(previousContractJson),
);
const PREVIOUS_CONTRACT = "65d810f74acf51dc46d4ffa10564516809ad487555fff459995e1dee14e7695a";

function prisma(connectionUri: string, args: readonly string[]): void {
  execFileSync("pnpm", ["exec", "prisma", ...args, "--format", "human"], {
    cwd: resolve(import.meta.dirname, "../.."),
    env: { ...process.env, DATABASE_URL: connectionUri },
    stdio: "pipe",
    maxBuffer: 16 * 1024 * 1024,
  });
}

describe("invite_foundation additive migration (실제 PostgreSQL)", () => {
  it("직전 계약의 데이터와 ORM 쓰기를 유지하고 새 테이블 제약과 알림 enum을 추가한다", async () => {
    // Given
    const database = await startManagedTestDatabase({
      env: { ...process.env },
      migrate: (url) => prisma(url, ["db", "migrate", "--to", PREVIOUS_CONTRACT]),
    });
    const previousPool = new Pool({ connectionString: database.connectionUri, max: 2 });
    const previous = postgres({ contract: previousContract, pg: previousPool });
    const current = createTestClient(database.connectionUri);
    try {
      const inviter = UserFixture.create({ id: createEntityId(), userTag: "MIGRATE1" });
      const invitee = UserFixture.create({ id: createEntityId(), userTag: "MIGRATE2" });
      await previous.orm.public.User.create(encodeCreate("User", inviter));

      // When
      prisma(database.connectionUri, ["db", "migrate"]);
      prisma(database.connectionUri, ["db", "verify"]);
      await previous.orm.public.User.create(encodeCreate("User", invitee));
      const invite = await current.orm.public.Invite.create(
        encodeCreate("Invite", { inviterId: inviter.id, code: "K7M2QX", status: "ACTIVE" }),
      );
      const duplicateCode = await current.orm.public.Invite.create(
        encodeCreate("Invite", { inviterId: invitee.id, code: "K7M2QX", status: "REVOKED" }),
      ).then(
        () => null,
        (error: unknown) => error,
      );
      const notification = await current.orm.public.Notification.create(
        encodeCreate("Notification", {
          userId: inviter.id,
          type: "INVITE_JOINED",
          title: "친구가 초대를 수락했어",
          body: "함께 시작해 보자",
        }),
      );

      // Then
      expect(isUniqueConstraintViolation(duplicateCode)).toBe(true);
      expect(invite.code).toBe("K7M2QX");
      expect(notification._type).toBe("INVITE_JOINED");
      expect(
        await previous.orm.public.User.where((row) => row.id.eq(invitee.id))
          .select("userTag")
          .first(),
      ).toEqual({ userTag: "MIGRATE2" });
    } finally {
      await previous.close();
      await previousPool.end();
      await current.close();
      await database.stop();
    }
  }, 120_000);
});
