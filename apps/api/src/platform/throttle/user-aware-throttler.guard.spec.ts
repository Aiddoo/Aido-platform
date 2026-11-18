import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import { ThrottlerException, ThrottlerStorageService } from "@nestjs/throttler";

import { UserAwareThrottlerGuard } from "./user-aware-throttler.guard.js";

class Routes {
  limited(): void {}
}

function requestContext(ip: string, userId?: string): ExecutionContextHost {
  const request = { ip, headers: {}, ...(userId != null && { user: { userId } }) };
  const response = { header: () => undefined };
  return new ExecutionContextHost([request, response], Routes, Routes.prototype.limited);
}

describe("UserAwareThrottlerGuard — 요청을 세는 기준", () => {
  let storage: ThrottlerStorageService;
  let guard: UserAwareThrottlerGuard;

  beforeEach(() => {
    storage = new ThrottlerStorageService();
    guard = new UserAwareThrottlerGuard(
      { throttlers: [{ ttl: 60_000, limit: 1 }] },
      storage,
      new Reflector(),
    );
  });

  afterEach(() => {
    storage.onApplicationShutdown();
  });

  it("인증한 사용자는 IP를 바꿔도 같은 한도를 쓴다", async () => {
    // Given
    await guard.canActivate(requestContext("198.51.100.1", "user-1"));
    // When
    const activation = guard.canActivate(requestContext("198.51.100.2", "user-1"));
    // Then
    await expect(activation).rejects.toThrow(ThrottlerException);
  });

  it("같은 IP를 쓰는 다른 사용자는 한도를 나누지 않는다", async () => {
    // Given
    await guard.canActivate(requestContext("198.51.100.1", "user-1"));
    // When
    const activation = guard.canActivate(requestContext("198.51.100.1", "user-2"));
    // Then
    await expect(activation).resolves.toBe(true);
  });

  it.each([
    { name: "같은 IP", secondIp: "198.51.100.1", throttled: true },
    { name: "다른 IP", secondIp: "198.51.100.2", throttled: false },
  ])("인증 전 요청은 IP로 세어 $name는 막힘=$throttled", async ({ secondIp, throttled }) => {
    // Given
    await guard.canActivate(requestContext("198.51.100.1"));
    // When
    const activation = guard.canActivate(requestContext(secondIp)).then(
      () => false,
      (error: unknown) => error instanceof ThrottlerException,
    );
    // Then
    await expect(activation).resolves.toBe(throttled);
  });
});
