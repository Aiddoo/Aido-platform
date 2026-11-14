import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { appConfigAppVersionsConfig } from "./app-config-app-versions.config.js";
import { APP_CONFIG_APP_VERSIONS_PROVIDERS } from "./app-config-app-versions.providers.js";
import { AppReleaseRepositoryPort } from "./application/ports/app-release.repository.port.js";
import { AppVersionController } from "./presentation/http/v1/app-version.controller.js";

@Module({
  imports: [ConfigModule.forFeature(appConfigAppVersionsConfig)],
  controllers: [AppVersionController],
  providers: [...APP_CONFIG_APP_VERSIONS_PROVIDERS],
  exports: [AppReleaseRepositoryPort],
})
export class AppConfigAppVersionsModule {}
