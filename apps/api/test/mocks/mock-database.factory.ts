/**
 * Mock DatabaseService 팩토리
 *
 * @description
 * Mock DB 통합 테스트에서 사용하는 DatabaseService mock을 통일된 패턴으로 생성합니다.
 * $transaction은 콜백을 즉시 실행하여 서비스가 동일한 mock DB를 사용하도록 합니다.
 *
 * @example
 * ```typescript
 * const mockDb = createMockDatabaseService({
 *   todo: { create: jest.fn(), findMany: jest.fn() },
 *   user: { findUnique: jest.fn() },
 * });
 * ```
 */

export function createMockDatabaseService<
	T extends Record<string, object>,
>(models: T): T & { $transaction: jest.Mock } {
	const service = {
		...models,
		$transaction: jest.fn(),
	} as T & { $transaction: jest.Mock };

	service.$transaction.mockImplementation(
		(callback: (tx: unknown) => Promise<unknown>) => callback(service),
	);

	return service;
}
