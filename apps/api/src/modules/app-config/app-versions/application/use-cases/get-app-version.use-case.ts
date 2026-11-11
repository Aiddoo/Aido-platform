import type { AppRelease } from "../../domain/app-release.entity.js";
import type { AppReleaseReaderPort } from "../ports/app-release.reader.port.js";

export interface GetAppVersionDependencies {
  readonly appReleaseReader: Pick<AppReleaseReaderPort, "listLatestReleases">;
}

export class GetAppVersionUseCase {
  readonly #dependencies: GetAppVersionDependencies;

  constructor(dependencies: GetAppVersionDependencies) {
    this.#dependencies = dependencies;
  }

  execute(): AppRelease[] {
    return this.#dependencies.appReleaseReader.listLatestReleases();
  }
}
