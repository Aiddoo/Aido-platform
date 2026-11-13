import {
  AppRelease,
  type AppReleasePrimitives,
} from "#api/modules/app-config/app-versions/domain/app-release.aggregate";

export function createAppReleaseFixture(overrides: Partial<AppReleasePrimitives> = {}): AppRelease {
  return AppRelease.reconstitute({ platform: "ios", latestVersion: "1.9.1", ...overrides });
}
