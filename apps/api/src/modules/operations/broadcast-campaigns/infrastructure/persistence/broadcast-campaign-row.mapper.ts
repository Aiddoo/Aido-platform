import { SUPPORTED_LOCALES } from "@aido/api/vocabulary";
import { z } from "zod";

import type { broadcastCampaign } from "#api/platform/database/schema/operations.schema";

import { BroadcastCampaign } from "../../domain/broadcast-campaign.aggregate.js";

type BroadcastCampaignRow = typeof broadcastCampaign.$inferSelect;
type BroadcastCampaignInsertRow = typeof broadcastCampaign.$inferInsert;

const copySchema = z.object({ title: z.string(), body: z.string() });

// jsonb 컬럼은 읽을 때 한 번 더 검증한다
const localizedContentColumnSchema = z.partialRecord(z.enum(SUPPORTED_LOCALES), copySchema);

const deliveryColumnSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("NOW") }),
  z.object({
    mode: z.literal("RECIPIENT_LOCAL_TIME"),
    localTime: z.string(),
    date: z.string(),
  }),
]);

export function toBroadcastCampaign(row: BroadcastCampaignRow): BroadcastCampaign {
  return BroadcastCampaign.reconstitute({
    id: row.id,
    requestId: row.requestId,
    title: row.title,
    body: row.body,
    localizedContent:
      row.localizedContent == null
        ? null
        : localizedContentColumnSchema.parse(row.localizedContent),
    targetFilter: row.targetFilter,
    action:
      row.actionType == null
        ? null
        : { type: row.actionType, ...(row.actionUrl != null && { url: row.actionUrl }) },
    force: row.force,
    delivery: row.delivery == null ? { mode: "NOW" } : deliveryColumnSchema.parse(row.delivery),
    status: row.status,
    cursorUserId: row.cursorUserId,
    processedCount: row.processedCount,
    queuedCount: row.queuedCount,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  });
}

export function toBroadcastCampaignRow(campaign: BroadcastCampaign): BroadcastCampaignInsertRow {
  const primitives = campaign.toPrimitives();
  return {
    id: primitives.id,
    requestId: primitives.requestId,
    title: primitives.title,
    body: primitives.body,
    localizedContent: primitives.localizedContent,
    targetFilter: primitives.targetFilter,
    actionType: primitives.action?.type ?? null,
    actionUrl: primitives.action?.url ?? null,
    force: primitives.force,
    // NOW는 컬럼을 비워 이 기능 전에 접수한 캠페인과 같은 모양으로 둔다
    delivery: primitives.delivery.mode === "NOW" ? null : primitives.delivery,
    status: primitives.status,
    cursorUserId: primitives.cursorUserId,
    processedCount: primitives.processedCount,
    queuedCount: primitives.queuedCount,
    failureReason: primitives.failureReason,
    createdAt: primitives.createdAt,
    updatedAt: primitives.updatedAt,
    startedAt: primitives.startedAt,
    completedAt: primitives.completedAt,
  };
}
