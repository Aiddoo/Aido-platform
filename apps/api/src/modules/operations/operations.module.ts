import { Module } from "@nestjs/common";

import { OperationsAdminNoticesModule } from "./admin-notices/operations-admin-notices.module.js";
import { OperationsBroadcastsModule } from "./broadcasts/operations-broadcasts.module.js";
import { OperationsMetricsModule } from "./metrics/operations-metrics.module.js";

@Module({
  imports: [OperationsBroadcastsModule, OperationsAdminNoticesModule, OperationsMetricsModule],
  exports: [OperationsAdminNoticesModule],
})
export class OperationsModule {}
