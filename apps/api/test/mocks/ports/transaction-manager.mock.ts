import type { Mocked } from "@suites/doubles.jest";
import type {
	TransactionClient,
	TransactionManagerPort,
} from "@/common/database";

/**
 * TRANSACTION_MANAGER 포트 mock 팩토리
 *
 * run이 콜백을 즉시 실행하는 passthrough 구현입니다.
 * 기존 `database.$transaction` mock과 동일하게, 리포지토리 mock을
 * tx 클라이언트로 넘겨 트랜잭션 내부 호출을 검증할 수 있습니다.
 *
 * @example
 * ```typescript
 * const { unit, unitRef } = await TestBed.solitary(CreateTodoHandler)
 *   .mock<TransactionManagerPort>(TRANSACTION_MANAGER)
 *   .impl(() => createTransactionManagerMock(todoRepoMock))
 *   .compile();
 * ```
 */
export function createTransactionManagerMock(
	tx: unknown = {},
): Mocked<TransactionManagerPort> {
	return {
		run: jest.fn(
			async (fn: (tx: TransactionClient) => Promise<unknown>) =>
				fn(tx as TransactionClient) as never,
		),
	} as unknown as Mocked<TransactionManagerPort>;
}
