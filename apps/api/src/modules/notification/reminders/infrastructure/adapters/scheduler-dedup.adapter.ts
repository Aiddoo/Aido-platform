import { Injectable } from "@nestjs/common";

import { DedupProviderPort } from "#api/platform/dedup/dedup-provider.port";

import { SchedulerDedupPort } from "../../application/ports/scheduler-dedup.port.js";
import { SCHEDULER_DEDUP_TTL_MS, SchedulerDedupKey } from "../cache/scheduler-dedup.keyspace.js";

@Injectable()
export class SchedulerDedupAdapter extends SchedulerDedupPort {
  readonly #dedupProvider: DedupProviderPort;

  constructor(dedupProvider: DedupProviderPort) {
    super();
    this.#dedupProvider = dedupProvider;
  }

  hasWinbackStage(userId: string, stage: string): Promise<boolean> {
    return this.#dedupProvider.isMember(SchedulerDedupKey.winbackStages(userId), stage);
  }

  async recordWinbackStages(records: Array<{ userId: string; stage: string }>): Promise<void> {
    await Promise.all(
      records.map(({ userId, stage }) =>
        this.#dedupProvider.addMembers(
          SchedulerDedupKey.winbackStages(userId),
          [stage],
          SCHEDULER_DEDUP_TTL_MS.WINBACK_STAGES,
        ),
      ),
    );
  }

  findSentNudgePairs(weekId: string, pairs: string[]): Promise<Set<string>> {
    return this.#dedupProvider.filterMembers(SchedulerDedupKey.nudgeSuggest(weekId), pairs);
  }

  recordNudgePairs(weekId: string, pairs: string[]): Promise<void> {
    return this.#dedupProvider.addMembers(
      SchedulerDedupKey.nudgeSuggest(weekId),
      pairs,
      SCHEDULER_DEDUP_TTL_MS.NUDGE_SUGGEST,
    );
  }
}
