import { SweepCursorPort } from "#api/shared/application/ports/sweep-cursor.port";

// 실제 어댑터처럼 더 이른 시각으로는 되돌리지 않는다. 표시한 순서를 남겨 분 처리 순서를 확인한다
export class InMemorySweepCursor extends SweepCursorPort {
  readonly #completed = new Map<string, Temporal.Instant>();
  readonly marked: Temporal.Instant[] = [];

  async findLastCompletedAt(key: string): Promise<Temporal.Instant | null> {
    return this.#completed.get(key) ?? null;
  }

  async markCompleted(key: string, at: Temporal.Instant): Promise<void> {
    this.marked.push(at);
    const current = this.#completed.get(key);
    if (current == null || Temporal.Instant.compare(at, current) > 0) {
      this.#completed.set(key, at);
    }
  }
}
