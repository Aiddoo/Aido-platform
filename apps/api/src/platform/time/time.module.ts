import { Global, Module } from "@nestjs/common";

import { ClockPort } from "#api/shared/application/ports/clock.port";

import { SystemClock } from "./system-clock.js";

@Global()
@Module({
  providers: [{ provide: ClockPort, useClass: SystemClock }],
  exports: [ClockPort],
})
export class TimeModule {}
