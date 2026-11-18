import { ClsPluginTransactional, TransactionHost } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import { ClsModule } from "nestjs-cls";

import { ClsUnitOfWork } from "#api/platform/database/cls-unit-of-work";
import { DRIZZLE, type DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { user } from "#api/platform/database/schema/index";
import { createTestClient } from "#test/setup/database-context";
import { assertManagedTestDatabaseEnvironment } from "#test/setup/managed-test-database";

@Module({})
class DrizzleTestModule {}

it("중첩 UoW는 같은 트랜잭션을 공유하고 커밋 후 작업은 커밋 뒤에만 실행하며 실패하면 롤백한다", async () => {
  // Given
  const { connectionUri } = assertManagedTestDatabaseEnvironment(process.env);
  const client = createTestClient(connectionUri);
  const databaseModule = {
    module: DrizzleTestModule,
    providers: [{ provide: DRIZZLE, useValue: client }],
    exports: [DRIZZLE],
  };
  const module = await Test.createTestingModule({
    imports: [
      databaseModule,
      ClsModule.forRoot({
        global: true,
        plugins: [
          new ClsPluginTransactional({
            imports: [databaseModule],
            adapter: new TransactionalAdapterDrizzleOrm({ drizzleInstanceToken: DRIZZLE }),
          }),
        ],
      }),
    ],
    providers: [ClsUnitOfWork],
  }).compile();
  await module.init();
  const transactionHost = module.get<TransactionHost<DrizzleTransactionalAdapter>>(TransactionHost);
  const uow = module.get(ClsUnitOfWork);
  const committedId = "cdrizzlecommit00000000001";
  const rollbackId = "cdrizzlerollback000000001";
  const tasks: string[] = [];
  try {
    // When
    await uow.run(async () => {
      await transactionHost.tx.insert(user).values({
        id: committedId,
        email: "drizzle-commit@test.aido.app",
        userTag: "DRIZZLC1",
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      });
      const changed = await transactionHost.tx
        .update(user)
        .set({ aiUsageCount: 1 })
        .where(eq(user.id, committedId))
        .returning({ id: user.id });
      expect(changed).toHaveLength(1);
      const counts = await transactionHost.tx
        .select({ count: user.aiUsageCount })
        .from(user)
        .where(eq(user.id, committedId));
      expect(counts).toEqual([{ count: 1 }]);
      uow.register(async () => {
        expect(await client.query.user.findFirst({ where: { id: committedId } })).toBeDefined();
        tasks.push("root");
      });
      const rootTransaction = transactionHost.tx;
      await uow.run(async () => {
        expect(transactionHost.tx).toBe(rootTransaction);
        const found = await transactionHost.tx.query.user.findFirst({ where: { id: committedId } });
        expect(found?.email).toBe("drizzle-commit@test.aido.app");
        uow.register(async () => {
          tasks.push("nested");
        });
      });
      expect(tasks).toEqual([]);
    });

    // Then
    expect(tasks).toEqual(["root", "nested"]);

    // When
    const result = uow.run(async () => {
      await transactionHost.tx.insert(user).values({
        id: rollbackId,
        email: "drizzle-rollback@test.aido.app",
        userTag: "DRIZZLR1",
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      });
      await transactionHost.tx
        .update(user)
        .set({ aiUsageCount: 3 })
        .where(eq(user.id, committedId));
      uow.register(async () => {
        tasks.push("rolled-back");
      });
      throw new Error("rollback");
    });

    // Then
    await expect(result).rejects.toThrow("rollback");
    expect(await client.query.user.findFirst({ where: { id: rollbackId } })).toBeUndefined();
    expect((await client.query.user.findFirst({ where: { id: committedId } }))?.aiUsageCount).toBe(
      1,
    );
    expect(tasks).toEqual(["root", "nested"]);
  } finally {
    await client.delete(user).where(eq(user.id, committedId));
    await module.close();
    await client.close();
  }
});
