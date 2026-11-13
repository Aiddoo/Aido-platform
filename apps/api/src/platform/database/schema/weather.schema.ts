import {
  pgTable,
  integer,
  text,
  varchar,
  doublePrecision,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";

import { createEntityId } from "../../../shared/domain/model/entity-id.js";
import { instant } from "../columns/temporal-columns.js";
import { user } from "./identity.schema.js";

export const userLocation = pgTable(
  "UserLocation",
  {
    // KMA 격자는 한국 범위 좌표에만 있다.
    gridX: integer(),
    gridY: integer(),
    id: text().primaryKey().$defaultFn(createEntityId),
    latitude: doublePrecision().notNull(),
    longitude: doublePrecision().notNull(),
    // v2 이전에 저장된 위치는 null이다.
    timezone: varchar({ length: 50 }),
    // 도메인이 ClockPort 값으로 채운다. 저장소가 insert·update마다 명시한다
    updatedAt: instant().notNull(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "UserLocation_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("UserLocation_userId_key").on(table.userId),
  ],
);
