import type { RetentionRepositoryPort } from "@/retention/application/ports/retention.repository.port";

export function createRetentionRepositoryMock(): RetentionRepositoryPort {
	return {
		enroll: jest.fn(),
		activate: jest.fn(),
		findScheduledStages: jest.fn(),
		markStageSkipped: jest.fn(),
		createDelivery: jest.fn(),
		recordD7Result: jest.fn(),
		recoverStaleOutboxes: jest.fn(),
		claimOutboxes: jest.fn(),
		markOutboxPublished: jest.fn(),
		deferOutbox: jest.fn(),
		markOutboxFailed: jest.fn(),
		claimDispatch: jest.fn(),
		releaseDispatch: jest.fn(),
		markDispatchSkipped: jest.fn(),
		recordDeliveryResults: jest.fn(),
	};
}
