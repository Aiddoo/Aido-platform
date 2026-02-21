import type { CurrentUserPayload } from "@aido/validators";
import { ExecutionContext } from "@nestjs/common";

interface MockExecutionContextResult {
	context: ExecutionContext;
	request: Record<string, unknown>;
}

/**
 * Guard 테스트용 ExecutionContext mock 팩토리
 *
 * @example
 * // user 없이 (jwt-auth.guard)
 * const { context } = createMockExecutionContext();
 *
 * // user 포함 (admin.guard, ai-usage.guard)
 * const { context, request } = createMockExecutionContext({ user: mockUser });
 */
export function createMockExecutionContext(options?: {
	user?: CurrentUserPayload;
}): MockExecutionContextResult {
	const request: Record<string, unknown> = { user: options?.user };

	const context = {
		switchToHttp: () => ({
			getRequest: () => request,
		}),
		getHandler: () => ({}),
		getClass: () => ({}),
	} as unknown as ExecutionContext;

	return { context, request };
}
