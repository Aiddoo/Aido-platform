import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { broadcastCampaign } from "#api/platform/database/schema/operations.schema";
import { createEntityId } from "#api/shared/domain/model/entity-id";

import { BroadcastCampaignRepositoryPort } from "../../application/ports/broadcast-campaign.repository.port.js";
import { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import type { BroadcastCampaign } from "../../domain/broadcast-campaign.aggregate.js";
import { toBroadcastCampaign, toBroadcastCampaignRow } from "./broadcast-campaign-row.mapper.js";

@Injectable()
export class DrizzleBroadcastCampaignRepository extends BroadcastCampaignRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<BroadcastCampaignId> {
    return BroadcastCampaignId.reconstitute(createEntityId());
  }

  async acceptByRequestId(
    campaign: BroadcastCampaign,
  ): Promise<{ readonly campaign: BroadcastCampaign; readonly created: boolean }> {
    const [inserted] = await this.#db
      .insert(broadcastCampaign)
      .values(toBroadcastCampaignRow(campaign))
      .onConflictDoNothing({ target: broadcastCampaign.requestId })
      .returning();
    if (inserted != null) {
      return { campaign: toBroadcastCampaign(inserted), created: true };
    }
    const existing = await this.#db.query.broadcastCampaign.findFirst({
      where: { requestId: campaign.requestId },
    });
    return { campaign: toBroadcastCampaign(requireRecord(existing)), created: false };
  }

  async findById(campaignId: BroadcastCampaignId): Promise<BroadcastCampaign | null> {
    const row = await this.#db.query.broadcastCampaign.findFirst({
      where: { id: campaignId.value },
    });
    return row == null ? null : toBroadcastCampaign(row);
  }

  async findByIdForUpdate(campaignId: BroadcastCampaignId): Promise<BroadcastCampaign | null> {
    const [row] = await this.#db
      .select()
      .from(broadcastCampaign)
      .where(eq(broadcastCampaign.id, campaignId.value))
      .for("update");
    return row == null ? null : toBroadcastCampaign(row);
  }

  async save(campaign: BroadcastCampaign): Promise<void> {
    const row = toBroadcastCampaignRow(campaign);
    const [saved] = await this.#db
      .update(broadcastCampaign)
      .set({
        status: row.status,
        cursorUserId: row.cursorUserId,
        processedCount: row.processedCount,
        queuedCount: row.queuedCount,
        failureReason: row.failureReason,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        updatedAt: row.updatedAt,
      })
      .where(eq(broadcastCampaign.id, campaign.id.value))
      .returning({ id: broadcastCampaign.id });
    requireRecord(saved);
  }
}
