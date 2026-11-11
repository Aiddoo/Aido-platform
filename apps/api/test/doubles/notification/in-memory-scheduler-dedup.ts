import { SchedulerDedupPort } from "#api/modules/notification/reminders/application/ports/scheduler-dedup.port";

// win-back 단계와 주별 넛지 쌍 발송 기록을 메모리에 둔다
export class InMemorySchedulerDedup extends SchedulerDedupPort {
  readonly #winbackStages = new Set<string>();
  readonly #nudgePairsByWeek = new Map<string, Set<string>>();

  async hasWinbackStage(userId: string, stage: string): Promise<boolean> {
    return this.#winbackStages.has(`${userId}:${stage}`);
  }

  async recordWinbackStages(records: Array<{ userId: string; stage: string }>): Promise<void> {
    for (const { userId, stage } of records) {
      this.#winbackStages.add(`${userId}:${stage}`);
    }
  }

  async findSentNudgePairs(weekId: string, pairs: string[]): Promise<Set<string>> {
    const sent = this.#nudgePairsByWeek.get(weekId) ?? new Set<string>();
    return new Set(pairs.filter((pair) => sent.has(pair)));
  }

  async recordNudgePairs(weekId: string, pairs: string[]): Promise<void> {
    const sent = this.#nudgePairsByWeek.get(weekId) ?? new Set<string>();
    for (const pair of pairs) {
      sent.add(pair);
    }
    this.#nudgePairsByWeek.set(weekId, sent);
  }

  nudgePairsOf(weekId: string): string[] {
    return [...(this.#nudgePairsByWeek.get(weekId) ?? [])].toSorted();
  }
}
