import { Module } from "@nestjs/common";

import { AppConfigModule as EnvironmentConfigModule } from "#api/platform/config/index";

import { APP_VERSION_CONFIG } from "./application/ports/app-version-config.port.js";
import { GetAppVersionUseCase } from "./application/use-cases/get-app-version.use-case.js";
import { AppVersionConfigAdapter } from "./infrastructure/adapters/app-version-config.adapter.js";
import { AppVersionController } from "./presentation/http/v1/app-version.controller.js";

@Module({
  imports: [EnvironmentConfigModule],
  controllers: [AppVersionController],
  providers: [
    AppVersionConfigAdapter,
    { provide: APP_VERSION_CONFIG, useExisting: AppVersionConfigAdapter },
    {
      provide: GetAppVersionUseCase,
      inject: [APP_VERSION_CONFIG],
      useFactory: (config: ConstructorParameters<typeof GetAppVersionUseCase>[0]["config"]) =>
        new GetAppVersionUseCase({ config }),
    },
  ],
})
export class AppConfigAppVersionsModule {}
