import type {
  BroadcastCampaignStatus,
  BroadcastDeliveryMode,
  BroadcastTargetFilter,
  SupportedLocale,
} from "@aido/api/vocabulary";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { instant } from "../columns/temporal-columns.js";
import { createEntityId } from "../entity-id.js";
import { notificationActionType } from "./enums.schema.js";

/** 언어별 문구. 수신자 언어에 항목이 없으면 title·body를 쓴다 */
export type BroadcastLocalizedContentColumn = Partial<
  Record<SupportedLocale, { title: string; body: string }>
>;

/** 발송 시점. 컬럼이 null이면 NOW다(이 기능 전에 접수한 캠페인) */
export type BroadcastDeliveryColumn =
  | { mode: Extract<BroadcastDeliveryMode, "NOW"> }
  | {
      mode: Extract<BroadcastDeliveryMode, "RECIPIENT_LOCAL_TIME">;
      localTime: string;
      date: string;
    };

export const broadcastCampaign = pgTable(
  "BroadcastCampaign",
  {
    actionType: notificationActionType(),
    actionUrl: text(),
    body: varchar({ length: 500 }).notNull(),
    completedAt: instant(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    cursorUserId: text(),
    delivery: jsonb().$type<BroadcastDeliveryColumn>(),
    failureReason: varchar({ length: 500 }),
    force: boolean().default(false).notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    localizedContent: jsonb().$type<BroadcastLocalizedContentColumn>(),
    processedCount: integer().default(0).notNull(),
    queuedCount: integer().default(0).notNull(),
    requestId: uuid().notNull(),
    startedAt: instant(),
    status: varchar({ length: 20 }).$type<BroadcastCampaignStatus>().default("QUEUED").notNull(),
    targetFilter: varchar({ length: 40 }).$type<BroadcastTargetFilter>().notNull(),
    title: varchar({ length: 100 }).notNull(),
    // 도메인이 ClockPort 값으로 채운다
    updatedAt: instant().notNull(),
  },
  (table) => [
    unique("BroadcastCampaign_requestId_key").on(table.requestId),
    index("BroadcastCampaign_status_createdAt_idx").on(table.status, table.createdAt),
  ],
);
