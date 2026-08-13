import { Inject, Injectable } from "@nestjs/common";
import { DedupKeys } from "@/shared/infrastructure/dedup/constants/dedup-keys";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import type { SchedulerDedupPort } from "../../application/ports/scheduler-dedup.port";

@Injectable()
export class SchedulerDedupAdapter implements SchedulerDedupPort {
	constructor(
		@Inject(DEDUP_PROVIDER) private readonly dedupProvider: IDedupProvider,
	) {}

	hasWinbackStage(userId: string, stage: string): Promise<boolean> {
		return this.dedupProvider.isMember(DedupKeys.winbackStages(userId), stage);
	}

	async recordWinbackStages(
		records: Array<{ userId: string; stage: string }>,
	): Promise<void> {
		await Promise.all(
			records.map(({ userId, stage }) =>
				this.dedupProvider.addMembers(
					DedupKeys.winbackStages(userId),
					[stage],
					DedupKeys.TTL.WINBACK_STAGES,
				),
			),
		);
	}

	findSentNudgePairs(weekId: string, pairs: string[]): Promise<Set<string>> {
		return this.dedupProvider.filterMembers(
			DedupKeys.nudgeSuggestSent(weekId),
			pairs,
		);
	}

	recordNudgePairs(weekId: string, pairs: string[]): Promise<void> {
		return this.dedupProvider.addMembers(
			DedupKeys.nudgeSuggestSent(weekId),
			pairs,
			DedupKeys.TTL.NUDGE_SUGGEST,
		);
	}
}
