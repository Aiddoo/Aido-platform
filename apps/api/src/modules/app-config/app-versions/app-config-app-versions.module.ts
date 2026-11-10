import { Module } from "@nestjs/common";

import { AppConfigModule as EnvironmentConfigModule } from "#api/platform/config/index";

import { APP_CONFIG_APP_VERSIONS_PROVIDERS } from "./app-config-app-versions.providers.js";
import { AppVersionController } from "./presentation/http/v1/app-version.controller.js";

@Module({
  imports: [EnvironmentConfigModule],
  controllers: [AppVersionController],
  providers: [...APP_CONFIG_APP_VERSIONS_PROVIDERS],
})
export class AppConfigAppVersionsModule {}
