import { AppReleaseReaderPort } from "#api/modules/app-config/app-versions/application/ports/app-release.reader.port";
import type { AppRelease } from "#api/modules/app-config/app-versions/domain/app-release.entity";

export class InMemoryAppReleaseReader extends AppReleaseReaderPort {
  releases: AppRelease[];

  constructor(releases: readonly AppRelease[] = []) {
    super();
    this.releases = [...releases];
  }

  listLatestReleases(): AppRelease[] {
    return [...this.releases];
  }
}
