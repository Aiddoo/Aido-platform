import type { Prisma } from "@/generated/prisma/client";

/**
 * Prisma 모델별 Mock 델리게이트 타입
 */
interface MockModelDelegate {
	findUnique: jest.Mock;
	findFirst: jest.Mock;
	findMany: jest.Mock;
	create: jest.Mock;
	createMany: jest.Mock;
	update: jest.Mock;
	updateMany: jest.Mock;
	upsert: jest.Mock;
	delete: jest.Mock;
	deleteMany: jest.Mock;
	count: jest.Mock;
	aggregate: jest.Mock;
	groupBy: jest.Mock;
}

/**
 * 단일 모델 델리게이트 mock 생성
 */
function createMockModelDelegate(): MockModelDelegate {
	return {
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		create: jest.fn(),
		createMany: jest.fn(),
		update: jest.fn(),
		updateMany: jest.fn(),
		upsert: jest.fn(),
		delete: jest.fn(),
		deleteMany: jest.fn(),
		count: jest.fn(),
		aggregate: jest.fn(),
		groupBy: jest.fn(),
	};
}

/**
 * 트랜잭션 클라이언트 mock 타입
 */
export interface MockTransactionClient {
	user: MockModelDelegate;
	profile: MockModelDelegate;
	account: MockModelDelegate;
	session: MockModelDelegate;
	refreshToken: MockModelDelegate;
	verification: MockModelDelegate;
	loginAttempt: MockModelDelegate;
	securityLog: MockModelDelegate;
	oAuthState: MockModelDelegate;
	todo: MockModelDelegate;
	dailyCompletion: MockModelDelegate;
	follow: MockModelDelegate;
	nudge: MockModelDelegate;
}

/**
 * 트랜잭션 클라이언트 mock 생성
 *
 * @example
 * ```typescript
 * const mockTx = createMockTxClient();
 * mockTx.user.findUnique.mockResolvedValue(mockUser);
 * await repository.create(data, mockTx);
 * ```
 */
export function createMockTxClient(): MockTransactionClient {
	return {
		user: createMockModelDelegate(),
		profile: createMockModelDelegate(),
		account: createMockModelDelegate(),
		session: createMockModelDelegate(),
		refreshToken: createMockModelDelegate(),
		verification: createMockModelDelegate(),
		loginAttempt: createMockModelDelegate(),
		securityLog: createMockModelDelegate(),
		oAuthState: createMockModelDelegate(),
		todo: createMockModelDelegate(),
		dailyCompletion: createMockModelDelegate(),
		follow: createMockModelDelegate(),
		nudge: createMockModelDelegate(),
	};
}

/**
 * MockTransactionClient를 Prisma.TransactionClient 타입으로 캐스팅
 * Repository 메서드 호출 시 타입 호환성을 위해 사용
 */
export function asTxClient(
	mock: MockTransactionClient,
): Prisma.TransactionClient {
	return mock as unknown as Prisma.TransactionClient;
}

/**
 * 트랜잭션 mock 초기화
 */
export function resetTxClientMocks(client: MockTransactionClient): void {
	const models = Object.values(client) as MockModelDelegate[];
	for (const model of models) {
		for (const method of Object.values(model)) {
			if (typeof method === "function" && "mockReset" in method) {
				(method as jest.Mock).mockReset();
			}
		}
	}
}
