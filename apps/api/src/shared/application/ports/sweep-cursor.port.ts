/** 분 단위 sweep이 마지막으로 끝까지 처리한 분을 기억한다. 활성 UoW 트랜잭션에 함께 쓴다. */
export abstract class SweepCursorPort {
  abstract findLastCompletedAt(key: string): Promise<Temporal.Instant | null>;
  /** 더 이른 시각으로는 되돌리지 않는다. 늦게 끝난 이전 실행이 진행을 덮어쓰지 않게 한다. */
  abstract markCompleted(key: string, at: Temporal.Instant): Promise<void>;
}
