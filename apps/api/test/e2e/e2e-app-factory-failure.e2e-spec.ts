import { ThrottlerGuard } from "@nestjs/throttler";
import { vi } from "vitest";

import { TestDatabase } from "../setup/test-database.js";
import { createE2eApp } from "./helpers/e2e-app-factory.js";

const realCanActivate = ThrottlerGuard.prototype.canActivate;

describe("E2E 앱 factory의 throttler 생명주기 실패", () => {
  it("DB setup 시작이 실패해도 원래 오류를 유지하고 전역 guard를 변경하지 않는다", async () => {
    // Given
    const setupError = new Error("fault: test database start");
    vi.spyOn(TestDatabase.prototype, "start").mockRejectedValueOnce(setupError);

    // When
    const creating = createE2eApp({ withRealThrottler: true });

    // Then
    await expect(creating).rejects.toBe(setupError);
    expect(ThrottlerGuard.prototype.canActivate).toBe(realCanActivate);
  });

  it("application teardown이 실패해도 원래 오류를 유지하고 전역 guard를 변경하지 않는다", async () => {
    // Given
    const ctx = await createE2eApp({ withRealThrottler: true });
    const teardownError = new Error("fault: application close");
    const closeApplication = ctx.app.close.bind(ctx.app);
    vi.spyOn(ctx.app, "close").mockImplementation(async () => {
      await closeApplication();
      throw teardownError;
    });

    try {
      // When
      const closing = ctx.closeApplicationResources();

      // Then
      await expect(closing).rejects.toBe(teardownError);
      expect(ThrottlerGuard.prototype.canActivate).toBe(realCanActivate);
    } finally {
      await ctx.closeTestResources();
    }
  });
});
