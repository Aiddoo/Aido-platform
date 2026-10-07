import { vi } from "vitest";

import type { CheerRepositoryPort } from "#api/modules/social/application/ports/cheers/cheer.repository.port";

/**
 * Cheer 애플리케이션 포트 mock 팩토리 모음
 *
 * @suites/unit은 Symbol 토큰 포트를 안정적으로 auto-mock하지 못하므로 모든 메서드를
 * 명시합니다. 반환 타입을 포트 인터페이스로 강제해 포트 확장 시 누락을 타입 에러로 잡습니다.
 * 개별 메서드 mock API는 spec에서 `vi.mocked(mock.method)` 또는 `Mocked<Port>`로 접근합니다.
 */

export function createCheerRepositoryMock(): CheerRepositoryPort {
  return {
    findById: vi.fn(),
    findLastCheerToUser: vi.fn(),
    markAsRead: vi.fn(),
    markManyAsRead: vi.fn(),
    findReceivedCheers: vi.fn(),
    findSentCheers: vi.fn(),
    countTodayCheers: vi.fn(),
    countSentSince: vi.fn(),
    countReceived: vi.fn(),
    countSent: vi.fn(),
    countUnreadReceived: vi.fn(),
    createWithRelations: vi.fn(),
  };
}
