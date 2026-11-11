import type { AppRelease } from "../../domain/app-release.entity.js";

export abstract class AppReleaseReaderPort {
  // 확인을 끈 경우와 한 플랫폼이라도 버전이 없는 경우는 빈 목록이다(안전하게 닫는다)
  abstract listLatestReleases(): AppRelease[];
}
