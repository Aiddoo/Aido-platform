import type { ClaimedOutbox } from "./retention.repository.port.js";

export const RETENTION_JOB_ENQUEUER = Symbol("RETENTION_JOB_ENQUEUER");

export interface RetentionJobEnqueuerPort {
	enqueueDispatch(outbox: ClaimedOutbox): Promise<void>;
}
