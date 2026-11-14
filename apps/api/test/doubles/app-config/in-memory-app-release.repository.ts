import { AppReleaseRepositoryPort } from "#api/modules/app-config/app-versions/application/ports/app-release.repository.port";
import { AppRelease } from "#api/modules/app-config/app-versions/domain/app-release.aggregate";

// 저장 사본을 두어 save 뒤에 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(release: AppRelease): AppRelease {
  return AppRelease.reconstitute(release.toPrimitives());
}

export class InMemoryAppReleaseRepository extends AppReleaseRepositoryPort {
  releases: AppRelease[];

  constructor(releases: readonly AppRelease[] = []) {
    super();
    this.releases = releases.map(copyOf);
  }

  async listLatestReleases(): Promise<AppRelease[]> {
    return this.releases.map(copyOf);
  }

  async save(release: AppRelease): Promise<void> {
    this.releases = [
      ...this.releases.filter((stored) => stored.platform !== release.platform),
      copyOf(release),
    ];
  }
}
