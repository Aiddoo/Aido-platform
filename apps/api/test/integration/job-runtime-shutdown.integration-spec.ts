import { Test, type TestingModule } from "@nestjs/testing";
import { Pool } from "pg";
import { mock } from "vitest-mock-extended";

import { encodeCreate } from "#api/platform/database/database-records";
import { createEntityId } from "#api/platform/database/database-values";
import { DatabaseService } from "#api/platform/database/database.service";
import { PostgresPool } from "#api/platform/database/postgres-pool";
import { JobRuntimeLifecycle } from "#api/platform/jobs/job-runtime.module";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { UserFixture } from "#test/fixtures/user.fixture";
import { assertManagedTestDatabaseEnvironment } from "#test/setup/managed-test-database";

it("종료 중 활성 worker가 native DB 저장을 마친 뒤 연결이 닫힌다", async () => {
  // Given: 관리형 PostgreSQL과 실제 Nest hook에 조립된 worker가 Promise gate에서 대기한다.
  const { connectionUri } = assertManagedTestDatabaseEnvironment(process.env);
  const pool = new Pool({ connectionString: connectionUri, max: 2 });
  const events: string[] = [];
  const runtime = mock<JobRuntimePort>();
  const { promise: gate, resolve: release } = Promise.withResolvers<void>();
  let worker: Promise<{ error?: unknown }> | undefined;
  let database: DatabaseService | undefined;
  let userId: string | undefined;
  runtime.start.mockImplementation(async () => {
    const activeDatabase = database;
    if (activeDatabase === undefined) {
      throw new Error("Shutdown fixture database is missing");
    }
    const activeUserId = userId;
    if (activeUserId === undefined) {
      throw new Error("Shutdown fixture user is missing");
    }
    events.push("worker-active");
    worker = (async () => {
      await gate;
      events.push("worker-write-start");
      try {
        await activeDatabase.db.runtime().execute(
          activeDatabase.db.raw.sql`
          UPDATE public."User" SET "aiUsageCount" = ${1} WHERE "id" = ${activeUserId}
        `
            .affectedCount()
            .build(),
        );
        events.push("worker-write-completed");
        return {};
      } catch (error) {
        events.push("worker-write-failed");
        return { error };
      }
    })();
  });
  runtime.stop.mockImplementation(async () => {
    events.push("runtime-stop-start");
    release();
    const outcome = await worker;
    events.push("runtime-stop-completed");
    if (outcome?.error !== undefined) {
      throw outcome.error;
    }
  });
  let module: TestingModule | undefined;
  try {
    module = await Test.createTestingModule({
      providers: [
        { provide: PostgresPool, useValue: { pool } },
        DatabaseService,
        { provide: JOB_RUNTIME, useValue: runtime },
        JobRuntimeLifecycle,
      ],
    }).compile();
    database = module.get<DatabaseService>(DatabaseService);
    const originalShutdown = database.onApplicationShutdown.bind(database);
    vi.spyOn(database, "onApplicationShutdown").mockImplementation(async () => {
      events.push("database-close-start");
      await originalShutdown();
      events.push("database-closed");
    });
    const user = await database.db.orm.public.User.create(
      encodeCreate(
        "User",
        UserFixture.create({
          id: createEntityId(),
          email: "controlled-worker@shutdown.test",
          userTag: "SHUT0001",
        }),
      ),
    );
    userId = user.id;
    await module.init();
    // When: 실제 app.close()가 drain을 시작하고 worker는 native DB에 저장한다.
    let closeError: unknown;
    try {
      await module.close();
    } catch (error) {
      closeError = error;
    }
    const outcome = await worker;
    const result = await pool.query<{ aiUsageCount: number }>(
      'SELECT "aiUsageCount" FROM public."User" WHERE "id" = $1',
      [userId],
    );
    // Then: worker 저장 성공 뒤 DB가 닫히고 실제 PostgreSQL 저장값이 1이다.
    expect(outcome?.error).toBeUndefined();
    expect(closeError).toBeUndefined();
    expect(result.rows[0]?.aiUsageCount).toBe(1);
    expect(events.indexOf("worker-write-completed")).toBeLessThan(
      events.indexOf("database-closed"),
    );
  } finally {
    release();
    await worker;
    if (userId !== undefined) {
      await pool.query('DELETE FROM public."User" WHERE "id" = $1', [userId]);
    }
    await database?.db.close();
    await pool.end();
  }
});
