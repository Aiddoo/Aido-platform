import { Module } from "@nestjs/common";

import { OPERATIONS_METRICS_PROVIDERS } from "./operations-metrics.providers.js";
import { GrowthController } from "./presentation/http/v1/growth.controller.js";

@Module({
  controllers: [GrowthController],
  providers: [...OPERATIONS_METRICS_PROVIDERS],
})
export class OperationsMetricsModule {}
