import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { AppReleaseRepositoryPort } from "./application/ports/app-release.repository.port.js";
import { ListAppReleasesUseCase } from "./application/use-cases/list-app-releases.use-case.js";
import { PublishAppReleaseUseCase } from "./application/use-cases/publish-app-release.use-case.js";
import { DrizzleAppReleaseRepository } from "./infrastructure/persistence/drizzle-app-release.repository.js";

export const APP_CONFIG_APP_VERSIONS_PROVIDERS = [
  { provide: AppReleaseRepositoryPort, useClass: DrizzleAppReleaseRepository },
  provideUseCase(ListAppReleasesUseCase, { appReleaseRepository: AppReleaseRepositoryPort }),
] satisfies Provider[];

export const APP_CONFIG_APP_VERSIONS_ADMIN_PROVIDERS = [
  provideUseCase(PublishAppReleaseUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    appReleaseRepository: AppReleaseRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(PublishAppReleaseUseCase),
  }),
] satisfies Provider[];
