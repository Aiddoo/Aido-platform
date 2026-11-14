import type { AppRelease } from "../../domain/app-release.aggregate.js";

export abstract class AppReleaseRepositoryPort {
  // 공개한 적 없는 플랫폼은 목록에 없다. 한 플랫폼이라도 없으면 응답은 꺼짐이다(안전하게 닫는다)
  abstract listLatestReleases(): Promise<AppRelease[]>;
  // 플랫폼마다 한 행이라 같은 플랫폼의 이전 값을 바꾼다
  abstract save(release: AppRelease): Promise<void>;
}
