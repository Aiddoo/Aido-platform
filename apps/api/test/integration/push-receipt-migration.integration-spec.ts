import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import postgres from "@prisma/orm-postgres/runtime";
import { Pool } from "pg";

import { encodeCreate, encodePatch, decodeRecord } from "#api/platform/database/database-records";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createTestClient } from "#test/setup/database-context";
import { startManagedTestDatabase } from "#test/setup/managed-test-database";

import type { Contract as PreviousContract } from "../../prisma/migrations8/snapshots/d80a48c1b4fd73b119fb619b70af00372376bc8a129c34649ae5dea44df733cf/contract.d.js";
import previousContractJson from "../../prisma/migrations8/snapshots/d80a48c1b4fd73b119fb619b70af00372376bc8a129c34649ae5dea44df733cf/contract.json" with { type: "json" };

const PREVIOUS_CONTRACT = "d80a48c1b4fd73b119fb619b70af00372376bc8a129c34649ae5dea44df733cf";

function migrate(connectionUri: string, target?: string): void {
  execFileSync(
    "pnpm",
    [
      "exec",
      "prisma",
      "db",
      "migrate",
      ...(target === undefined ? [] : ["--to", target]),
      "--format",
      "human",
    ],
    {
      cwd: resolve(import.meta.dirname, "../.."),
      env: { ...process.env, DATABASE_URL: connectionUri },
      stdio: "pipe",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
}

describe("receipt token fingerprint additive migration (실제 PostgreSQL)", () => {
  it("이전 receipt를 보존하며 새 컬럼이 있어도 직전 ORM의 token·receipt 읽기와 쓰기가 작동한다", async () => {
    // Given: 직전 계약 DB에 실제 token과 accepted receipt가 저장돼 있다.
    const database = await startManagedTestDatabase({
      env: { ...process.env },
      migrate: (url) => migrate(url, PREVIOUS_CONTRACT),
    });
    const previousPool = new Pool({ connectionString: database.connectionUri, max: 2 });
    const previous = postgres<PreviousContract>({
      contractJson: previousContractJson,
      pg: previousPool,
    });
    const current = createTestClient(database.connectionUri);
    try {
      const user = UserFixture.create();
      await previous.orm.public.User.create(encodeCreate("User", user));
      const token = await previous.orm.public.PushToken.create(
        encodeCreate("PushToken", {
          userId: user.id,
          token: "ExponentPushToken[migration-old]",
          deviceId: "migration-device",
          platform: "IOS",
        }),
      );
      const notification = await previous.orm.public.Notification.create(
        encodeCreate("Notification", {
          userId: user.id,
          type: "SYSTEM_NOTICE",
          title: "기존 알림",
          body: "기존 본문",
        }),
      );
      const dispatch = await previous.orm.public.PushDispatch.create(
        encodeCreate("PushDispatch", {
          notificationId: notification.id,
          userId: user.id,
          purpose: "TRANSACTIONAL",
          status: "SENT",
        }),
      );
      const attempt = await previous.orm.public.PushDeliveryAttempt.create(
        encodeCreate("PushDeliveryAttempt", {
          dispatchId: dispatch.id,
          pushTokenId: token.id,
          status: "TICKET_ACCEPTED",
          expoTicketId: "migration-existing-ticket",
        }),
      );

      // When: additive graph를 적용하고 직전 runtime의 쓰기를 계속 사용한다.
      migrate(database.connectionUri);
      const oldRead = await previous.orm.public.PushDeliveryAttempt.where((row) =>
        row.id.eq(attempt.id),
      ).first();
      const added = decodeRecord(
        "PushDeliveryAttempt",
        requireRecord(
          await current.orm.public.PushDeliveryAttempt.where((row) =>
            row.id.eq(attempt.id),
          ).first(),
        ),
      );
      await previous.orm.public.PushToken.where((row) => row.id.eq(token.id)).update(
        encodePatch("PushToken", { token: "ExponentPushToken[migration-new]" }),
      );
      await previous.orm.public.PushDeliveryAttempt.where((row) => row.id.eq(attempt.id)).update(
        encodePatch("PushDeliveryAttempt", { status: "DELIVERED" }),
      );
      const after = decodeRecord(
        "PushDeliveryAttempt",
        requireRecord(
          await current.orm.public.PushDeliveryAttempt.where((row) =>
            row.id.eq(attempt.id),
          ).first(),
        ),
      );
      const currentToken = decodeRecord(
        "PushToken",
        requireRecord(
          await current.orm.public.PushToken.where((row) => row.id.eq(token.id)).first(),
        ),
      );
      migrate(database.connectionUri);

      // Then: 기존 데이터와 nullable 이력을 보존하고 rollback용 직전 runtime도 동작한다.
      expect(oldRead).toEqual(attempt);
      expect(added).toMatchObject({
        id: attempt.id,
        dispatchId: dispatch.id,
        pushTokenId: token.id,
        expoTicketId: "migration-existing-ticket",
        status: "TICKET_ACCEPTED",
        tokenFingerprint: null,
      });
      expect(after).toMatchObject({ status: "DELIVERED", tokenFingerprint: null });
      expect(currentToken).toMatchObject({
        id: token.id,
        token: "ExponentPushToken[migration-new]",
        isActive: true,
      });
    } finally {
      await current.close();
      await previous.close();
      await previousPool.end();
      await database.stop();
    }
  }, 60_000);
});
