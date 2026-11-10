import { Module } from "@nestjs/common";

import { ADMIN_GROWTH_METRICS } from "./application/ports/growth-metrics.reader.port.js";
import { GetGrowthSummary } from "./application/use-cases/get-growth-summary.use-case.js";
import { DrizzleAdminGrowthMetricsAdapter } from "./infrastructure/persistence/drizzle-growth-metrics.reader.js";
import { AdminGrowthController } from "./presentation/http/v1/growth.controller.js";

@Module({
  controllers: [AdminGrowthController],
  providers: [
    { provide: ADMIN_GROWTH_METRICS, useClass: DrizzleAdminGrowthMetricsAdapter },
    {
      provide: GetGrowthSummary,
      inject: [ADMIN_GROWTH_METRICS],
      useFactory: (metrics: ConstructorParameters<typeof GetGrowthSummary>[0]["metrics"]) =>
        new GetGrowthSummary({ metrics }),
    },
  ],
})
export class OperationsMetricsModule {}
