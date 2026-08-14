import { Global, Module } from "@nestjs/common";

import { MUTATION_LOCK, UNIT_OF_WORK } from "@/shared/application/ports";

import { ClsUnitOfWork } from "./cls-unit-of-work";
import { DatabaseService } from "./database.service";
import { PostgresMutationLockAdapter } from "./postgres-mutation-lock.adapter";

@Global()
@Module({
	providers: [
		DatabaseService,
		{ provide: UNIT_OF_WORK, useClass: ClsUnitOfWork },
		{ provide: MUTATION_LOCK, useClass: PostgresMutationLockAdapter },
	],
	exports: [DatabaseService, UNIT_OF_WORK, MUTATION_LOCK],
})
export class DatabaseModule {}
