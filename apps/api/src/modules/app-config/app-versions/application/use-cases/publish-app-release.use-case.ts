import type { AppPlatform } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { AppVersion } from "../../../shared/domain/app-version.vo.js";
import { AppRelease } from "../../domain/app-release.aggregate.js";
import { AppReleaseLockKeys } from "../app-versions.lock-keys.js";
import { AppReleaseLogEvent } from "../app-versions.log-events.js";
import type { AppReleaseRepositoryPort } from "../ports/app-release.repository.port.js";

export interface PublishAppReleaseCommand {
  readonly platform: AppPlatform;
  readonly latestVersion: string;
}

export interface PublishAppReleaseDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly appReleaseRepository: Pick<AppReleaseRepositoryPort, "save">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class PublishAppReleaseUseCase {
  readonly #dependencies: PublishAppReleaseDependencies;

  constructor(dependencies: PublishAppReleaseDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: PublishAppReleaseCommand): Promise<AppRelease> {
    const { unitOfWork, mutationLock, appReleaseRepository, clock, logger } = this.#dependencies;
    const latestVersion = AppVersion.create(command.latestVersion);

    const release = await unitOfWork.run(async () => {
      // 시각을 잠금 안에서 읽어 같은 플랫폼의 반영이 겹쳐도 나중에 저장된 값의 시각이 더 늦다
      await mutationLock.acquire([AppReleaseLockKeys.release(command.platform)]);
      const published = AppRelease.create({
        platform: command.platform,
        latestVersion,
        now: clock.now(),
      });
      await appReleaseRepository.save(published);
      return published;
    });

    logger.log({
      event: AppReleaseLogEvent.PUBLISHED,
      platform: command.platform,
      latestVersion: command.latestVersion,
    });
    return release;
  }
}
