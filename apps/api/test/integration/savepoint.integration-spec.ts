import { ClsPluginTransactional, TransactionHost } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { Global, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { asc, eq, sql } from "drizzle-orm";
import { ClsModule } from "nestjs-cls";

import { databaseConfig } from "#api/platform/config/database.config";
import { databaseSqlState } from "#api/platform/database/database-error.util";
import { DRIZZLE, type DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { DatabaseModule } from "#api/platform/database/database.module";
import { memo, user } from "#api/platform/database/schema/index";
import {
  AfterCommitTaskRegistryPort,
  SavepointRunnerPort,
  UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase } from "#test/setup/test-database";

// DrizzleModule이 만드는 기본 pool은 DRIZZLE을 테스트 client로 덮어써 쓰이지 않는다
@Global()
@Module({
  providers: [
    {
      provide: databaseConfig.KEY,
      useValue: { url: "postgresql://unused:unused@localhost:5432/unused", poolMax: 1 },
    },
  ],
  exports: [databaseConfig.KEY],
})
class TestConfigModule {}

describe("Drizzle 동일 연결 savepoint (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let module: TestingModule;
  let unitOfWork: UnitOfWorkPort;
  let savepointRunner: SavepointRunnerPort;
  let afterCommitTasks: AfterCommitTaskRegistryPort;
  let txHost: TransactionHost<DrizzleTransactionalAdapter>;
  let userId: string;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 1 }) });
    const client = await database.start();
    module = await Test.createTestingModule({
      imports: [
        TestConfigModule,
        DatabaseModule,
        ClsModule.forRoot({
          global: true,
          plugins: [
            new ClsPluginTransactional({
              imports: [DatabaseModule],
              adapter: new TransactionalAdapterDrizzleOrm({ drizzleInstanceToken: DRIZZLE }),
            }),
          ],
        }),
      ],
    })
      .overrideProvider(DRIZZLE)
      .useValue(client)
      .compile();
    await module.init();
    unitOfWork = module.get(UnitOfWorkPort);
    savepointRunner = module.get(SavepointRunnerPort);
    afterCommitTasks = module.get(AfterCommitTaskRegistryPort);
    txHost = module.get<TransactionHost<DrizzleTransactionalAdapter>>(TransactionHost);
  });

  beforeEach(async () => {
    await database.cleanup();
    const userFixture = UserFixture.create();
    userId = userFixture.id;
    await database.getClient().insert(user).values(userFixture);
  });

  afterAll(async () => {
    await module?.close();
    await database?.stop();
  });

  async function connectionPid(): Promise<number | undefined> {
    const { rows } = await txHost.tx.execute<{ pid: number }>(
      sql`SELECT pg_backend_pid()::int AS "pid"`,
    );
    return rows[0]?.pid;
  }

  async function createMemo(content: string, memoUserId = userId): Promise<void> {
    await txHost.tx
      .insert(memo)
      .values({ userId: memoUserId, content, sortOrder: 0, updatedAt: Temporal.Now.instant() });
  }

  it.each(["postgres", "application"])(
    "%s 오류는 실패 항목만 롤백하고 성공 항목과 다음 항목을 같은 연결에서 커밋한다",
    async (failureKind) => {
      // Given
      const effects: string[] = [];
      let outerPid: number | undefined;
      let innerPid: number | undefined;
      let resumedPid: number | undefined;
      let failure: unknown;

      // When
      await unitOfWork.run(async () => {
        outerPid = await connectionPid();
        await savepointRunner.run(async () => {
          innerPid = await connectionPid();
          await unitOfWork.run(() => createMemo("첫 성공 항목"));
        });
        afterCommitTasks.register(async () => {
          effects.push("첫 성공 항목");
        });

        try {
          await savepointRunner.run(async () => {
            await createMemo("실패 항목의 선행 쓰기");
            if (failureKind === "postgres") {
              await createMemo("외래키 오류", "missing-savepoint-user");
            }
            throw new Error("application-failure");
          });
        } catch (error) {
          failure = error;
        }

        await savepointRunner.run(() => createMemo("후속 성공 항목"));
        afterCommitTasks.register(async () => {
          effects.push("후속 성공 항목");
        });
        resumedPid = await connectionPid();
        expect(effects).toEqual([]);
      });

      // Then
      const rows = await database
        .getClient()
        .select({ content: memo.content })
        .from(memo)
        .where(eq(memo.userId, userId))
        .orderBy(asc(memo.id));
      expect(rows).toEqual([{ content: "첫 성공 항목" }, { content: "후속 성공 항목" }]);
      expect(effects).toEqual(["첫 성공 항목", "후속 성공 항목"]);
      expect(outerPid).toBeDefined();
      expect(innerPid).toBe(outerPid);
      expect(resumedPid).toBe(outerPid);
      if (failureKind === "postgres") {
        expect(databaseSqlState(failure)).toBe("23503");
      } else {
        expect(failure).toBeInstanceOf(Error);
        expect(failure).toHaveProperty("message", "application-failure");
      }
    },
  );

  it("바깥 UoW가 실패하면 release한 성공 savepoint도 롤백하고 후속 작업을 실행하지 않는다", async () => {
    // Given
    const effects: string[] = [];
    const outerFailure = new Error("outer-failure");

    // When
    await expect(
      unitOfWork.run(async () => {
        await savepointRunner.run(() => createMemo("커밋하지 않은 성공 항목"));
        afterCommitTasks.register(async () => {
          effects.push("커밋 후 실행");
        });
        throw outerFailure;
      }),
    ).rejects.toBe(outerFailure);

    // Then
    expect(
      await database.getClient().select({ id: memo.id }).from(memo).where(eq(memo.userId, userId)),
    ).toEqual([]);
    expect(effects).toEqual([]);
  });
});
