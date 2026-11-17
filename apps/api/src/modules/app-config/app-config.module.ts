import { Module } from "@nestjs/common";

import { AppConfigAppReleasesAdminModule } from "./app-releases/app-config-app-releases-admin.module.js";
import { AppConfigAppReleasesModule } from "./app-releases/app-config-app-releases.module.js";
import { AppConfigFeatureDiscoveryCampaignsModule } from "./feature-discovery-campaigns/app-config-feature-discovery-campaigns.module.js";

@Module({
  imports: [
    AppConfigAppReleasesModule,
    AppConfigAppReleasesAdminModule,
    AppConfigFeatureDiscoveryCampaignsModule,
  ],
})
export class AppConfigModule {}
