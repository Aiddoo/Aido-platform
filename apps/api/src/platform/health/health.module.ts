import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthController } from "./health.controller.js";
import { BullHealthIndicator } from "./indicators/bull.health.js";
import { DatabaseHealthIndicator } from "./indicators/database.health.js";

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, BullHealthIndicator],
})
export class HealthModule {}
