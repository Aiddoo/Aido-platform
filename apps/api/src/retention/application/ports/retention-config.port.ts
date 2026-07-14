export const RETENTION_CONFIG = Symbol("RETENTION_CONFIG");

export interface RetentionConfigPort {
	readonly enabled: boolean;
	readonly treatmentPercent: number;
}
