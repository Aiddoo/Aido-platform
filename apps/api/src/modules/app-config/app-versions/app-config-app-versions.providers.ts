import type { Provider } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";

import { AppReleaseRepositoryPort } from "./application/ports/app-release.repository.port.js";
import { ListAppReleasesUseCase } from "./application/use-cases/list-app-releases.use-case.js";
import { EnvironmentAppReleaseRepository } from "./infrastructure/persistence/environment-app-release.repository.js";

export const APP_CONFIG_APP_VERSIONS_PROVIDERS = [
  { provide: AppReleaseRepositoryPort, useClass: EnvironmentAppReleaseRepository },
  provideUseCase(ListAppReleasesUseCase, { appReleaseRepository: AppReleaseRepositoryPort }),
] satisfies Provider[];
