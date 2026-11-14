import {
  AppRelease,
  type AppReleasePrimitives,
} from "#api/modules/app-config/app-versions/domain/app-release.aggregate";

export const APP_RELEASE_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");

export function createAppReleaseFixture(overrides: Partial<AppReleasePrimitives> = {}): AppRelease {
  return AppRelease.reconstitute({
    platform: "ios",
    latestVersion: "1.9.1",
    updatedAt: APP_RELEASE_FIXTURE_NOW,
    ...overrides,
  });
}
