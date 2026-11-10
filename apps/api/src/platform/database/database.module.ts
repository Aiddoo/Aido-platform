import { Global, Module } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { DrizzleModule, getDrizzleToken } from "@nestjs/drizzle";

import { databaseConfig } from "#api/platform/config/database.config";
import {
  AFTER_COMMIT_TASK_REGISTRY,
  AfterCommitTaskRegistryPort,
  MutationLockPort,
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
    { provide: SavepointRunnerPort, useClass: ClsSavepointRunner },
    { provide: MutationLockPort, useClass: PostgresMutationLockAdapter },
    { provide: UnitOfWorkPort, useExisting: ClsUnitOfWork },
    { provide: AfterCommitTaskRegistryPort, useExisting: ClsUnitOfWork },
    // notification이 아직 Symbol로 주입받아 같은 인스턴스를 가리킨다. notification이 클래스 토큰으로 옮기면 지운다
    { provide: UNIT_OF_WORK, useExisting: ClsUnitOfWork },
    { provide: AFTER_COMMIT_TASK_REGISTRY, useExisting: ClsUnitOfWork },
  ],
  exports: [
    DRIZZLE,
    UNIT_OF_WORK,
    AFTER_COMMIT_TASK_REGISTRY,
    UnitOfWorkPort,
    AfterCommitTaskRegistryPort,
    MutationLockPort,
    SavepointRunnerPort,
  ],
})
export class DatabaseModule {}
