import type { Provider } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { GrowthMetricsReaderPort } from "./application/ports/growth-metrics.reader.port.js";
import { GetGrowthSummaryUseCase } from "./application/use-cases/get-growth-summary.use-case.js";
import { DrizzleGrowthMetricsReader } from "./infrastructure/persistence/drizzle-growth-metrics.reader.js";

export const OPERATIONS_METRICS_PROVIDERS = [
  { provide: GrowthMetricsReaderPort, useClass: DrizzleGrowthMetricsReader },
  provideUseCase(GetGrowthSummaryUseCase, {
    metricsReader: GrowthMetricsReaderPort,
    clock: ClockPort,
  }),
] satisfies Provider[];
