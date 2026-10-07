import { ClsPluginTransactional, TransactionHost } from "@nestjs-cls/transactional";
import { Test, type TestingModule } from "@nestjs/testing";
import { ClsModule } from "nestjs-cls";
import sql from "sql-template-tag";

import { encodeCreate } from "#api/platform/database/database-records";
import { sqlStatement } from "#api/platform/database/database-sql";
import { DatabaseModule } from "#api/platform/database/database.module";
import { DatabaseService } from "#api/platform/database/database.service";
import { PostgresPool } from "#api/platform/database/postgres-pool";
import { databaseSqlState } from "#api/platform/database/prisma-error.util";
import { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import {
  AFTER_COMMIT_TASK_REGISTRY,
  SAVEPOINT_RUNNER,
  UNIT_OF_WORK,
  type AfterCommitTaskRegistryPort,
  type SavepointRunnerPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient, createTestDatabaseService } from "#test/setup/database-context";
import { TestDatabase } from "#test/setup/test-database";

describe("Prisma 8 동일 연결 savepoint (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let module: TestingModule;
  let unitOfWork: UnitOfWorkPort;
  let savepointRunner: SavepointRunnerPort;
  let afterCommitTasks: AfterCommitTaskRegistryPort;
  let txHost: TransactionHost<Prisma8TransactionalAdapter>;
  let userId: string;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 1 }) });
    const client = await database.start();
    module = await Test.createTestingModule({
      imports: [
        DatabaseModule,
        ClsModule.forRoot({
          global: true,
          plugins: [
            new ClsPluginTransactional({
              imports: [DatabaseModule],
              adapter: new Prisma8TransactionalAdapter(),
            }),
          ],
        }),
      ],
    })
      .overrideProvider(DatabaseService)
      .useValue(createTestDatabaseService(client))
      .overrideProvider(PostgresPool)
      .useValue({})
      .compile();
    await module.init();
    unitOfWork = module.get<UnitOfWorkPort>(UNIT_OF_WORK);
    savepointRunner = module.get<SavepointRunnerPort>(SAVEPOINT_RUNNER);
    afterCommitTasks = module.get<AfterCommitTaskRegistryPort>(AFTER_COMMIT_TASK_REGISTRY);
    txHost = module.get<TransactionHost<Prisma8TransactionalAdapter>>(TransactionHost);
  });

  beforeEach(async () => {
    await database.cleanup();
    const user = UserFixture.create();
    userId = user.id;
    await database.getClient().orm.public.User.create(encodeCreate("User", user));
  });

  afterAll(async () => {
    await module?.close();
    await database?.stop();
  });

  async function connectionPid(): Promise<number | undefined> {
    const tx = txHost.tx;
    const rows = await tx.query(
      sqlStatement(tx, sql`SELECT pg_backend_pid()::int AS "pid"`)
        .returnsRow({ pid: "pg/int4@1" })
        .build(),
    );
    return rows[0]?.pid;
  }

  async function createMemo(content: string, memoUserId = userId): Promise<void> {
    await txHost.tx.orm.public.Memo.create(
      encodeCreate("Memo", { userId: memoUserId, content, sortOrder: 0 }),
    );
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
        .orm.public.Memo.where({ userId })
        .orderBy((memo) => memo.id.asc())
        .select("content")
        .all();
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
    expect(await database.getClient().orm.public.Memo.where({ userId }).select("id").all()).toEqual(
      [],
    );
    expect(effects).toEqual([]);
  });
});
