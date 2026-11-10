import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { broadcastCampaign } from "#api/platform/database/schema/index";

import type { BroadcastCampaignRepositoryPort } from "../../application/ports/broadcast-campaign.repository.port.js";
import {
  BroadcastCampaign,
  type BroadcastCampaignCreationPlan,
} from "../../domain/broadcast-campaign.aggregate.js";

type BroadcastCampaignRow = typeof broadcastCampaign.$inferSelect;

function toCampaign(row: BroadcastCampaignRow): BroadcastCampaign {
  return BroadcastCampaign.reconstitute({
    id: row.id,
    requestId: row.requestId,
    status: row.status,
    title: row.title,
    body: row.body,
    targetFilter: row.targetFilter,
    action:
      row.actionType == null
        ? null
        : { type: row.actionType, ...(row.actionUrl != null && { url: row.actionUrl }) },
    force: row.force,
    cursorUserId: row.cursorUserId,
    processedCount: row.processedCount,
    queuedCount: row.queuedCount,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  });
}

@Injectable()
export class DrizzleBroadcastCampaignRepository implements BroadcastCampaignRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async createOrFind(
    plan: BroadcastCampaignCreationPlan,
  ): Promise<{ readonly campaign: BroadcastCampaign; readonly created: boolean }> {
    const [inserted] = await this.#db
      .insert(broadcastCampaign)
      .values({
        requestId: plan.requestId,
        title: plan.title,
        body: plan.body,
        targetFilter: plan.targetFilter,
        actionType: plan.action?.type ?? null,
        actionUrl: plan.action?.url ?? null,
        force: plan.force,
        createdAt: plan.createdAt,
      })
      .onConflictDoNothing({ target: broadcastCampaign.requestId })
      .returning();
    if (inserted != null) {
      return { campaign: toCampaign(inserted), created: true };
    }
    const existing = await this.#db.query.broadcastCampaign.findFirst({
      where: { requestId: plan.requestId },
    });
    return { campaign: toCampaign(requireRecord(existing)), created: false };
  }

  async findById(campaignId: string): Promise<BroadcastCampaign | null> {
    const row = await this.#db.query.broadcastCampaign.findFirst({ where: { id: campaignId } });
    return row == null ? null : toCampaign(row);
  }

  async findByIdForUpdate(campaignId: string): Promise<BroadcastCampaign | null> {
    const [row] = await this.#db
      .select()
      .from(broadcastCampaign)
      .where(eq(broadcastCampaign.id, campaignId))
      .for("update");
    return row == null ? null : toCampaign(row);
  }

  async save(campaign: BroadcastCampaign): Promise<void> {
    const snapshot = campaign.toSnapshot();
    const [saved] = await this.#db
      .update(broadcastCampaign)
      .set({
        status: snapshot.status,
        cursorUserId: snapshot.cursorUserId,
        processedCount: snapshot.processedCount,
        queuedCount: snapshot.queuedCount,
        failureReason: snapshot.failureReason,
        startedAt: snapshot.startedAt,
        completedAt: snapshot.completedAt,
      })
      .where(eq(broadcastCampaign.id, snapshot.id))
      .returning({ id: broadcastCampaign.id });
    requireRecord(saved);
  }
}
