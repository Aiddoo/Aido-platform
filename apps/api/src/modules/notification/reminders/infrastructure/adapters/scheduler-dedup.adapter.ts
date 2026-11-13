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

  async findSentWinbackStages(
    records: ReadonlyArray<{ userId: string; stage: string }>,
  ): Promise<Set<string>> {
    const sent = await this.#dedupProvider.filterEntries(records.map(toWinbackStageEntry));
    return new Set(sent.map(({ userId }) => userId));
  }

  recordWinbackStages(records: Array<{ userId: string; stage: string }>): Promise<void> {
    return this.#dedupProvider.addEntries(
      records.map(toWinbackStageEntry),
      SCHEDULER_DEDUP_TTL_MS.WINBACK_STAGES,
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

// 단계 기록은 사용자마다 따로인 Set이다(키를 바꾸면 이미 보낸 단계 기록을 잃는다)
function toWinbackStageEntry(record: { readonly userId: string; readonly stage: string }) {
  return {
    ...record,
    setKey: SchedulerDedupKey.winbackStages(record.userId),
    member: record.stage,
  };
}
