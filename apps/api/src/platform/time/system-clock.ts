import { Injectable } from "@nestjs/common";

import { ClockPort } from "#api/shared/application/ports/clock.port";

@Injectable()
export class SystemClock extends ClockPort {
  now(): Temporal.Instant {
    return Temporal.Now.instant();
  }
}
