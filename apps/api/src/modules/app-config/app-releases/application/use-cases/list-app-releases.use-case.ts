import type { AppRelease } from "../../domain/app-release.aggregate.js";
import type { AppReleaseRepositoryPort } from "../ports/app-release.repository.port.js";

export interface ListAppReleasesDependencies {
  readonly appReleaseRepository: Pick<AppReleaseRepositoryPort, "listLatestReleases">;
}

export class ListAppReleasesUseCase {
  readonly #dependencies: ListAppReleasesDependencies;

  constructor(dependencies: ListAppReleasesDependencies) {
    this.#dependencies = dependencies;
  }

  execute(): Promise<AppRelease[]> {
    return this.#dependencies.appReleaseRepository.listLatestReleases();
  }
}
