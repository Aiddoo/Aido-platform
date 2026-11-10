import { vi } from "vitest";

import type { RetentionRepositoryPort } from "#api/modules/notification/retention/application/ports/retention.repository.port";

export function createRetentionRepositoryMock(): RetentionRepositoryPort {
  return {
    enroll: vi.fn(),
    activate: vi.fn(),
    findScheduledStages: vi.fn(),
    markStageSkipped: vi.fn(),
    markStageOutboxed: vi.fn(),
    linkStageNotification: vi.fn(),
    recordD7Result: vi.fn(),
  };
}
