/**
 * Prisma Client Mock 모듈
 *
 * vitest-mock-extended를 사용한 타입 안전한 Prisma Client Mock
 * Prisma 공식 문서 권장 패턴 적용
 *
 * @see https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing
 */

import { type DeepMockProxy, mockDeep, mockReset } from "vitest-mock-extended";

import type { PrismaClient } from "#api/generated/prisma/client";

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
