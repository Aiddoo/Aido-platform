import { Injectable } from "@nestjs/common";

import type {
  UsageIncrement,
  UsageKey,
  UsageMeterPort,
  UsageReservation,
} from "#api/platform/metering/usage-meter.port";

interface Entry {
  used: number;
  updatedAt: Temporal.Instant;
}

// vi.setSystemTime으로 고정한 시각을 따른다
function now(): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(Date.now());
}

const keyOf = (key: UsageKey) => `${key.meter}\u0000${key.periodKey}\u0000${key.subject}`;

/** 단일 프로세스 테스트용 계량기. 운영은 Postgres 어댑터를 쓴다. */
@Injectable()
export class InMemoryUsageMeterAdapter implements UsageMeterPort {
  readonly #entries = new Map<string, Entry>();

  async add(increments: readonly UsageIncrement[]): Promise<readonly number[]> {
    for (const { key, amount } of increments) {
      this.#increase(key, amount);
    }
    return increments.map(({ key }) => this.#entries.get(keyOf(key))?.used ?? 0);
  }

  async tryReserve(key: UsageKey, amount: number, limit: number): Promise<UsageReservation> {
    const current = this.#entries.get(keyOf(key))?.used ?? 0;
    if (current + amount > limit) {
      return { isAccepted: false, total: current };
    }
    return { isAccepted: true, total: this.#increase(key, amount) };
  }

  async release(key: UsageKey, amount: number): Promise<void> {
    const entry = this.#entries.get(keyOf(key));
    if (entry == null) {
      return;
    }
    entry.used = Math.max(entry.used - amount, 0);
    entry.updatedAt = now();
  }

  async deleteSubject(subject: string): Promise<number> {
    let deleted = 0;
    for (const key of this.#entries.keys()) {
      if (key.endsWith(`\u0000${subject}`)) {
        this.#entries.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  async read(keys: readonly UsageKey[]): Promise<readonly number[]> {
    return keys.map((key) => this.#entries.get(keyOf(key))?.used ?? 0);
  }

  async prune(cutoff: Temporal.Instant): Promise<number> {
    let pruned = 0;
    for (const [key, entry] of this.#entries) {
      if (Temporal.Instant.compare(entry.updatedAt, cutoff) < 0) {
        this.#entries.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  #increase(key: UsageKey, amount: number): number {
    const entry = this.#entries.get(keyOf(key)) ?? { used: 0, updatedAt: now() };
    entry.used += amount;
    entry.updatedAt = now();
    this.#entries.set(keyOf(key), entry);
    return entry.used;
  }
}
