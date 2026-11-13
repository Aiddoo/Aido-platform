import { DrizzleModule, getDrizzleToken } from "@nestjs/drizzle";
import { Test, type TestingModule } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import { Pool } from "pg";

import { createDatabase, DRIZZLE, type Database } from "#api/platform/database/database.client";
import { createPostgresPoolConfig } from "#api/platform/database/postgres-pool";
import { user as userTable } from "#api/platform/database/schema/index";
import { JobQueueLifecycle } from "#api/platform/jobs/job-queue.module";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createTestClient } from "#test/setup/database-context";
import { assertManagedTestDatabaseEnvironment } from "#test/setup/managed-test-database";

it("종료 중 활성 worker가 DB 저장을 마친 뒤 연결이 닫힌다", async () => {
  // Given
  const { connectionUri } = assertManagedTestDatabaseEnvironment(process.env);
  const pool = new Pool({ ...createPostgresPoolConfig(connectionUri), max: 2 });
  const verifier = createTestClient(connectionUri);
  const events: string[] = [];
  const jobQueue = new InMemoryJobQueue();
  const { promise: gate, resolve: release } = Promise.withResolvers<void>();
  let worker: Promise<{ error?: unknown }> | undefined;
  let database: Database | undefined;
  let userId: string | undefined;
  jobQueue.start = async () => {
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
        await activeDatabase
          .update(userTable)
          .set({ aiUsageCount: 1 })
          .where(eq(userTable.id, activeUserId));
        events.push("worker-write-completed");
        return {};
      } catch (error) {
        events.push("worker-write-failed");
        return { error };
      }
    })();
  };
  jobQueue.stop = async () => {
    events.push("runtime-stop-start");
    release();
    const outcome = await worker;
    events.push(pool.ended ? "database-closed-before-worker" : "runtime-stop-completed");
    if (outcome?.error !== undefined) {
      throw outcome.error;
    }
  };
  let module: TestingModule | undefined;
  try {
    module = await Test.createTestingModule({
      imports: [DrizzleModule.forRoot({ db: createDatabase(pool) })],
      providers: [
        { provide: DRIZZLE, useExisting: getDrizzleToken() },
        { provide: JobQueuePort, useValue: jobQueue },
        JobQueueLifecycle,
      ],
    }).compile();
    database = module.get<Database>(DRIZZLE);
    const [user] = await database
      .insert(userTable)
      .values(
        UserFixture.create({
          id: createEntityId(),
          email: "controlled-worker@shutdown.test",
          userTag: "SHUT0001",
        }),
      )
      .returning();
    if (user == null) {
      throw new Error("Shutdown fixture user was not created");
    }
    userId = user.id;
    await module.init();

    // When
    let closeError: unknown;
    try {
      await module.close();
    } catch (error) {
      closeError = error;
    }
    const outcome = await worker;
    const stored = await verifier.query.user.findFirst({
      columns: { aiUsageCount: true },
      where: { id: userId },
    });

    // Then
    expect(outcome?.error).toBeUndefined();
    expect(closeError).toBeUndefined();
    expect(stored?.aiUsageCount).toBe(1);
    expect(events).toEqual([
      "worker-active",
      "runtime-stop-start",
      "worker-write-start",
      "worker-write-completed",
      "runtime-stop-completed",
    ]);
    expect(pool.ended).toBe(true);
  } finally {
    release();
    await worker;
    if (userId !== undefined) {
      await verifier.delete(userTable).where(eq(userTable.id, userId));
    }
    await verifier.close();
    await pool.end().catch(() => undefined);
  }
});
