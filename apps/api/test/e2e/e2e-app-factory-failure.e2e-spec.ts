import { TestDatabase } from "../setup/test-database";
import { createE2eApp } from "./helpers/e2e-app-factory";
import {
	bypassE2eThrottler,
	isE2eThrottlerBypassed,
} from "./helpers/e2e-throttler-control";

describe("E2E app factory throttler lifecycle failures", () => {
	it("DB setup 시작이 실패해도 원래 오류를 유지하고 ordinary bypass를 복원한다", async () => {
		// Given - real throttler opt-in 직후 DB setup이 실패
		const setupError = new Error("fault: test database start");
		jest
			.spyOn(TestDatabase.prototype, "start")
			.mockRejectedValueOnce(setupError);

		try {
			// When/Then - setup 오류를 다른 cleanup 오류로 가리지 않음
			await expect(createE2eApp({ withRealThrottler: true })).rejects.toBe(
				setupError,
			);
			expect(isE2eThrottlerBypassed()).toBe(true);
		} finally {
			bypassE2eThrottler();
		}
	});

	it("application teardown이 실패해도 aggregate 오류를 유지하고 ordinary bypass를 복원한다", async () => {
		// Given - 정상 생성된 real-throttler app
		const ctx = await createE2eApp({ withRealThrottler: true });
		const teardownError = new Error("fault: application close");
		const closeApplication = ctx.app.close.bind(ctx.app);
		jest.spyOn(ctx.app, "close").mockImplementation(async () => {
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
			expect(isE2eThrottlerBypassed()).toBe(true);
		} finally {
			bypassE2eThrottler();
			await ctx.closeTestResources();
		}
	});
});
