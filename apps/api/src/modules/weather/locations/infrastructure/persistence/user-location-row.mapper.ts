import type { userLocation } from "#api/platform/database/schema/weather.schema";

import { UserLocation } from "../../domain/user-location.entity.js";

/** row id는 도메인이 모르므로 조회에서 고르지 않는다. */
type UserLocationRow = Omit<typeof userLocation.$inferSelect, "id">;
type UserLocationInsertRow = typeof userLocation.$inferInsert;

export function toUserLocation(row: UserLocationRow): UserLocation {
  return UserLocation.reconstitute(row);
}

/** row id는 DB 기본값(createEntityId)이 채우고 userId unique 충돌 때는 그대로 둔다. */
export function toUserLocationRow(location: UserLocation): UserLocationInsertRow {
  return location.toPrimitives();
}
