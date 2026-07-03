import {
	type TransactionClient,
	type TransactionContext,
	type TransactionManagerPort,
	wrapTransaction,
} from "@/common/database";

/**
 * TRANSACTION_MANAGER 포트 mock 팩토리
 *
 * run이 콜백을 즉시 실행하는 passthrough 구현입니다.
 * 콜백에는 스텁 클라이언트를 wrapTransaction으로 감싼 불투명
 * TransactionContext를 넘겨, 트랜잭션 내부 포트 호출을 검증할 수 있습니다.
 *
 * @example
 * ```typescript
 * const { unit, unitRef } = await TestBed.solitary(CreateTodoHandler)
 *   .mock<TransactionManagerPort>(TRANSACTION_MANAGER)
 *   .impl(() => createTransactionManagerMock())
 *   .compile();
 * ```
 */
export function createTransactionManagerMock(
	client: TransactionClient = {} as TransactionClient,
): TransactionManagerPort {
	const tx = wrapTransaction(client);
	const run = jest.fn();
	run.mockImplementation((fn: (tx: TransactionContext) => Promise<unknown>) =>
		fn(tx),
	);
	return { run };
}
