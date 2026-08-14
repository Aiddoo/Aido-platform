import { Inject, Injectable } from "@nestjs/common";

import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";

import type { SchedulerDedupPort } from "../../application/ports/scheduler-dedup.port";
import { SCHEDULER_DEDUP_TTL_MS, SchedulerDedupKey } from "../cache/scheduler-dedup.keyspace";

@Injectable()
export class SchedulerDedupAdapter implements SchedulerDedupPort {
	constructor(@Inject(DEDUP_PROVIDER) private readonly dedupProvider: IDedupProvider) {}

	hasWinbackStage(userId: string, stage: string): Promise<boolean> {
		return this.dedupProvider.isMember(SchedulerDedupKey.winbackStages(userId), stage);
	}

	async recordWinbackStages(records: Array<{ userId: string; stage: string }>): Promise<void> {
		await Promise.all(
			records.map(({ userId, stage }) =>
				this.dedupProvider.addMembers(
					SchedulerDedupKey.winbackStages(userId),
					[stage],
					SCHEDULER_DEDUP_TTL_MS.WINBACK_STAGES,
				),
			),
		);
	}

	findSentNudgePairs(weekId: string, pairs: string[]): Promise<Set<string>> {
		return this.dedupProvider.filterMembers(SchedulerDedupKey.nudgeSuggest(weekId), pairs);
	}

	recordNudgePairs(weekId: string, pairs: string[]): Promise<void> {
		return this.dedupProvider.addMembers(
			SchedulerDedupKey.nudgeSuggest(weekId),
			pairs,
			SCHEDULER_DEDUP_TTL_MS.NUDGE_SUGGEST,
		);
	}
}
