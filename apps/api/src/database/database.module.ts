import { Global, Module } from "@nestjs/common";
import { TRANSACTION_MANAGER, UNIT_OF_WORK } from "@/common/database";
import { ClsUnitOfWork } from "./cls-unit-of-work";
import { DatabaseService } from "./database.service";
import { PrismaTransactionManager } from "./prisma-transaction-manager";

@Global()
@Module({
	providers: [
		DatabaseService,
		{ provide: TRANSACTION_MANAGER, useClass: PrismaTransactionManager },
		{ provide: UNIT_OF_WORK, useClass: ClsUnitOfWork },
	],
	exports: [DatabaseService, TRANSACTION_MANAGER, UNIT_OF_WORK],
})
export class DatabaseModule {}
