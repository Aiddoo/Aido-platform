import { Reflector } from "@nestjs/core";
import { lastValueFrom, of } from "rxjs";

import { createMockExecutionContext } from "../../../../test/mocks/execution-context.mock.js";
import { RawResponse } from "../decorators/index.js";
import { ResponseTransformInterceptor } from "./response-transform.interceptor.js";

class ResponseFixture {
	@RawResponse()
	raw(): void {}

	wrapped(): void {}
}

describe("ResponseTransformInterceptor", () => {
	it("bypasses the success wrapper only for an explicitly raw handler", async () => {
		// Given
		const { context } = createMockExecutionContext();
		context.getHandler.mockReturnValue(ResponseFixture.prototype.raw);
		const interceptor = new ResponseTransformInterceptor<{ enabled: false }>(new Reflector());

		// When
		const result = await lastValueFrom(
			interceptor.intercept(context, { handle: () => of({ enabled: false }) }),
		);

		// Then
		expect(result).toEqual({ enabled: false });
	});

	it("preserves the wrapper for an unannotated handler", async () => {
		// Given
		const { context } = createMockExecutionContext();
		context.getHandler.mockReturnValue(ResponseFixture.prototype.wrapped);
		const interceptor = new ResponseTransformInterceptor<{ value: string }>(new Reflector());

		// When
		const result = await lastValueFrom(
			interceptor.intercept(context, {
				handle: () => of({ value: "ordinary" }),
			}),
		);

		// Then
		expect(result).toMatchObject({
			success: true,
			data: { value: "ordinary" },
		});
		expect("timestamp" in result).toBe(true);
	});
});
