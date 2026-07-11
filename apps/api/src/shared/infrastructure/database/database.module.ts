import { Global, Module } from "@nestjs/common";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import { ClsUnitOfWork } from "./cls-unit-of-work";
import { DatabaseService } from "./database.service";

@Global()
@Module({
	providers: [
		DatabaseService,
		{ provide: UNIT_OF_WORK, useClass: ClsUnitOfWork },
	],
	exports: [DatabaseService, UNIT_OF_WORK],
})
export class DatabaseModule {}
