import { ThrottlerGuard } from "@nestjs/throttler";
import { vi } from "vitest";

import { TestDatabase } from "../setup/test-database.js";
import { createE2eApp } from "./helpers/e2e-app-factory.js";

const realCanActivate = ThrottlerGuard.prototype.canActivate;

describe("E2E 앱 factory의 throttler 생명주기 실패", () => {
  it("DB setup 시작이 실패해도 원래 오류를 유지하고 전역 guard를 변경하지 않는다", async () => {
    // Given - real throttler opt-in 직후 DB setup이 실패
    const setupError = new Error("fault: test database start");
    vi.spyOn(TestDatabase.prototype, "start").mockRejectedValueOnce(setupError);

    await expect(createE2eApp({ withRealThrottler: true })).rejects.toBe(setupError);
    expect(ThrottlerGuard.prototype.canActivate).toBe(realCanActivate);
  });

  it("application teardown이 실패해도 aggregate 오류를 유지하고 전역 guard를 변경하지 않는다", async () => {
    // Given - 정상 생성된 real-throttler app
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

      // Then - teardown 오류를 보존한 AggregateError + bypass 복원
      await expect(closing).rejects.toEqual(
        expect.objectContaining({
          errors: [teardownError],
          message: "Failed to close E2E app resources",
        }),
      );
      expect(ThrottlerGuard.prototype.canActivate).toBe(realCanActivate);
    } finally {
      await ctx.closeTestResources();
    }
  });
});
