import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import { ThrottlerStorageService } from "@nestjs/throttler";

import { DAILY_THROTTLER_OPTIONS, RateLimit } from "./rate-limits.js";
import { UserAwareThrottlerGuard } from "./user-aware-throttler.guard.js";

class Routes {
  @RateLimit({ limitPerMinute: 4, limitPerDay: 30 })
  perMinuteAndDay(): void {}

  @RateLimit({ limitPerHour: 3 })
  perHour(): void {}
}

function contextRecordingHeaders(handler: () => void) {
  const headers = new Map<string, unknown>();
  const response = { header: (name: string, value: unknown) => headers.set(name, value) };
  const request = { ip: "198.51.100.1", headers: {} };
  return { context: new ExecutionContextHost([request, response], Routes, handler), headers };
}

describe("RateLimit — 라우트 요청 한도", () => {
  let storage: ThrottlerStorageService;
  let guard: UserAwareThrottlerGuard;

  beforeEach(() => {
    storage = new ThrottlerStorageService();
    guard = new UserAwareThrottlerGuard(
      { throttlers: [{ ttl: 60_000, limit: 100 }, DAILY_THROTTLER_OPTIONS] },
      storage,
      new Reflector(),
    );
  });

  afterEach(() => {
    storage.onApplicationShutdown();
  });

  it.each([
    { name: "분 한도", handler: Routes.prototype.perMinuteAndDay, limit: 4, windowSeconds: 60 },
    { name: "시간 한도", handler: Routes.prototype.perHour, limit: 3, windowSeconds: 3600 },
  ])("$name는 그 길이의 창에서 기본 한도를 바꾼다", async ({ handler, limit, windowSeconds }) => {
    // Given
    const { context, headers } = contextRecordingHeaders(handler);
    // When
    await guard.canActivate(context);
    // Then
    expect(headers.get("X-RateLimit-Limit")).toBe(limit);
    expect(headers.get("X-RateLimit-Reset")).toBe(windowSeconds);
  });

  it.each([
    { name: "하루 한도를 정한 라우트", handler: Routes.prototype.perMinuteAndDay, daily: 30 },
    { name: "하루 한도가 없는 라우트", handler: Routes.prototype.perHour, daily: undefined },
  ])("$name의 하루 한도는 $daily이다", async ({ handler, daily }) => {
    // Given
    const { context, headers } = contextRecordingHeaders(handler);
    // When
    await guard.canActivate(context);
    // Then
    expect(headers.get("X-RateLimit-Limit-daily")).toBe(daily);
  });
});
