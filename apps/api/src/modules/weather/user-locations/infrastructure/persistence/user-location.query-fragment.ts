import { eq, exists, sql, type SQL } from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import { userLocation } from "#api/platform/database/schema/index";

// 다른 Context가 사람 id 칸 옆에 저장한 위치(위도·경도)를 한 SQL로 붙이는 하위 질의다. 사람마다 한 행(UserLocation_userId_key)이다
export function userCoordinates() {
  return new QueryBuilder()
    .select({
      userId: userLocation.userId,
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
    })
    .from(userLocation)
    .as("user_coordinates");
}

export function hasUserLocation(userIdColumn: AnyPgColumn): SQL {
  return exists(
    new QueryBuilder()
      .select({ one: sql`1` })
      .from(userLocation)
      .where(eq(userLocation.userId, userIdColumn)),
  );
}
