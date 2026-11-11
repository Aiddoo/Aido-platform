import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";

import { DAILY_THROTTLER_OPTIONS, ThrottleDaily } from "./user-aware-throttler.guard.js";

class Routes {
  @ThrottleDaily(30)
  limited(): void {}

  free(): void {}
}

function contextOf(handler: () => void): ExecutionContextHost {
  return new ExecutionContextHost([], Routes, handler);
}

describe("하루 한도 throttler", () => {
  it.each([
    { name: "붙인 라우트", handler: Routes.prototype.limited, skipped: false },
    { name: "붙이지 않은 라우트", handler: Routes.prototype.free, skipped: true },
  ])("$name은 건너뜀=$skipped", ({ handler, skipped }) => {
    // Given
    const context = contextOf(handler);
    // When
    const result = DAILY_THROTTLER_OPTIONS.skipIf?.(context);
    // Then
    expect(result).toBe(skipped);
  });
});
