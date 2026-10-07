import { vi } from "vitest";

import { SessionFixture } from "#test/fixtures/index";
import { StubAuthSessionRepository } from "#test/mocks/ports/auth-session.stub";

import { ListActiveSessions } from "./list-active-sessions.use-case.js";

const currentTime = new Date("2026-12-31T23:59:00Z");
const userId = "user-123";

describe("ListActiveSessions — 내 활성 기기 목록", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(currentTime);
  });
  afterEach(() => vi.useRealTimers());

  it("활성 세션의 날짜·기기 정보를 기존 응답 형식으로 매핑하고 토큰 정보를 노출하지 않는다", async () => {
    // Given
    const sessionRepository = new StubAuthSessionRepository([
      SessionFixture.create({
        userId,
        id: "my-session",
        ipAddress: "192.0.2.1",
        userAgent: "Chrome/120",
      }),
      SessionFixture.create({ userId: "other-user", id: "other-session" }),
      SessionFixture.create({ userId, id: "revoked-session", revokedAt: currentTime }),
      SessionFixture.createExpired({ userId, id: "expired-session" }),
    ]);
    const useCase = new ListActiveSessions({ sessionRepository });

    // When
    const result = await useCase.execute({ userId });

    // Then
    expect(result).toEqual([
      {
        id: "my-session",
        deviceName: null,
        deviceType: null,
        ipAddress: "192.0.2.1",
        userAgent: "Chrome/120",
        lastActiveAt: currentTime.toISOString(),
        createdAt: currentTime.toISOString(),
        isCurrent: false,
      },
    ]);
  });

  it("내 활성 세션이 없으면 빈 목록을 반환한다", async () => {
    // Given
    const useCase = new ListActiveSessions({ sessionRepository: new StubAuthSessionRepository() });

    // When
    const result = await useCase.execute({ userId });

    // Then
    expect(result).toEqual([]);
  });
});
