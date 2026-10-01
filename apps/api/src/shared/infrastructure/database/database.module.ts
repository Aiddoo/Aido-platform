import { Global, Module } from "@nestjs/common";

import {
	AFTER_COMMIT_TASK_REGISTRY,
	MUTATION_LOCK,
	UNIT_OF_WORK,
} from "#api/shared/application/ports/index";

import { ClsUnitOfWork } from "./cls-unit-of-work.js";
import { DatabaseService } from "./database.service.js";
import { PostgresMutationLockAdapter } from "./postgres-mutation-lock.adapter.js";

@Global()
@Module({
	providers: [
		DatabaseService,
		ClsUnitOfWork,
		{ provide: UNIT_OF_WORK, useExisting: ClsUnitOfWork },
		{ provide: AFTER_COMMIT_TASK_REGISTRY, useExisting: ClsUnitOfWork },
		{ provide: MUTATION_LOCK, useClass: PostgresMutationLockAdapter },
	],
	exports: [DatabaseService, UNIT_OF_WORK, AFTER_COMMIT_TASK_REGISTRY, MUTATION_LOCK],
})
export class DatabaseModule {}
