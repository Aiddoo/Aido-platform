import { Global, Module } from "@nestjs/common";

import { DrizzleUsageMeterAdapter } from "./adapters/drizzle-usage-meter.adapter.js";
import { UsageMeterPort } from "./usage-meter.port.js";
import { UsageRetentionJob } from "./usage-retention.job.js";

@Global()
@Module({
  providers: [{ provide: UsageMeterPort, useClass: DrizzleUsageMeterAdapter }, UsageRetentionJob],
  exports: [UsageMeterPort],
})
export class MeteringModule {}
