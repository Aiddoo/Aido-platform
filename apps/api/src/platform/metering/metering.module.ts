import { Global, Module } from "@nestjs/common";

import { DrizzleUsageMeterAdapter } from "./adapters/drizzle-usage-meter.adapter.js";
import { USAGE_METER } from "./interfaces/usage-meter.interface.js";
import { UsageRetentionJob } from "./usage-retention.job.js";

@Global()
@Module({
  providers: [{ provide: USAGE_METER, useClass: DrizzleUsageMeterAdapter }, UsageRetentionJob],
  exports: [USAGE_METER],
})
export class MeteringModule {}
