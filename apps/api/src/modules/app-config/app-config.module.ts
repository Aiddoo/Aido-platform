import { Module } from "@nestjs/common";

import { AppConfigAppVersionsModule } from "./app-versions/app-config-app-versions.module.js";
import { AppConfigFeatureDiscoveryModule } from "./feature-discovery/app-config-feature-discovery.module.js";

@Module({
  imports: [AppConfigAppVersionsModule, AppConfigFeatureDiscoveryModule],
})
export class AppConfigModule {}
