import { delay } from "es-toolkit";

interface PushThroughputLimiterOptions {
  readonly messagesPerSecond: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

/** 공급자 초당 메시지 한도를 넘지 않도록 프로세스 안의 발송을 토큰 버킷으로 직렬화한다. */
export class PushThroughputLimiterAdapter {
  readonly #capacity: number;
  readonly #tokensPerMs: number;
  readonly #now: () => number;
  readonly #sleep: (ms: number) => Promise<void>;
  #tokens: number;
  #refilledAt: number;
  #tail: Promise<void> = Promise.resolve();

  constructor(options: PushThroughputLimiterOptions) {
    this.#capacity = options.messagesPerSecond;
    this.#tokensPerMs = options.messagesPerSecond / 1000;
    this.#now = options.now ?? Date.now;
    this.#sleep = options.sleep ?? delay;
    this.#tokens = this.#capacity;
    this.#refilledAt = this.#now();
  }

  acquire(messageCount: number): Promise<void> {
    const count = Math.min(Math.max(messageCount, 0), this.#capacity);
    const acquisition = this.#tail.then(() => this.#take(count));
    this.#tail = acquisition;
    return acquisition;
  }

  async #take(count: number): Promise<void> {
    this.#refill();
    if (this.#tokens < count) {
      await this.#sleep(Math.ceil((count - this.#tokens) / this.#tokensPerMs));
      this.#refill();
    }
    this.#tokens = Math.max(this.#tokens - count, 0);
  }

  #refill(): void {
    const now = this.#now();
    this.#tokens = Math.min(
      this.#capacity,
      this.#tokens + (now - this.#refilledAt) * this.#tokensPerMs,
    );
    this.#refilledAt = now;
  }
}
