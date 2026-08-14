import { cacheKey } from "@/shared/infrastructure/cache/keyspace/cache-key";

export const SCHEDULER_DEDUP_TTL_MS = {
	WINBACK_STAGES: 90 * 24 * 60 * 60_000,
	NUDGE_SUGGEST: 8 * 24 * 60 * 60_000,
} as const;

export const SchedulerDedupKey = {
	winbackStages: (userId: string) => cacheKey("scheduler", "dedup-winback-stages", userId),
	nudgeSuggest: (weekId: string) => cacheKey("scheduler", "dedup-nudge-suggest", weekId),
} as const;
