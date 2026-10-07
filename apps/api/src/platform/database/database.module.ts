import { Global, Module } from "@nestjs/common";

import {
  AFTER_COMMIT_TASK_REGISTRY,
  MUTATION_LOCK,
  SAVEPOINT_RUNNER,
  UNIT_OF_WORK,
} from "#api/shared/application/ports/index";

import { ClsSavepointRunner } from "./cls-savepoint-runner.js";
import { ClsUnitOfWork } from "./cls-unit-of-work.js";
import { DatabaseService } from "./database.service.js";
import { PostgresMutationLockAdapter } from "./postgres-mutation-lock.adapter.js";
import { PostgresPool } from "./postgres-pool.js";

@Global()
@Module({
  providers: [
    PostgresPool,
    DatabaseService,
    ClsUnitOfWork,
    { provide: SAVEPOINT_RUNNER, useClass: ClsSavepointRunner },
    { provide: UNIT_OF_WORK, useExisting: ClsUnitOfWork },
    { provide: AFTER_COMMIT_TASK_REGISTRY, useExisting: ClsUnitOfWork },
    { provide: MUTATION_LOCK, useClass: PostgresMutationLockAdapter },
  ],
  exports: [
    DatabaseService,
    UNIT_OF_WORK,
    AFTER_COMMIT_TASK_REGISTRY,
    MUTATION_LOCK,
    SAVEPOINT_RUNNER,
  ],
})
export class DatabaseModule {}
