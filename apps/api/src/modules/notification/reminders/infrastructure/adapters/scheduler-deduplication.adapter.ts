import { Injectable } from "@nestjs/common";
import { groupBy } from "es-toolkit";

import { DedupProviderPort } from "#api/platform/dedup/dedup-provider.port";

import { SchedulerDeduplicationPort } from "../../application/ports/scheduler-deduplication.port.js";
import type { NudgePairMark } from "../../domain/nudge-pair-mark.vo.js";
import type { WinbackStageMark } from "../../domain/winback-stage-mark.vo.js";
import {
  SCHEDULER_DEDUPLICATION_TTL_MS,
  SchedulerDeduplicationKey,
} from "../cache/scheduler-deduplication.keyspace.js";

@Injectable()
export class SchedulerDeduplicationAdapter extends SchedulerDeduplicationPort {
  readonly #dedupProvider: DedupProviderPort;

  constructor(dedupProvider: DedupProviderPort) {
    super();
    this.#dedupProvider = dedupProvider;
  }

  async filterUnsentWinbackStages(marks: readonly WinbackStageMark[]): Promise<WinbackStageMark[]> {
    const sent = await this.#dedupProvider.filterEntries(marks.map(toWinbackStageEntry));
    const sentMarks = new Set(sent.map(({ mark }) => mark));
    return marks.filter((mark) => !sentMarks.has(mark));
  }

  recordWinbackStages(marks: readonly WinbackStageMark[]): Promise<void> {
    return this.#dedupProvider.addEntries(
      marks.map(toWinbackStageEntry),
      SCHEDULER_DEDUPLICATION_TTL_MS.WINBACK_STAGES,
    );
  }

  // 보통 한 주의 표시만 오므로 주마다 SMISMEMBER 한 번이다
  async filterUnsentNudgePairs(marks: readonly NudgePairMark[]): Promise<NudgePairMark[]> {
    const unsent = await Promise.all(
      Object.entries(groupBy(marks, (mark) => mark.weekId)).map(async ([weekId, weekMarks]) => {
        const sent = await this.#dedupProvider.filterMembers(
          SchedulerDeduplicationKey.nudgeSuggest(weekId),
          weekMarks.map(toNudgePairMember),
        );
        return weekMarks.filter((mark) => !sent.has(toNudgePairMember(mark)));
      }),
    );
    const unsentMarks = new Set(unsent.flat());
    return marks.filter((mark) => unsentMarks.has(mark));
  }

  async recordNudgePairs(marks: readonly NudgePairMark[]): Promise<void> {
    await Promise.all(
      Object.entries(groupBy(marks, (mark) => mark.weekId)).map(([weekId, weekMarks]) =>
        this.#dedupProvider.addMembers(
          SchedulerDeduplicationKey.nudgeSuggest(weekId),
          weekMarks.map(toNudgePairMember),
          SCHEDULER_DEDUPLICATION_TTL_MS.NUDGE_SUGGEST,
        ),
      ),
    );
  }
}

// 단계 기록은 사용자마다 따로인 Set이다(키를 바꾸면 이미 보낸 단계 기록을 잃는다)
function toWinbackStageEntry(mark: WinbackStageMark) {
  return {
    mark,
    setKey: SchedulerDeduplicationKey.winbackStages(mark.recipientId.value),
    member: mark.stage,
  };
}

// 주별 Set의 멤버는 "받는 사람:친구"다(바꾸면 그 주 기록을 잃는다)
function toNudgePairMember(mark: NudgePairMark): string {
  return `${mark.recipientId.value}:${mark.friendId.value}`;
}
