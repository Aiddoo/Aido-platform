import { SchedulerDeduplicationPort } from "#api/modules/notification/reminders/application/ports/scheduler-deduplication.port";
import type { NudgePairMark } from "#api/modules/notification/reminders/domain/nudge-pair-mark.vo";
import type { WinbackStageMark } from "#api/modules/notification/reminders/domain/winback-stage-mark.vo";

// win-back 단계와 주별 넛지 쌍 발송 표시를 메모리에 두고 값으로 비교한다
export class InMemorySchedulerDeduplication extends SchedulerDeduplicationPort {
  readonly #winbackStages: WinbackStageMark[] = [];
  readonly #nudgePairs: NudgePairMark[] = [];

  async filterUnsentWinbackStages(marks: readonly WinbackStageMark[]): Promise<WinbackStageMark[]> {
    return marks.filter((mark) => !this.#winbackStages.some((sent) => sent.equals(mark)));
  }

  async recordWinbackStages(marks: readonly WinbackStageMark[]): Promise<void> {
    this.#winbackStages.push(...marks);
  }

  async filterUnsentNudgePairs(marks: readonly NudgePairMark[]): Promise<NudgePairMark[]> {
    return marks.filter((mark) => !this.#nudgePairs.some((sent) => sent.equals(mark)));
  }

  async recordNudgePairs(marks: readonly NudgePairMark[]): Promise<void> {
    this.#nudgePairs.push(...marks);
  }

  nudgePairsOf(weekId: string): string[] {
    return this.#nudgePairs
      .filter((mark) => mark.weekId === weekId)
      .map((mark) => `${mark.recipientId.value}:${mark.friendId.value}`)
      .toSorted();
  }
}
