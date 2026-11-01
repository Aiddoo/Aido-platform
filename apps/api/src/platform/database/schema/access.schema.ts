import {
  pgTable,
  integer,
  text,
  timestamp,
  varchar,
  index,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";

import { createEntityId } from "../entity-id.js";
import { resourceType } from "./enums.schema.js";
import { user } from "./identity.schema.js";

export const resourceBonus = pgTable(
  "ResourceBonus",
  {
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    quantity: integer().notNull(),
    resource: resourceType().notNull(),
    sourceKey: varchar({ length: 128 }).notNull(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "ResourceBonus_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("ResourceBonus_userId_resource_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.resource.asc().nullsLast(),
    ),
    unique("ResourceBonus_sourceKey_key").on(table.sourceKey),
  ],
);
