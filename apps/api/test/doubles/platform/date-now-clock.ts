import { ClockPort } from "#api/shared/application/ports/clock.port";

// vi.setSystemTime으로 시각을 고정하는 옛 spec이 쓴다. 새 spec은 FixedClock을 쓴다
export class DateNowClock extends ClockPort {
  now(): Temporal.Instant {
    return Temporal.Instant.fromEpochMilliseconds(Date.now());
  }
}
