import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthController } from "./health.controller.js";
import { DatabaseHealthIndicator } from "./indicators/database.health.js";
import { JobRuntimeHealthIndicator } from "./indicators/job-runtime.health.js";

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, JobRuntimeHealthIndicator],
})
export class HealthModule {}
