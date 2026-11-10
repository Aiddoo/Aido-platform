import { LRUCache } from "lru-cache";

import { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  type OperationalAlert,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Sentry 무료 플랜 오류 한도(월 5,000건) 안에서 경보를 보내는 기준.
 * 다시 보내는 경보 상한(시간당 2건)이 한 달 내내 차도 1,440건이라 5xx 보고 몫이 남는다.
 */
export const OPERATIONAL_ALERT_LIMITS = {
  repeatIntervalMs: HOUR_MS,
  maxRepeatsPerHour: 2,
  maxTrackedKeys: 1_000,
} as const;

/**
 * 운영 경보를 key 단위로 줄여 다음 어댑터에 넘긴다. Sentry 알림 규칙은 새 이슈·재발에만 알리므로
 * key의 첫 경보는 늘 보내고, 같은 key는 한 시간에 한 번, 다시 보내는 경보는 프로세스 전체에서 시간당 상한까지만 보낸다.
 * 기록은 이 프로세스 메모리에만 있어 재시작하면 key마다 한 번 더 간다.
 */
export class DeduplicatingOperationalAlertAdapter extends OperationalAlertPort {
  readonly #delegate: OperationalAlertPort;
  readonly #clock: ClockPort;
  readonly #lastRaisedAtMs = new LRUCache<string, number>({
    max: OPERATIONAL_ALERT_LIMITS.maxTrackedKeys,
  });
  #repeatWindowStartMs: number | null = null;
  #repeatsInWindow = 0;

  constructor(delegate: OperationalAlertPort, clock: ClockPort) {
    super();
    this.#delegate = delegate;
    this.#clock = clock;
  }

  raise(alert: OperationalAlert): void {
    const nowMs = this.#clock.now().epochMilliseconds;
    const lastRaisedAtMs = this.#lastRaisedAtMs.get(alert.key);
    if (lastRaisedAtMs != null && !this.#takeRepeat(nowMs, lastRaisedAtMs)) {
      return;
    }
    this.#lastRaisedAtMs.set(alert.key, nowMs);
    this.#delegate.raise(alert);
  }

  // true면 이 key를 다시 보내고 시간당 반복 몫 하나를 쓴다
  #takeRepeat(nowMs: number, lastRaisedAtMs: number): boolean {
    if (nowMs - lastRaisedAtMs < OPERATIONAL_ALERT_LIMITS.repeatIntervalMs) {
      return false;
    }
    if (this.#repeatWindowStartMs == null || nowMs - this.#repeatWindowStartMs >= HOUR_MS) {
      this.#repeatWindowStartMs = nowMs;
      this.#repeatsInWindow = 0;
    }
    if (this.#repeatsInWindow >= OPERATIONAL_ALERT_LIMITS.maxRepeatsPerHour) {
      return false;
    }
    this.#repeatsInWindow += 1;
    return true;
  }
}
