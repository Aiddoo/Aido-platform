import { Global, Module } from "@nestjs/common";

import { DrizzleUsageMeterAdapter } from "./adapters/drizzle-usage-meter.adapter.js";
import { USAGE_METER } from "./interfaces/usage-meter.interface.js";
import { UsageRetentionJob } from "./usage-retention.job.js";

/** 외부 호출 누적 사용량(OutboundUsage)을 전역으로 제공한다. */
@Global()
@Module({
  providers: [{ provide: USAGE_METER, useClass: DrizzleUsageMeterAdapter }, UsageRetentionJob],
  exports: [USAGE_METER],
})
export class MeteringModule {}
