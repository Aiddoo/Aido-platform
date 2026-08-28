import { Global, Module } from "@nestjs/common";

import {
	AFTER_COMMIT_TASK_REGISTRY,
	MUTATION_LOCK,
	UNIT_OF_WORK,
} from "@/shared/application/ports";

import { ClsUnitOfWork } from "./cls-unit-of-work";
import { DatabaseService } from "./database.service";
import { PostgresMutationLockAdapter } from "./postgres-mutation-lock.adapter";

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
