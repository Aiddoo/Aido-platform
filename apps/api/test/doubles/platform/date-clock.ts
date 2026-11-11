import { ClockPort } from "#api/shared/application/ports/clock.port";

// 통합·E2E 앱과 vi.setSystemTime으로 시각을 고정하는 옛 spec의 시계다. vi.setSystemTime({ toFake: ["Date"] })가 Temporal.Now에는 닿지 않아 Date를 따라간다
export class DateClock extends ClockPort {
  now(): Temporal.Instant {
    return Temporal.Instant.fromEpochMilliseconds(Date.now());
  }
}
