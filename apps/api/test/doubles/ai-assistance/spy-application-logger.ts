import { vi } from "vitest";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

// 로그 키·필드가 계약인 AI 관측 테스트(개인정보 비노출 포함)가 호출 인자를 확인한다
export function createSpyApplicationLogger() {
  return {
    log: vi.fn<ApplicationLoggerPort["log"]>(),
    debug: vi.fn<ApplicationLoggerPort["debug"]>(),
    warn: vi.fn<ApplicationLoggerPort["warn"]>(),
    error: vi.fn<ApplicationLoggerPort["error"]>(),
  };
}
