const DEFAULT_MAX_KEYS = 1000;

/**
 * 고정 길이 창 안에서 키별로 센다. 창이 지나면 모든 키를 0부터 다시 센다.
 * 키 수에 상한이 있어 사용자·요청 수에 비례해 커지지 않는다. 상한을 넘은 새 키는 저장하지 않고 1로 센다.
 */
export class WindowedCounter {
  readonly #windowMs: number;
  readonly #maxKeys: number;
  readonly #counts = new Map<string, number>();
  #windowStartedAtMs: number | null = null;

  constructor(windowMs: number, maxKeys: number = DEFAULT_MAX_KEYS) {
    this.#windowMs = windowMs;
    this.#maxKeys = maxKeys;
  }

  /** 이번 창에서 그 키의 누적 횟수(이번 것 포함)를 돌려준다. */
  add(key: string, nowMs: number): number {
    if (this.#windowStartedAtMs == null || nowMs - this.#windowStartedAtMs >= this.#windowMs) {
      this.#counts.clear();
      this.#windowStartedAtMs = nowMs;
    }
    const previous = this.#counts.get(key);
    if (previous == null && this.#counts.size >= this.#maxKeys) {
      return 1;
    }
    const count = (previous ?? 0) + 1;
    this.#counts.set(key, count);
    return count;
  }
}
