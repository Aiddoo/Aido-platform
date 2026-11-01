import {
  pgTable,
  integer,
  text,
  timestamp,
  varchar,
  serial,
  index,
  foreignKey,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import { createEntityId } from "../entity-id.js";
import { subscriptionStatus, premiumGrantSource, premiumGrantStatus } from "./enums.schema.js";
import { user } from "./identity.schema.js";

export const subscription = pgTable(
  "Subscription",
  {
    cancelledAt: timestamp({ precision: 3 }),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    dataRetentionUntil: timestamp({ precision: 3 }),
    deletedAt: timestamp({ precision: 3 }),
    expiresAt: timestamp({ precision: 3 }).notNull(),
    id: serial().primaryKey(),
    lastProcessedEventId: varchar({ length: 255 }),
    productId: varchar({ length: 100 }).notNull(),
    revenueCatId: varchar({ length: 255 }).notNull(),
    startedAt: timestamp({ precision: 3 }).notNull(),
    status: subscriptionStatus().notNull(),
    updatedAt: timestamp({ precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Subscription_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("Subscription_deletedAt_idx").using("btree", table.deletedAt.asc().nullsLast()),
    index("Subscription_status_expiresAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.expiresAt.asc().nullsLast(),
    ),
    index("Subscription_userId_idx").using("btree", table.userId.asc().nullsLast()),
    unique("Subscription_revenueCatId_key").on(table.revenueCatId),
  ],
);

export const subscriptionEventReceipt = pgTable(
  "SubscriptionEventReceipt",
  {
    eventId: varchar({ length: 255 }).notNull(),
    eventType: varchar({ length: 50 }).notNull(),
    processedAt: timestamp({ precision: 3 }).notNull(),
    provider: varchar({ length: 30 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.eventId], name: "SubscriptionEventReceipt_pkey" }),
  ],
);

export const premiumGrant = pgTable(
  "PremiumGrant",
  {
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    durationDays: integer().notNull(),
    endingNotifiedAt: timestamp({ precision: 3 }),
    endsAt: timestamp({ precision: 3 }),
    id: text().primaryKey().$defaultFn(createEntityId),
    source: premiumGrantSource().notNull(),
    sourceKey: varchar({ length: 128 }).notNull(),
    startsAt: timestamp({ precision: 3 }),
    status: premiumGrantStatus().notNull(),
    updatedAt: timestamp({ precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "PremiumGrant_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("PremiumGrant_status_endsAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.endsAt.asc().nullsLast(),
    ),
    index("PremiumGrant_userId_status_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    unique("PremiumGrant_sourceKey_key").on(table.sourceKey),
  ],
);
