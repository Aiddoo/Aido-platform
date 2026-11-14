import { APP_PLATFORMS, APP_STORE_VERSION_MAX_LENGTH } from "@aido/api/vocabulary";
import { pgTable, varchar } from "drizzle-orm/pg-core";

import { instant } from "../columns/temporal-columns.js";

export const appRelease = pgTable("AppRelease", {
  latestVersion: varchar({ length: APP_STORE_VERSION_MAX_LENGTH }).notNull(),
  // 스토어마다 최신 릴리스가 하나라 플랫폼이 곧 식별자다
  platform: varchar({ length: 16, enum: APP_PLATFORMS }).primaryKey(),
  // 도메인이 ClockPort 값으로 채운다. 저장소가 insert·update마다 명시한다
  updatedAt: instant().notNull(),
});
