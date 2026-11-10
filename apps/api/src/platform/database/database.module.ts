import { Global, Module } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { DrizzleModule, getDrizzleToken } from "@nestjs/drizzle";

import { databaseConfig } from "#api/platform/config/database.config";
import {
  AFTER_COMMIT_TASK_REGISTRY,
  AfterCommitTaskRegistryPort,
  MUTATION_LOCK,
  MutationLockPort,
  SAVEPOINT_RUNNER,
  SavepointRunnerPort,
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import { ClsSavepointRunner } from "./cls-savepoint-runner.js";
import { ClsUnitOfWork } from "./cls-unit-of-work.js";
import { createDatabase, DRIZZLE } from "./database.client.js";
import { PostgresMutationLockAdapter } from "./postgres-mutation-lock.adapter.js";
import { createPostgresPool } from "./postgres-pool.js";

@Global()
@Module({
  imports: [
    // 앱 종료 때 DrizzleModule이 pool을 한 번 닫는다(job worker는 그 전 beforeApplicationShutdown에서 멈춘다)
    DrizzleModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (database: ConfigType<typeof databaseConfig>) => ({
        db: createDatabase(createPostgresPool(database)),
      }),
    }),
  ],
  providers: [
    { provide: DRIZZLE, useExisting: getDrizzleToken() },
    ClsUnitOfWork,
    { provide: SAVEPOINT_RUNNER, useClass: ClsSavepointRunner },
    { provide: UNIT_OF_WORK, useExisting: ClsUnitOfWork },
    { provide: AFTER_COMMIT_TASK_REGISTRY, useExisting: ClsUnitOfWork },
    { provide: MUTATION_LOCK, useClass: PostgresMutationLockAdapter },
    // 옛 Symbol 토큰을 쓰는 Context가 모두 옮겨질 때까지 클래스 토큰은 같은 인스턴스의 별칭이다
    { provide: SavepointRunnerPort, useExisting: SAVEPOINT_RUNNER },
    { provide: UnitOfWorkPort, useExisting: UNIT_OF_WORK },
    { provide: AfterCommitTaskRegistryPort, useExisting: AFTER_COMMIT_TASK_REGISTRY },
    { provide: MutationLockPort, useExisting: MUTATION_LOCK },
  ],
  exports: [
    DRIZZLE,
    UNIT_OF_WORK,
    AFTER_COMMIT_TASK_REGISTRY,
    MUTATION_LOCK,
    SAVEPOINT_RUNNER,
    UnitOfWorkPort,
    AfterCommitTaskRegistryPort,
    MutationLockPort,
    SavepointRunnerPort,
  ],
})
export class DatabaseModule {}
