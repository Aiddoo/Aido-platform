export const UNIT_OF_WORK = Symbol("UNIT_OF_WORK");

/**
 * 작업 단위(Unit of Work) 포트
 *
 * 콜백을 단일 DB 트랜잭션 안에서 실행합니다. 콜백은 인자를 받지 않습니다 —
 * 리포지토리가 활성 트랜잭션을 CLS(AsyncLocalStorage)에서 직접 읽으므로
 * tx 핸들을 계층 간에 전달하지 않습니다(구 TransactionManagerPort의 후속).
 *
 * 전파(Propagation)는 Required: 활성 트랜잭션 안에서 다시 run을 호출하면
 * 새 트랜잭션을 만들지 않고 기존 트랜잭션에 참여합니다.
 *
 * @example
 * ```typescript
 * const created = await this.uow.run(async () => {
 *   const max = await this.todoRepository.getMaxSortOrder(userId);
 *   return this.todoRepository.create({ ...draft, sortOrder: max + 1 });
 * });
 * ```
 */
export interface UnitOfWorkPort {
	run<T>(work: () => Promise<T>): Promise<T>;
}
