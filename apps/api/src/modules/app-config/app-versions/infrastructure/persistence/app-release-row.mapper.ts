import type { appRelease as appReleaseTable } from "#api/platform/database/schema/app-config.schema";

import { AppRelease } from "../../domain/app-release.aggregate.js";

type AppReleaseRow = typeof appReleaseTable.$inferSelect;
type AppReleaseInsertRow = typeof appReleaseTable.$inferInsert;

export function toAppRelease(row: AppReleaseRow): AppRelease {
  return AppRelease.reconstitute(row);
}

export function toAppReleaseRow(release: AppRelease): AppReleaseInsertRow {
  return release.toPrimitives();
}
