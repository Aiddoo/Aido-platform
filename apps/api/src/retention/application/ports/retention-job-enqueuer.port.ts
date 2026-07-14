export const RETENTION_JOB_ENQUEUER = Symbol("RETENTION_JOB_ENQUEUER");

export interface RetentionJobEnqueuerPort {
	enqueueDispatch(outboxId: string): Promise<void>;
}
