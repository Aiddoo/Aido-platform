import type { TransactionContext } from "./transaction-context";

export const TRANSACTION_MANAGER = Symbol("TRANSACTION_MANAGER");

/**
 * 트랜잭션 매니저 포트
 *
 * application 계층(유스케이스 핸들러)이 DatabaseService(Prisma)에 직접 의존하지 않고
 * 트랜잭션을 실행하기 위한 포트입니다. 구현체는 src/database의 PrismaTransactionManager.
 * tx는 불투명 TransactionContext로 전달되며, 인프라 어댑터만 unwrapTransaction으로
 * Prisma 클라이언트로 되돌려 사용합니다.
 *
 * @example
 * ```typescript
 * const result = await this.txManager.run((tx) => this.todoRepository.save(todo, tx));
 * ```
 */
export interface TransactionManagerPort {
	run<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
