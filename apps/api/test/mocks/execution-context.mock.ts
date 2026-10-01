import type { ExecutionContext } from "@nestjs/common";
import { mockDeep } from "vitest-mock-extended";

export function createMockExecutionContext(options?: {
	user?: unknown;
	headers?: Record<string, string>;
}) {
	const request: Record<string, unknown> = { user: options?.user };
	if (options?.headers !== undefined) {
		request.headers = options.headers;
	}

	const context = mockDeep<ExecutionContext>();
	const http = mockDeep<ReturnType<ExecutionContext["switchToHttp"]>>();
	http.getRequest.mockReturnValue(request);
	context.switchToHttp.mockReturnValue(http);
	context.getHandler.mockReturnValue(() => undefined);
	context.getClass.mockReturnValue(class TestController {});
	return { context, request };
}
