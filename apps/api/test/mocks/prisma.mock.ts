/**
 * Prisma Client Mock 모듈
 *
 * jest-mock-extended를 사용한 타입 안전한 Prisma Client Mock
 * Prisma 공식 문서 권장 패턴 적용
 *
 * @see https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing
 */

import { type DeepMockProxy, mockDeep, mockReset } from "jest-mock-extended";

import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma Client의 Deep Mock 타입
 * 모든 모델과 메서드가 자동으로 Mock됨
 */
export type MockPrismaClient = DeepMockProxy<PrismaClient>;

/**
 * 새로운 Prisma Mock 인스턴스 생성
 *
 * @example
 * ```typescript
 * const prisma = createMockPrisma();
 * prisma.user.findUnique.mockResolvedValue(mockUser);
 * prisma.todo.create.mockResolvedValue(mockTodo);
 * ```
 */
export function createMockPrisma(): MockPrismaClient {
	return mockDeep<PrismaClient>();
}

/**
 * Prisma Mock 초기화
 *
 * @param mock - 초기화할 Mock 인스턴스
 *
 * @example
 * ```typescript
 * afterEach(() => {
 *   resetMockPrisma(prisma);
 * });
 * ```
 */
export function resetMockPrisma(mock: MockPrismaClient): void {
	mockReset(mock);
}

/**
 * 트랜잭션 Mock 설정 헬퍼
 *
 * Interactive 트랜잭션을 시뮬레이션하기 위한 헬퍼 함수
 *
 * @param prisma - Prisma Mock 인스턴스
 * @param setupTx - 트랜잭션 내부에서 사용할 Mock 설정 콜백
 *
 * @example
 * ```typescript
 * const prisma = createMockPrisma();
 *
 * setupTransaction(prisma, (tx) => {
 *   tx.user.create.mockResolvedValue(mockUser);
 *   tx.todo.create.mockResolvedValue(mockTodo);
 * });
 *
 * // 이제 service.$transaction() 호출 시 tx Mock이 사용됨
 * ```
 */
export function setupTransaction(
	prisma: MockPrismaClient,
	setupTx: (tx: MockPrismaClient) => void,
): MockPrismaClient {
	const txMock = createMockPrisma();
	setupTx(txMock);

	prisma.$transaction.mockImplementation(
		async <T>(arg: ((tx: PrismaClient) => Promise<T>) | unknown[]): Promise<T> => {
			if (typeof arg === "function") {
				return arg(txMock as unknown as PrismaClient);
			}
			// Array 트랜잭션의 경우 그대로 반환
			return arg as T;
		},
	);

	return txMock;
}
