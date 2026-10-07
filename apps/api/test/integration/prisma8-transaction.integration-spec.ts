import { ClsPluginTransactional, TransactionHost } from "@nestjs-cls/transactional";
import { Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ClsModule } from "nestjs-cls";
import { Pool } from "pg";

import { ClsUnitOfWork } from "#api/shared/infrastructure/database/cls-unit-of-work";
import { varchar } from "#api/shared/infrastructure/database/database-values";
import { DatabaseService } from "#api/shared/infrastructure/database/database.service";
import { PostgresPool } from "#api/shared/infrastructure/database/postgres-pool";
import { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";
import { assertManagedTestDatabaseEnvironment } from "#test/setup/managed-test-database";

@Module({})
class Prisma8TestModule {}

it("native Prisma 8 쓰기·CLS Required 전파·commit 후 작업과 rollback을 보존한다", async () => {
  const { connectionUri } = assertManagedTestDatabaseEnvironment(process.env);
  const pool = new Pool({ connectionString: connectionUri });
  const databaseModule = {
    module: Prisma8TestModule,
    providers: [{ provide: PostgresPool, useValue: { pool } }, DatabaseService],
    exports: [DatabaseService],
  };
  const module = await Test.createTestingModule({
    imports: [
      databaseModule,
      ClsModule.forRoot({
        global: true,
        plugins: [
          new ClsPluginTransactional({
            imports: [databaseModule],
            adapter: new Prisma8TransactionalAdapter(),
          }),
        ],
      }),
    ],
    providers: [ClsUnitOfWork],
  }).compile();
  await module.init();
  const client = module.get(DatabaseService);
  const txHost = module.get<TransactionHost<Prisma8TransactionalAdapter>>(TransactionHost);
  const uow = module.get(ClsUnitOfWork);
  const committedId = "cprisma8commit000000000001";
  const rollbackId = "cprisma8rollback0000000001";
  const tasks: string[] = [];
  try {
    await uow.run(async () => {
      await txHost.tx.orm.public.User.create({
        id: committedId,
        email: varchar("native8-commit@test.aido.app", 255),
        userTag: varchar("NATIVEC1", 8),
      });
      const changed = await txHost.tx.execute(
        txHost.tx.raw.sql`
    UPDATE public."User" SET "aiUsageCount" = ${1} WHERE "id" = ${committedId}
   `
          .affectedCount()
          .build(),
      );
      expect(changed.affectedRows).toBe(1);
      const counts = await txHost.tx.query(
        txHost.tx.raw.sql`
    SELECT "aiUsageCount" AS count FROM public."User" WHERE "id" = ${committedId}
   `
          .returnsRow({ count: "pg/int4@1" })
          .build(),
      );
      expect(counts).toEqual([{ count: 1 }]);
      uow.register(async () => {
        expect(await client.db.orm.public.User.where({ id: committedId }).first()).not.toBeNull();
        tasks.push("root");
      });
      const rootTx = txHost.tx;
      await uow.run(async () => {
        expect(txHost.tx).toBe(rootTx);
        const user = await txHost.tx.orm.public.User.where({ id: committedId }).first();
        expect(user?.email).toBe("native8-commit@test.aido.app");
        uow.register(async () => {
          tasks.push("nested");
        });
      });
      expect(tasks).toEqual([]);
    });
    expect(tasks).toEqual(["root", "nested"]);
    await expect(
      uow.run(async () => {
        await txHost.tx.orm.public.User.create({
          id: rollbackId,
          email: varchar("native8-rollback@test.aido.app", 255),
          userTag: varchar("NATIVER1", 8),
        });
        await txHost.tx.execute(
          txHost.tx.raw.sql`
    UPDATE public."User" SET "aiUsageCount" = ${3} WHERE "id" = ${committedId}
   `
            .affectedCount()
            .build(),
        );
        uow.register(async () => {
          tasks.push("rolled-back");
        });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await client.db.orm.public.User.where({ id: rollbackId }).first()).toBeNull();
    expect((await client.db.orm.public.User.where({ id: committedId }).first())?.aiUsageCount).toBe(
      1,
    );
    expect(tasks).toEqual(["root", "nested"]);
  } finally {
    await client.db.orm.public.User.where({ id: committedId }).deleteAll();
    await module.close();
    await pool.end();
  }
});
