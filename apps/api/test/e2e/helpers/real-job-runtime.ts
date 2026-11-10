import type { TestingModuleBuilder } from "@nestjs/testing";
import { PgBoss } from "pg-boss";

import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import {
  LazyPgBossClient,
  PG_BOSS_CLIENT,
  PgBossJobRuntimeAdapter,
} from "#api/platform/jobs/pg-boss-job-runtime.adapter";
import { JOB_RUNTIME, JobQueuePort } from "#api/shared/application/ports/index";
import { assertManagedTestDatabaseEnvironment } from "#test/setup/managed-test-database";

const PG_BOSS_SCHEMA = "pgboss";

function testDatabaseUri(): string {
  return assertManagedTestDatabaseEnvironment(process.env).connectionUri;
}

/** 운영 앱의 pg-boss client는 schema를 만들지 않으므로 앱을 띄우기 전에 테스트 DB에 만든다. 이미 있으면 그대로 둔다. */
export async function preparePgBossSchema(): Promise<void> {
  const migrator = new PgBoss({
    connectionString: testDatabaseUri(),
    schema: PG_BOSS_SCHEMA,
    migrate: true,
    createSchema: true,
  });
  await migrator.start();
  await migrator.stop({ graceful: true, timeout: 10_000, close: true });
}

/**
 * E2E 앱의 Fake 큐를 실제 pg-boss runtime으로 되돌린다. worker·schedule·종료가 운영과 같은 경로를 탄다.
 * client는 운영 provider와 같은 옵션으로 만들되 연결 문자열만 관리형 테스트 DB에서 직접 받는다.
 */
export function useRealJobRuntime(builder: TestingModuleBuilder): TestingModuleBuilder {
  return builder
    .overrideProvider(PG_BOSS_CLIENT)
    .useFactory({
      factory: () =>
        new LazyPgBossClient(
          () =>
            new PgBoss({
              connectionString: testDatabaseUri(),
              schema: PG_BOSS_SCHEMA,
              application_name: "aido-pg-boss",
              max: 3,
              migrate: false,
              createSchema: false,
              useListenNotify: false,
            }),
        ),
    })
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
