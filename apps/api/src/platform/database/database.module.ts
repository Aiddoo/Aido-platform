import { Global, Module } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { DrizzleModule, getDrizzleToken } from "@nestjs/drizzle";

import { databaseConfig } from "#api/platform/config/database.config";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { SavepointRunnerPort } from "#api/shared/application/ports/savepoint-runner.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

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
    // 트랜잭션과 커밋 뒤 작업 목록은 같은 CLS 범위를 써야 해 한 인스턴스가 두 포트를 맡는다
    ClsUnitOfWork,
    { provide: UnitOfWorkPort, useExisting: ClsUnitOfWork },
    { provide: AfterCommitTaskRegistryPort, useExisting: ClsUnitOfWork },
    { provide: SavepointRunnerPort, useClass: ClsSavepointRunner },
    { provide: MutationLockPort, useClass: PostgresMutationLockAdapter },
  ],
  exports: [
    DRIZZLE,
    UnitOfWorkPort,
    AfterCommitTaskRegistryPort,
    SavepointRunnerPort,
    MutationLockPort,
  ],
})
export class DatabaseModule {}
