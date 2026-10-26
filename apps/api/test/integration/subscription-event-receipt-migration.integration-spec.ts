import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import postgres from "@prisma/orm-postgres/runtime";
import { contractFromJson } from "@prisma/orm-postgres/static";
import { omit } from "es-toolkit";
import { Pool } from "pg";

import { encodeCreate, encodePatch } from "#api/platform/database/database-records";
import {
  USER_FIELDS_ADDED_AFTER_PREVIOUS_CONTRACTS,
  UserFixture,
} from "#test/fixtures/user.fixture";
import { createTestClient } from "#test/setup/database-context";
import { withTextTimestampGenerators } from "#test/setup/historical-contract";
import { startManagedTestDatabase } from "#test/setup/managed-test-database";

import type { Contract as PreviousContract } from "../../prisma/migrations8/snapshots/242a04c5aa8a763586e1bd3c57ffe283b32afea882c1ac530e7c01fd8fcdf970/contract.d.js";
import previousContractJson from "../../prisma/migrations8/snapshots/242a04c5aa8a763586e1bd3c57ffe283b32afea882c1ac530e7c01fd8fcdf970/contract.json" with { type: "json" };

const previousContract = contractFromJson<PreviousContract>(
  withTextTimestampGenerators(previousContractJson),
);
const PREVIOUS_CONTRACT = "242a04c5aa8a763586e1bd3c57ffe283b32afea882c1ac530e7c01fd8fcdf970";
const at = new Date("2026-10-07T12:00:00.000Z");
const expiry = new Date("2026-11-07T12:00:00.000Z");

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

describe("구독 처리 원장 additive migration (실제 PostgreSQL)", () => {
  it("직전 계약의 기존 데이터를 보존하고 새 원장이 있어도 직전 ORM 읽기·쓰기가 작동한다", async () => {
    // Given
    const database = await startManagedTestDatabase({
      env: { ...process.env },
      migrate: (url) => migrate(url, PREVIOUS_CONTRACT),
    });
    const previousPool = new Pool({ connectionString: database.connectionUri, max: 2 });
    const previous = postgres({
      contract: previousContract,
      pg: previousPool,
    });
    const current = createTestClient(database.connectionUri);
    try {
      const user = UserFixture.create({
        subscriptionStatus: "ACTIVE",
        subscriptionExpiresAt: expiry,
        createdAt: at,
        updatedAt: at,
      });
      await previous.orm.public.User.create(
        encodeCreate("User", omit(user, USER_FIELDS_ADDED_AFTER_PREVIOUS_CONTRACTS)),
      );
      const subscription = await previous.orm.public.Subscription.create(
        encodeCreate("Subscription", {
          userId: user.id,
          revenueCatId: "pre-migration-transaction",
          productId: "premium_monthly",
          status: "ACTIVE",
          startedAt: at,
          expiresAt: expiry,
          lastProcessedEventId: "pre-migration-last-event",
          createdAt: at,
          updatedAt: at,
        }),
      );

      // When
      migrate(database.connectionUri);
      const afterMigration = await previous.orm.public.Subscription.where((row) =>
        row.id.eq(subscription.id),
      ).first();
      const inserted = await current.orm.public.SubscriptionEventReceipt.createAndCount(
        [
          encodeCreate("SubscriptionEventReceipt", {
            provider: "REVENUECAT",
            eventId: "post-migration-event",
            eventType: "RENEWAL",
            processedAt: at,
          }),
        ],
        { onConflict: "skip", conflictOn: ["provider", "eventId"] },
      );
      await previous.orm.public.Subscription.where((row) => row.id.eq(subscription.id)).update(
        encodePatch("Subscription", { productId: "legacy-runtime-product" }),
      );
      const previousUser = await previous.orm.public.User.where((row) =>
        row.id.eq(user.id),
      ).first();
      const currentSubscription = await current.orm.public.Subscription.where((row) =>
        row.id.eq(subscription.id),
      ).first();

      // Then
      expect(afterMigration).toEqual(subscription);
      expect(inserted).toBe(1);
      expect(previousUser?.subscriptionStatus).toBe("ACTIVE");
      expect(previousUser?.subscriptionExpiresAt).toBe(subscription.expiresAt);
      expect(currentSubscription).toMatchObject({
        productId: "legacy-runtime-product",
        status: "ACTIVE",
        lastProcessedEventId: "pre-migration-last-event",
        expiresAt: subscription.expiresAt,
      });
    } finally {
      await current.close();
      await previous.close();
      await previousPool.end();
      await database.stop();
    }
  }, 60_000);
});
