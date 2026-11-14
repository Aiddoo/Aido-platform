import { Module } from "@nestjs/common";

import { AppConfigAppVersionsAdminModule } from "./app-versions/app-config-app-versions-admin.module.js";
import { AppConfigAppVersionsModule } from "./app-versions/app-config-app-versions.module.js";
import { AppConfigFeatureDiscoveryModule } from "./feature-discovery/app-config-feature-discovery.module.js";

@Module({
  imports: [
    AppConfigAppVersionsModule,
    AppConfigAppVersionsAdminModule,
    AppConfigFeatureDiscoveryModule,
  ],
})
export class AppConfigModule {}
