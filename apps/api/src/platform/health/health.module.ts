import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { RuntimeStatsSampler } from "#api/platform/observability/runtime-stats.sampler";

import { HealthController } from "./health.controller.js";
import { DatabaseHealthIndicator } from "./indicators/database.health.js";
import { JobQueueHealthIndicator } from "./indicators/job-queue.health.js";
import { OutboundHealthIndicator } from "./indicators/outbound.health.js";
import { RuntimeStatsHealthIndicator } from "./indicators/runtime-stats.health.js";

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    JobQueueHealthIndicator,
    OutboundHealthIndicator,
    RuntimeStatsSampler,
    RuntimeStatsHealthIndicator,
  ],
})
export class HealthModule {}
