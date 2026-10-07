import { vi } from "vitest";

import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

// CLS 기반 repository가 transaction을 읽으므로 콜백에는 별도 client를 전달하지 않는다.
export function createUnitOfWorkMock(): UnitOfWorkPort {
  const run = vi.fn();
  run.mockImplementation((work: () => Promise<unknown>) => work());
  return { run };
}
