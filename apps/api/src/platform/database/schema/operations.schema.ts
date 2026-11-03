import type { BroadcastCampaignStatus, BroadcastTargetFilter } from "@aido/api/vocabulary";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { createEntityId } from "../entity-id.js";
import { notificationActionType } from "./enums.schema.js";

export const broadcastCampaign = pgTable(
  "BroadcastCampaign",
  {
    actionType: notificationActionType(),
    actionUrl: text(),
    body: varchar({ length: 500 }).notNull(),
    completedAt: timestamp({ precision: 3 }),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    cursorUserId: text(),
    failureReason: varchar({ length: 500 }),
    force: boolean().default(false).notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    processedCount: integer().default(0).notNull(),
    queuedCount: integer().default(0).notNull(),
    requestId: uuid().notNull(),
    startedAt: timestamp({ precision: 3 }),
    status: varchar({ length: 20 }).$type<BroadcastCampaignStatus>().default("QUEUED").notNull(),
    targetFilter: varchar({ length: 40 }).$type<BroadcastTargetFilter>().notNull(),
    title: varchar({ length: 100 }).notNull(),
    updatedAt: timestamp({ precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("BroadcastCampaign_requestId_key").on(table.requestId),
    index("BroadcastCampaign_status_createdAt_idx").on(table.status, table.createdAt),
  ],
);
