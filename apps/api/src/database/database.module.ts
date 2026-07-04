import { Global, Module } from "@nestjs/common";
import { TRANSACTION_MANAGER } from "@/common/database";
import { DatabaseService } from "./database.service";
import { PrismaTransactionManager } from "./prisma-transaction-manager";

@Global()
@Module({
	providers: [
		DatabaseService,
		{ provide: TRANSACTION_MANAGER, useClass: PrismaTransactionManager },
	],
	exports: [DatabaseService, TRANSACTION_MANAGER],
})
export class DatabaseModule {}
