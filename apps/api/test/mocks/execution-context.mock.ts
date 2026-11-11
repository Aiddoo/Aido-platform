import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";

// oxlint-disable-next-line typescript/no-extraneous-class -- Reflector가 읽을 컨트롤러 클래스 토큰이라 멤버가 없다.
class TestController {}

function testHandler(): void {}

/** Nest의 실제 ExecutionContextHost에 요청 객체를 담는다. Reflector가 읽을 handler를 바꿀 수 있다. */
export function createMockExecutionContext(options?: {
  user?: unknown;
  headers?: Record<string, string>;
  handler?: () => unknown;
}) {
  const request: Record<string, unknown> = { user: options?.user };
  if (options?.headers !== undefined) {
    request.headers = options.headers;
  }

  const context = new ExecutionContextHost(
    [request, {}],
    TestController,
    options?.handler ?? testHandler,
  );
  return { context, request };
}
