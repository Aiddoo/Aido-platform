import type { Provider } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";

import { AppReleaseReaderPort } from "./application/ports/app-release.reader.port.js";
import { GetAppVersionUseCase } from "./application/use-cases/get-app-version.use-case.js";
import { EnvironmentAppReleaseAdapter } from "./infrastructure/adapters/environment-app-release.adapter.js";

export const APP_CONFIG_APP_VERSIONS_PROVIDERS = [
  { provide: AppReleaseReaderPort, useClass: EnvironmentAppReleaseAdapter },
  provideUseCase(GetAppVersionUseCase, { appReleaseReader: AppReleaseReaderPort }),
] satisfies Provider[];
