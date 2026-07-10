import { Injectable } from "@nestjs/common";
import {
	type TransactionContext,
	type TransactionManagerPort,
	wrapTransaction,
} from "@/shared/application/ports";
import { DatabaseService } from "./database.service";

/**
 * Prisma 트랜잭션 매니저 어댑터
 *
 * TRANSACTION_MANAGER 포트의 Prisma 구현체.
 * DatabaseModule(@Global)에서 토큰으로 제공됩니다.
 */
@Injectable()
export class PrismaTransactionManager implements TransactionManagerPort {
	constructor(private readonly database: DatabaseService) {}

	run<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
		return this.database.$transaction((tx) => fn(wrapTransaction(tx)));
	}
}
