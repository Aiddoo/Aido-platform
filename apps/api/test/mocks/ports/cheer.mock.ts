import type { CheerRepositoryPort } from "@/cheer/application/ports/cheer.repository.port";

/**
 * Cheer 애플리케이션 포트 mock 팩토리 모음
 *
 * @suites/unit은 Symbol 토큰 포트를 안정적으로 auto-mock하지 못하므로 모든 메서드를
 * 명시합니다. 반환 타입을 포트 인터페이스로 강제해 포트 확장 시 누락을 타입 에러로 잡습니다.
 * 개별 메서드 mock API는 spec에서 `jest.mocked(mock.method)` 또는 `Mocked<Port>`로 접근합니다.
 */

export function createCheerRepositoryMock(): CheerRepositoryPort {
	return {
		findById: jest.fn(),
		findLastCheerToUser: jest.fn(),
		markAsRead: jest.fn(),
		markManyAsRead: jest.fn(),
		findReceivedCheers: jest.fn(),
		findSentCheers: jest.fn(),
		countTodayCheers: jest.fn(),
		countSentSince: jest.fn(),
		countReceived: jest.fn(),
		countSent: jest.fn(),
		countUnreadReceived: jest.fn(),
		createWithRelations: jest.fn(),
	};
}
