import { vi } from "vitest";

import type { RetentionRepositoryPort } from "#api/retention/application/ports/retention.repository.port";

export function createRetentionRepositoryMock(): RetentionRepositoryPort {
	return {
		enroll: vi.fn(),
		activate: vi.fn(),
		findScheduledStages: vi.fn(),
		markStageSkipped: vi.fn(),
		createDelivery: vi.fn(),
		recordD7Result: vi.fn(),
		recoverStaleOutboxes: vi.fn(),
		recoverStaleDispatches: vi.fn(),
		claimOutboxes: vi.fn(),
		markOutboxPublished: vi.fn(),
		deferOutbox: vi.fn(),
		markOutboxFailed: vi.fn(),
		claimDispatch: vi.fn(),
		releaseDispatchForRetry: vi.fn(),
		reopenUnclaimedDispatch: vi.fn(),
		markRateLimitReserved: vi.fn(),
		markDispatchSkipped: vi.fn(),
		recordDeliveryResults: vi.fn(),
	};
}
