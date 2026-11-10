import { vi } from "vitest";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

type LogMethod = ApplicationLoggerPort["log"];

// 로그 호출 자체를 확인하는 spec용. 새 spec은 남긴 메시지를 모으는 SilentLogger를 쓴다
export function createSpyLogger() {
  return {
    log: vi.fn<LogMethod>(),
    debug: vi.fn<LogMethod>(),
    warn: vi.fn<LogMethod>(),
    error: vi.fn<LogMethod>(),
  } satisfies ApplicationLoggerPort;
}
