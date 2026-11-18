import { Module } from "@nestjs/common";

import { OperationsAdminNoticesModule } from "./admin-notices/operations-admin-notices.module.js";
import { OperationsBroadcastCampaignsModule } from "./broadcast-campaigns/operations-broadcast-campaigns.module.js";

@Module({
  imports: [OperationsBroadcastCampaignsModule, OperationsAdminNoticesModule],
  exports: [OperationsAdminNoticesModule],
})
export class OperationsModule {}
