import type { TestingModuleBuilder } from "@nestjs/testing";
import { PgBoss } from "pg-boss";

import { databaseConfig } from "#api/platform/config/database.config";
import { jobConfig } from "#api/platform/config/job.config";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { PgBossJobRuntimeAdapter } from "#api/platform/jobs/pg-boss-job-runtime.adapter";
import { JOB_RUNTIME, JobQueuePort } from "#api/shared/application/ports/index";
import { assertManagedTestDatabaseEnvironment } from "#test/setup/managed-test-database";

/** 운영 앱의 pg-boss client는 schema를 만들지 않으므로 앱을 띄우기 전에 테스트 DB에 만든다. 이미 있으면 그대로 둔다. */
export async function preparePgBossSchema(): Promise<void> {
  assertManagedTestDatabaseEnvironment(process.env);
  const database = databaseConfig.parse(process.env);
  const job = jobConfig.parse(process.env);
  const migrator = new PgBoss({
    connectionString: database.url,
    schema: job.schema,
    migrate: true,
    createSchema: true,
  });
  await migrator.start();
  await migrator.stop({ graceful: true, timeout: 10_000, close: true });
}

/**
 * E2E 앱의 Fake 큐를 실제 pg-boss runtime으로 되돌린다. worker·schedule·종료가 운영과 같은 경로를 탄다.
 * client는 운영 pgBossClientProvider가 databaseConfig·jobConfig로 만들고, DATABASE_URL만 관리형 테스트 DB를 가리킨다.
 */
export function useRealJobRuntime(builder: TestingModuleBuilder): TestingModuleBuilder {
  assertManagedTestDatabaseEnvironment(process.env);
  return builder
    .overrideProvider(JOB_RUNTIME)
    .useFactory({
      inject: [PgBossJobRuntimeAdapter],
      factory: (runtime: PgBossJobRuntimeAdapter) => runtime,
    })
    .overrideProvider(JobQueuePort)
    .useFactory({
      inject: [PgBossJobQueueAdapter],
      factory: (queue: PgBossJobQueueAdapter) => queue,
    });
}
