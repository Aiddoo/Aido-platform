import { Module } from "@nestjs/common";

import { APP_CONFIG_APP_RELEASES_PROVIDERS } from "./app-config-app-releases.providers.js";
import { AppReleaseRepositoryPort } from "./application/ports/app-release.repository.port.js";
import { AppVersionController } from "./presentation/http/v1/app-version.controller.js";

@Module({
  controllers: [AppVersionController],
  providers: [...APP_CONFIG_APP_RELEASES_PROVIDERS],
  exports: [AppReleaseRepositoryPort],
})
export class AppConfigAppReleasesModule {}
