import { ClockPort } from "#api/shared/application/ports/clock.port";

export class FixedClock extends ClockPort {
  #instant: Temporal.Instant;

  constructor(instant: Temporal.Instant) {
    super();
    this.#instant = instant;
  }

  now(): Temporal.Instant {
    return this.#instant;
  }

  advanceBy(duration: Temporal.DurationLike): void {
    this.#instant = this.#instant.add(duration);
  }
}
