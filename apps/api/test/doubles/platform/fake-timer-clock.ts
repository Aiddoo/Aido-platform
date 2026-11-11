import { ClockPort } from "#api/shared/application/ports/clock.port";

/** `vi.useFakeTimers({ toFake: ["Date"] })`가 돌리는 시각을 그대로 읽는다. 캐시 TTL과 같은 시계로 움직여야 할 때 쓴다. */
export class FakeTimerClock extends ClockPort {
  now(): Temporal.Instant {
    return Temporal.Instant.fromEpochMilliseconds(Date.now());
  }
}
