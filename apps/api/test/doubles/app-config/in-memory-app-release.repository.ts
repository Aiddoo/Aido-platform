import { AppReleaseRepositoryPort } from "#api/modules/app-config/app-versions/application/ports/app-release.repository.port";
import type { AppRelease } from "#api/modules/app-config/app-versions/domain/app-release.aggregate";

export class InMemoryAppReleaseRepository extends AppReleaseRepositoryPort {
  releases: AppRelease[];

  constructor(releases: readonly AppRelease[] = []) {
    super();
    this.releases = [...releases];
  }

  listLatestReleases(): AppRelease[] {
    return [...this.releases];
  }
}
